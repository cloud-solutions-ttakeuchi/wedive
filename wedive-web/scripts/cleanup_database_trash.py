import firebase_admin
from firebase_admin import credentials, firestore
import argparse
import re

def is_garbage(collection_name, doc_id):
    """
    判定ロジック:
    - マスター系 (creatures, points, areas, zones, regions):
      正解は 'プレフィックス + 数字'。例: c12345, p999.
      それ以外 (c_abc, p_123_abc) はゴミ。
    - マッピング系 (point_creatures):
      正解は 'p数字_c数字'。例: p123_c456.
      それ以外 (p_123_c_456, など) はゴミ。
    """
    if collection_name == "point_creatures":
        # 正解: ^p\d+_c\d+$
        return not bool(re.match(r"^p\d+_c\d+$", doc_id))
    else:
        # 正解: ^[a-z]\d+$ (プレフィックス1文字 + 数字)
        return not bool(re.match(r"^[a-z]\d+$", doc_id))

def cleanup_database_trash(project_id, dry_run=True):
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {'projectId': project_id})

    db = firestore.client()
    collections = ["creatures", "points", "areas", "zones", "regions", "point_creatures"]

    print(f"🧹 Database Deep Cleaning starting in: {project_id}")
    if dry_run:
        print("🧪 DRY RUN MODE: No data will be deleted.")

    total_deleted = 0

    for coll_name in collections:
        print(f"\n📡 Scanning collection: {coll_name}...")
        coll_ref = db.collection(coll_name)

        # IDのみを高速に取得
        all_ids = [doc.id for doc in coll_ref.select([]).stream()]
        garbage_ids = [doc_id for doc_id in all_ids if is_garbage(coll_name, doc_id)]

        print(f"   - Total records: {len(all_ids)}")
        print(f"   - Garbage detected: {len(garbage_ids)}")

        if not garbage_ids:
            continue

        if dry_run:
            print(f"   - Sample garbage (First 5): {garbage_ids[:5]}")
        else:
            print(f"   - Deleting {len(garbage_ids)} items...")
            batch_size = 500
            for i in range(0, len(garbage_ids), batch_size):
                batch = db.batch()
                chunk = garbage_ids[i:i + batch_size]
                for doc_id in chunk:
                    batch.delete(coll_ref.document(doc_id))
                batch.commit()
                print(f"     ✅ Batch {i//batch_size + 1} committed")
            total_deleted += len(garbage_ids)

    print(f"\n✨ Cleanup finished.")
    if dry_run:
        print("   - This was a dry run. Review the counts and run with --execute to perform deletion.")
    else:
        print(f"   - Total items purged across all collections: {total_deleted}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deep cleanup of malformed IDs in Firestore")
    parser.add_argument("--project", required=True, help="Google Cloud Project ID")
    parser.add_argument("--execute", action="store_true", help="Actually perform the deletion")

    args = parser.parse_args()
    cleanup_database_trash(args.project, dry_run=not args.execute)
