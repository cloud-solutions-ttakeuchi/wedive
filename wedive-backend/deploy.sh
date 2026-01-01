#!/bin/bash

# WeDive Backend Deployment Script
# Usage: ./deploy.sh [PROJECT_ID]

PROJECT_ID=$1
if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./deploy.sh [PROJECT_ID]"
    exit 1
fi

LOCATION="asia-northeast1"
DATASET="wedive_master_data_v1"
BUCKET="wedive-app-static-master"

echo "Using Project ID: $PROJECT_ID"

# 1. Create Dataset & Bucket
echo "Creating/Checking BigQuery Dataset and GCS Bucket..."
bq mk --location=$LOCATION --dataset $PROJECT_ID:$DATASET || true
gsutil mb -l $LOCATION gs://$BUCKET || true

# [NEW] Create Enriched Tables (Schema Definition)
echo "Creating Enriched Tables..."
bq query --use_legacy_sql=false "CREATE TABLE IF NOT EXISTS \`$PROJECT_ID.$DATASET.points_enriched\` (id STRING, name STRING, name_kana STRING, updated_at TIMESTAMP)"
bq query --use_legacy_sql=false "CREATE TABLE IF NOT EXISTS \`$PROJECT_ID.$DATASET.creatures_enriched\` (id STRING, name STRING, name_kana STRING, search_text STRING, updated_at TIMESTAMP)"

# 2. Deploy Kana Converter (Cloud Run Functions)
echo "Deploying kana-converter function..."
cd functions/kana-converter
gcloud functions deploy fn_to_kana \
    --gen2 \
    --runtime=python310 \
    --region=$LOCATION \
    --trigger-http \
    --allow-unauthenticated
cd ../..

# 3. Create BigQuery Remote Function (Requires manual intervention or specific Terraform)
echo "NOTE: BigQuery Remote Function 'fn_to_kana' needs to be registered."
echo "Please run the SQL in bigquery/create_remote_function.sql after deployment."

# 4. Deploy VIEWs
echo "Deploying BigQuery VIEWs..."
for file in bigquery/views/*.sql; do
    view_name=$(basename "$file" .sql)
    echo "Creating VIEW: $view_name"
    # カラム名とデータセット名をプロジェクトIDに合わせて置換
    sql_content=$(sed "s/\`wedive_master_data_v1/\`$PROJECT_ID.$DATASET/g" "$file")
    bq query --use_legacy_sql=false "CREATE OR REPLACE VIEW \`$PROJECT_ID.$DATASET.$view_name\` AS $sql_content"
done

# 5. Deploy Exporter (Cloud Run Functions)
echo "Deploying master-data-exporter function..."
cd functions/exporter
gcloud functions deploy master-data-exporter \
    --gen2 \
    --runtime=python310 \
    --region=$LOCATION \
    --trigger-event=google.pubsub.topic.publish \
    --trigger-resource=master-data-export-trigger \
    --set-env-vars GCP_PROJECT=$PROJECT_ID,BQ_DATASET=$DATASET,GCS_BUCKET=$BUCKET
cd ../..

echo "Deployment completed!"
