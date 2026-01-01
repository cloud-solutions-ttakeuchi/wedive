import os
import requests
import json
from google.cloud import bigquery
from datetime import datetime

# 設定
PROJECT_ID = os.environ.get("GCP_PROJECT")
DATASET_ID = os.environ.get("BQ_DATASET", "wedive_master_data_v1")
CONVERTER_URL = os.environ.get("CONVERTER_URL") # kana-converter のエンドポイント

def run_enrichment_for_table(bq_client, source_table, enriched_table, fields=["name"]):
    """特定のテーブルに対して増分エンリッチメントを実行する"""
    print(f"Checking enrichment for {source_table}...")

    # 1. 変換が必要なレコードを抽出（新規 または 前回エンリッチ時から名前等が変わったもの）
    field_select = ", ".join([f"JSON_VALUE(s.data, '$.{f}') as {f}" for f in fields])
    change_conditions = " OR ".join([f"t.{f} != JSON_VALUE(s.data, '$.{f}')" for f in fields])

    query = f"""
        SELECT s.document_id AS id, {field_select}
        FROM `{PROJECT_ID}.{DATASET_ID}.{source_table}` s
        LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.{enriched_table}` t ON s.document_id = t.id
        WHERE t.id IS NULL OR {change_conditions}
        LIMIT 1000
    """
    df = bq_client.query(query).to_dataframe()

    if df.empty:
        print(f"No changes detected for {source_table}.")
        return

    # 2. kana-converter API を呼び出し (一括 JSON)
    items = df.to_dict(orient="records")
    print(f"Requesting conversion for {len(items)} items from {source_table}...")

    try:
        response = requests.post(CONVERTER_URL, json={"items": items}, timeout=60)
        response.raise_for_status()
        converted_items = response.json().get("results", [])
    except Exception as e:
        print(f"Error calling converter: {e}")
        return

    # 3. 必要に応じて追加ロジック（search_text の組み立てなど）を適用
    if source_table == "creatures_raw_latest":
        for item in converted_items:
            # name, name_kana, scientificName, englishName, family, category など全属性を結合
            # ※ Converter は元の値も返してくる前提
            search_parts = []
            for k in fields:
                val = item.get(k, "")
                kana = item.get(f"{k}_kana", "")
                if val: search_parts.append(str(val))
                if kana: search_parts.append(str(kana))
            item["search_text"] = " ".join(search_parts)

    # 4. 結果を BigQuery に反映（一時テーブル経由で MERGE）
    job_config = bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE")
    temp_table_id = f"{PROJECT_ID}.{DATASET_ID}.tmp_{source_table}_results"
    bq_client.load_table_from_json(converted_items, temp_table_id, job_config=job_config).result()

    # スキーマに応じた MERGE SQL
    # すべての変換済みフィールドとそのカナを保存
    set_clauses = []
    insert_fields = ["id", "updated_at"]
    insert_values = ["s.id", "CURRENT_TIMESTAMP()"]

    for k in fields:
        set_clauses.append(f"t.{k} = s.{k}")
        set_clauses.append(f"t.{k}_kana = s.{k}_kana")
        insert_fields.extend([k, f"{k}_kana"])
        insert_values.extend([f"s.{k}", f"s.{k}_kana"])

    if "search_text" in converted_items[0]:
        set_clauses.append("t.search_text = s.search_text")
        insert_fields.append("search_text")
        insert_values.append("s.search_text")

    merge_query = f"""
    MERGE `{PROJECT_ID}.{DATASET_ID}.{enriched_table}` t
    USING `{temp_table_id}` s
    ON t.id = s.id
    WHEN MATCHED THEN
      UPDATE SET {", ".join(set_clauses)}, updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT ({", ".join(insert_fields)}) VALUES ({", ".join(insert_values)})
    """

    bq_client.query(merge_query).result()
    print(f"Successfully enriched {len(converted_items)} records in {enriched_table}.")

def main(request):
    """Cloud Run Functions エントリポイント (HTTPトリガー)"""
    bq_client = bigquery.Client()
    if not CONVERTER_URL:
        print("Error: CONVERTER_URL environment variable is not set.")
        return

    # ポイント: 名前のみ
    run_enrichment_for_table(bq_client, "points_raw_latest", "points_enriched", ["name"])

    # 生物: 全属性
    run_enrichment_for_table(bq_client, "creatures_raw_latest", "creatures_enriched",
                             ["name", "scientificName", "englishName", "family", "category"])

    return "OK"
