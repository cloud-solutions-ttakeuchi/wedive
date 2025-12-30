import firebase_admin
from firebase_admin import credentials, firestore
import argparse
from datetime import datetime

def setup_firestore(project_id):
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {'projectId': project_id})
    return firestore.client()

def cleanup_rejected_proposals(project_id, dry_run=True):
    db = setup_firestore(project_id)
    print(f"🧹 Cleanup started for project: {project_id}")
    if dry_run:
        print("🧪 DRY RUN MODE: No data will be deleted.")

    stats = {
        'proposals_deleted': 0,
        'master_records_deleted': 0,
        'orphan_master_records_deleted': 0
    }

    # ==========================================
    # 1. Clean up Rejected Proposals & Linked Master Data
    # ==========================================
    proposal_collections = [
        ('point_proposals', 'points'),
        ('creature_proposals', 'creatures')
    ]

    for prop_col, master_col in proposal_collections:
        print(f"\n🔍 Scanning {prop_col} for rejected items...")

        # Fetch rejected proposals
        docs = db.collection(prop_col).where('status', '==', 'rejected').stream()

        batch = db.batch()
        batch_count = 0

        for doc in docs:
            data = doc.to_dict()
            prop_id = doc.id
            proposal_type = data.get('proposalType')
            target_id = data.get('targetId')

            # Delete the proposal itself
            if not dry_run:
                batch.delete(doc.reference)
            stats['proposals_deleted'] += 1
            print(f"   - [Proposal] Will delete {prop_col}/{prop_id} (Type: {proposal_type})")

            # Cascade delete for 'create' proposals if master data exists and is not approved
            if proposal_type == 'create' or not target_id:
                # For 'create', targetId might be empty or mapped differently.
                # However, if we have a targetId or if the logic implies a specific ID:
                # In current logic, create proposals might not link to master until approved.
                # But if a master record WAS created (e.g. legacy logic), we should try to find it.
                # Since we can't easily guess the ID if it's not in targetId, we skip specific cascade here
                # and rely on Step 2 (Orphan Master Cleanup) to catch them.
                if target_id:
                    master_ref = db.collection(master_col).document(target_id)
                    master_doc = master_ref.get()
                    if master_doc.exists:
                        master_data = master_doc.to_dict()
                        if master_data.get('status') in ['pending', 'rejected']:
                            if not dry_run:
                                batch.delete(master_ref)
                            stats['master_records_deleted'] += 1
                            print(f"     -> [Cascade] Also deleting master {master_col}/{target_id} (Status: {master_data.get('status')})")

            # Commit batch periodically
            batch_count += 1
            if batch_count >= 400:
                if not dry_run:
                    batch.commit()
                batch = db.batch()
                batch_count = 0

        if batch_count > 0 and not dry_run:
            batch.commit()

    # ==========================================
    # 2. Clean up Orphaned/Zombie Master Data (Pending/Rejected)
    # ==========================================
    master_collections = ['points', 'creatures']

    for master_col in master_collections:
        print(f"\n🔍 Scanning {master_col} for pending/rejected zombies...")

        # We need to check both pending and rejected
        for status in ['pending', 'rejected']:
            docs = db.collection(master_col).where('status', '==', status).stream()

            batch = db.batch()
            batch_count = 0

            for doc in docs:
                if not dry_run:
                    batch.delete(doc.reference)
                stats['orphan_master_records_deleted'] += 1
                print(f"   - [Master] Deleting {master_col}/{doc.id} (Status: {status})")

                batch_count += 1
                if batch_count >= 400:
                    if not dry_run:
                        batch.commit()
                    batch = db.batch()
                    batch_count = 0

            if batch_count > 0 and not dry_run:
                batch.commit()

    print("\n✨ Cleanup Summary:")
    print(f"   - Rejected Proposals deleted: {stats['proposals_deleted']}")
    print(f"   - Cascaded Master records deleted: {stats['master_records_deleted']}")
    print(f"   - Orphan Master records (zombies) deleted: {stats['orphan_master_records_deleted']}")

    if dry_run:
        print("\nℹ️  This was a DRY RUN. No changes were made.")
        print("    Run with --execute to perform actual deletion.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup rejected proposals and zombie master data")
    parser.add_argument("--project", required=True, help="Google Cloud Project ID")
    parser.add_argument("--execute", action="store_true", help="Actually perform the deletion")

    args = parser.parse_args()
    cleanup_rejected_proposals(args.project, dry_run=not args.execute)
