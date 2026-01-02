#!/bin/bash

# Configuration
BUCKET="wedive-app-static-master"
REMOTE_PATH="v1/master/latest.db.gz"
LOCAL_GZ="assets/latest.db.gz"
LOCAL_DB="assets/master.db"

echo "🚀 Updating bundled master data from GCS..."

# 1. Download from GCS
# gsutil を使うのが確実 (gcloud 認証がある前提)
gsutil cp "gs://$BUCKET/$REMOTE_PATH" "$LOCAL_GZ"

if [ $? -eq 0 ]; then
  echo "✅ Download successful. Decompressing..."

  # 2. Decompress
  # -f: 強制上書き, -c: 標準出力に出してリダイレクト (元ファイルを消さない)
  gunzip -f -c "$LOCAL_GZ" > "$LOCAL_DB"

  # 3. Cleanup
  rm "$LOCAL_GZ"

  echo "✨ Master data updated: $LOCAL_DB"
  ls -lh "$LOCAL_DB"
else
  echo "❌ Error: Failed to download master data. Check your gcloud authentication."
  exit 1
fi
