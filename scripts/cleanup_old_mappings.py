import firebase_admin
from firebase_admin import credentials, firestore
import os
import argparse
import re

def cleanup_old_mappings(project_id, dry_run=True, trash_only=False):
    """
    Deletes point_creature mappings.
    - If trash_only=True: Only deletes documents with malformed IDs (AI hallucinations).
    - If trash_only=False: Deletes all old mappings (not python-batch-v1).
    """
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': project_id,
        })

    db = firestore.client()
    pc_ref = db.collection('point_creatures')

    print(f"🧹 Starting cleanup in project: {project_id}")
    if trash_only:
        print(r"🎯 MODE: Malformed Trash IDs Only (Not matching ^.+_c\d+$)")
    if dry_run:
        print("🧪 DRY RUN MODE: No data will be deleted.")

    # Step 1: Get all document IDs
    print(f"📡 Scanning all records in {project_id}...")
    all_mapping_ids = {doc.id for doc in pc_ref.select([]).stream()}
    total_count = len(all_mapping_ids)

    # Step 2: Define what to delete
    if trash_only:
        # 正解パターン: p[英数字]_c[英数字]
        # 例: p12345_c67890 はOK, p1734768hash123_c1734768hash456 もOK
        # ゴミ: p_123_c456 や p123_c_abc などはNG
        valid_pattern = re.compile(r"^p[a-z0-9]+_c[a-z0-9]+$")
        to_delete = sorted([doc_id for doc_id in all_mapping_ids if not valid_pattern.match(doc_id)])
        reason = "Malformed Trash IDs (not matching ^p[a-z0-9]+_c[a-z0-9]+$)"
    else:
        print(f"📡 Identifying new AI mappings (python-batch-v1)...")
        new_mapping_ids = {doc.id for doc in pc_ref.where('method', '==', 'python-batch-v1').select([]).stream()}
        to_delete = sorted(list(all_mapping_ids - new_mapping_ids))
        new_count = len(new_mapping_ids)
        reason = "Old/Other Mappings (non-python-batch-v1)"

    delete_count = len(to_delete)

    print(f"\n📊 --- Database Summary ---")
    print(f"📈 Total Mappings in DB: {total_count}")
    print(f"🗑️  Target for Deletion ({reason}): {delete_count}")

    if dry_run and to_delete:
        print(f"\n🧪 Sample of IDs to be deleted (First 20):")
        for doc_id in to_delete[:20]:
            print(f"  - {doc_id}")

    if not dry_run and to_delete:
        print(f"🚀 Deleting {delete_count} documents...")
        batch_size = 500
        for i in range(0, delete_count, batch_size):
            batch = db.batch()
            chunk = to_delete[i:i + batch_size]
            for doc_id in chunk:
                batch.delete(pc_ref.document(doc_id))
            batch.commit()
            print(f"  ✅ Committed batch {i//batch_size + 1}")

    print(f"\n✨ Cleanup finished.")
    if dry_run:
        print(f"   - To actually delete, run with --execute")
    else:
        print(f"   - Successfully deleted: {delete_count}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup malformed or old point-creature mappings")
    parser.add_argument("--project", required=True, help="Google Cloud Project ID")
    parser.add_argument("--execute", action="store_true", help="Actually perform the deletion")
    parser.add_argument("--trash-only", action="store_true", help="Only delete malformed IDs (not matching ^.+_c\\d+)")

    args = parser.parse_args()
    cleanup_old_mappings(args.project, dry_run=not args.execute, trash_only=args.trash_only)
