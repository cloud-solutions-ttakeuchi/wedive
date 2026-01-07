import os
import json
import sqlite3
import gzip
import shutil
import tempfile
from datetime import datetime
from google.cloud import bigquery
from google.cloud import storage
import pandas as pd

# 設定（環境変数またはデフォルト値）
PROJECT_ID = os.environ.get("GCP_PROJECT")
DATASET_ID = os.environ.get("BQ_DATASET", "wedive_master_data_v1")
BUCKET_NAME = os.environ.get("GCS_BUCKET", "wedive-app-static-master")

# BigQuery View -> SQLite Table マッピング
TABLE_MAPPING = {
    "v_app_points_master": "master_points",
    "v_app_geography_master": "master_geography",
    "v_app_creatures_master": "master_creatures",
    "v_app_point_creatures": "master_point_creatures",
    "v_app_creature_points": "master_creature_points",
    "v_app_point_stats": "master_point_stats",
    "v_app_point_reviews": "master_point_reviews",
    "v_app_user_public_logs": "master_public_logs",
    "v_app_certifications_master": "master_certifications",
}

def compress_and_upload(local_file_path, destination_blob_name):
    """ファイルを gzip 圧縮して GCS にアップロードする。
    Content-Encoding を設定しないことで、ダウンロード時の勝手な解凍を防止する。
    """
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)

    # 一時的な gzip ファイルを作成
    gz_path = f"{local_file_path}.gz"
    with open(local_file_path, 'rb') as f_in:
        with gzip.open(gz_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

    # メタデータ設定 (重要: Content-Encoding は設定しない)
    blob.cache_control = "no-cache, max-age=0"

    # アップロード
    blob.upload_from_filename(gz_path, content_type="application/octet-stream")

    # 一時 gzip ファイルの削除
    if os.path.exists(gz_path):
        os.remove(gz_path)

    print(f"Uploaded and compressed: gs://{BUCKET_NAME}/{destination_blob_name}")

def main(request):
    """
    Cloud Run Functions エントリポイント (HTTPトリガー)
    """
    bq_client = bigquery.Client()

    with tempfile.TemporaryDirectory() as tmp_dir:
        sqlite_path = os.path.join(tmp_dir, "master.db")
        json_data = {}

        # SQLite 作成
        conn = sqlite3.connect(sqlite_path)
        for view_name, table_name in TABLE_MAPPING.items():
            print(f"Processing {view_name} -> {table_name}...")
            query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{view_name}`"
            df = bq_client.query(query).to_dataframe()
            df.to_sql(table_name, conn, if_exists="replace", index=False)

            # JSON用データ加工
            df_json = df.copy()
            for col in df_json.select_dtypes(include=['datetime64', 'datetimetz']).columns:
                df_json[col] = df_json[col].dt.strftime('%Y-%m-%dT%H:%M:%SZ')
            json_data[table_name] = df_json.to_dict(orient="records")
        conn.close()

        # 1. SQLite アップロード
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        compress_and_upload(sqlite_path, "v1/master/latest.db.gz")
        compress_and_upload(sqlite_path, f"v1/master/history/{ts}_master.db.gz")

        # 2. JSON アップロード
        json_path = os.path.join(tmp_dir, "master.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False)
        compress_and_upload(json_path, "v1/master/latest.json.gz")

    print("Export process completed successfully.")
    return "OK"
