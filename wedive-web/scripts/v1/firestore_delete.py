import argparse
import os
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

def delete_collection(coll_ref, batch_size, prefix=""):
    if batch_size == 0:
        return

    docs = coll_ref.list_documents(page_size=batch_size)
    deleted = 0

    for doc in docs:
        if prefix and not doc.id.startswith(prefix):
            continue

        print(f"Deleting doc {doc.id} => {doc.get().to_dict()}")
        doc.delete()
        deleted = deleted + 1

    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size, prefix)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=str, help="Target ID Prefix (e.g. document_id)")
    parser.add_argument("--collection", type=str, default="creatures", help="Target Collection Name")
    parser.add_argument("--key", type=str, default="serviceAccountKey.json", help="Path to Service Account Key")
    parser.add_argument("--project", type=str, default="dive-dex-app-dev", help="Firestore Project ID")
    args = parser.parse_args()

    # Prepare options
    app_options = {}
    if args.project:
        app_options['projectId'] = args.project

    # 1. Initialize Firebase
    if not firebase_admin._apps:
        try:
            if os.path.exists(args.key):
                cred = credentials.Certificate(args.key)
                firebase_admin.initialize_app(cred, options=app_options)
                print(f"Initialized Firebase with key: {args.key}")
            else:
                # Fallback to ADC
                print(f"Key file '{args.key}' not found. Trying Application Default Credentials...")
                firebase_admin.initialize_app(options=app_options)
                print("Initialized Firebase with ADC.")
        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            print("Please run 'gcloud auth application-default login' or provide a valid --key path.")
            return

    if args.project:
        print(f"Targeting Firestore project: {args.project}")
    else:
        print(f"Targeting Firestore (default project)")

    db = firestore.client()

    # 2. Get Collection Reference
    coll_ref = db.collection(args.collection)

    # 3. Set Batch Size
    batch_size = 50

    # 4. Set Prefix
    prefix = args.id

    if not prefix:
        print("Please provide --id to specify the document ID prefix.")
        return

    print(f"Deleting docs in '{args.collection}' starting with '{prefix}'...")
    delete_collection(coll_ref, batch_size, prefix)
    print("Done.")


if __name__ == "__main__":
    main()
