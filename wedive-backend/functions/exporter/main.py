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
    "v_app_user_public_logs": "master_public_logs"
}

def export_to_gcs(local_path, destination_blob_name):
    """ファイルを GCS にアップロードする"""
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)

    # 既存のキャッシュを無効化するためメタデータを設定
    blob.cache_control = "no-cache, max-age=0"
    blob.content_encoding = "gzip"

    blob.upload_from_filename(local_path, content_type="application/x-gzip")
    print(f"Uploaded to gs://{BUCKET_NAME}/{destination_blob_name}")

def main(event, context):
    """
    Cloud Run Functions エントリポイント
    - BigQuery からデータを取得
    - SQLite / JSON 生成
    - Gzip 圧縮して GCS へアップロード
    """
    bq_client = bigquery.Client()

    # 作業用一時ディレクトリ
    with tempfile.TemporaryDirectory() as tmp_dir:
        sqlite_path = os.path.join(tmp_dir, "master.db")
        json_data = {}

        # SQLite コネクション
        conn = sqlite3.connect(sqlite_path)

        for view_name, table_name in TABLE_MAPPING.items():
            print(f"Processing {view_name} -> {table_name}...")

            # BigQuery からデータ取得
            query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{view_name}`"
            df = bq_client.query(query).to_dataframe()

            # SQLite への書き込み
            df.to_sql(table_name, conn, if_exists="replace", index=False)

            # JSON データの整形
            json_data[table_name] = df.to_dict(orient="records")

        conn.close()

        # --- 1. SQLite エクスポート ---
        sqlite_gz_path = f"{sqlite_path}.gz"
        with open(sqlite_path, 'rb') as f_in:
            with gzip.open(sqlite_gz_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        # GCS へアップロード (latest & history)
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        export_to_gcs(sqlite_gz_path, "v1/master/latest.db.gz")
        export_to_gcs(sqlite_gz_path, f"v1/master/history/{ts}.db.gz")

        # --- 2. JSON エクスポート ---
        json_path = os.path.join(tmp_dir, "master.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False)

        json_gz_path = f"{json_path}.gz"
        with open(json_path, 'rb') as f_in:
            with gzip.open(json_gz_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        export_to_gcs(json_gz_path, "v1/master/latest.json.gz")

    print("Export process completed successfully.")
    return "OK"
