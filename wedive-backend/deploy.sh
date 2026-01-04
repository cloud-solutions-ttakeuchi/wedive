#!/bin/bash

# WeDive Backend Deployment Script
# Usage: ./deploy.sh [PROJECT_ID]

export PROJECT_ID=$1
export LOCATION="asia-northeast1"
export DATASET="wedive_master_data_v1"
export BUCKET="wedive-app-static-master"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./deploy.sh [PROJECT_ID]"
    exit 1
fi

echo "Using Project ID: $PROJECT_ID"

# 1. Create Dataset & Bucket
echo "Creating/Checking BigQuery Dataset and GCS Bucket..."
bq mk --location=$LOCATION --dataset $PROJECT_ID:$DATASET || true
gsutil mb -l $LOCATION gs://$BUCKET || true

# [NEW] Create Tables (Managed Schemas)
echo "Deploying BigQuery Tables..."
for file in bigquery/tables/*.sql; do
    table_name=$(basename "$file" .sql)
    echo "Deploying Table: $table_name"
    # envsubst を使用して SQL 内の変数を展開
    sql_content=$(envsubst < "$file")
    bq query --use_legacy_sql=false "$sql_content"
done

# 2. Deploy Kana Converter (Standard Web API)
echo "Deploying kana-converter function..."
cd functions/kana-converter
gcloud functions deploy kana-converter \
    --gen2 \
    --entry-point=fn_to_kana \
    --runtime=python310 \
    --region=$LOCATION \
    --trigger-http \
    --project=$PROJECT_ID \
    --memory=1Gi \
    --allow-unauthenticated
# URLを取得
export CONVERTER_URL=$(gcloud functions describe kana-converter --project=$PROJECT_ID --region=$LOCATION --gen2 --format='value(serviceConfig.uri)')
cd ../..

# 3. Deploy Enricher (Scheduled Job)
echo "Deploying master-data-enricher function..."
cd functions/enricher
gcloud functions deploy master-data-enricher \
    --gen2 \
    --entry-point=main \
    --runtime=python310 \
    --region=$LOCATION \
    --trigger-http \
    --project=$PROJECT_ID \
    --memory=512Mi \
    --set-env-vars GCP_PROJECT=$PROJECT_ID,BQ_DATASET=$DATASET,CONVERTER_URL=$CONVERTER_URL
cd ../..

# 4. Deploy VIEWs
echo "Deploying BigQuery VIEWs..."
for file in bigquery/views/*.sql; do
    view_name=$(basename "$file" .sql)
    echo "Creating VIEW: $view_name"

    # envsubst を使用して SQL 内の変数を展開
    sql_content=$(envsubst < "$file")
    bq query --use_legacy_sql=false "CREATE OR REPLACE VIEW \`$PROJECT_ID.$DATASET.$view_name\` AS $sql_content"
done

# 5. Deploy Exporter
echo "Deploying master-data-exporter function..."
cd functions/exporter
gcloud functions deploy master-data-exporter \
    --gen2 \
    --entry-point=main \
    --runtime=python310 \
    --region=$LOCATION \
    --trigger-http \
    --project=$PROJECT_ID \
    --memory=512Mi \
    --set-env-vars GCP_PROJECT=$PROJECT_ID,BQ_DATASET=$DATASET,GCS_BUCKET=$BUCKET
cd ../..

echo "--------------------------------------------------"
echo "Deployment completed!"
echo "Next Steps:"
echo "1. Setup Cloud Scheduler to trigger 'master-data-enricher' (e.g., every 1 hour)"
echo "2. Setup Cloud Scheduler to trigger 'master-data-exporter' (e.g., after enricher)"
echo "--------------------------------------------------"
