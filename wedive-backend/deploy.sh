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
bq --location=$LOCATION query --use_legacy_sql=false "CREATE TABLE IF NOT EXISTS \`$PROJECT_ID.$DATASET.points_enriched\` (
    id STRING,
    name STRING,
    name_kana STRING,
    updated_at TIMESTAMP
)"
bq --location=$LOCATION query --use_legacy_sql=false "CREATE TABLE IF NOT EXISTS \`$PROJECT_ID.$DATASET.creatures_enriched\` (
    id STRING,
    name STRING,
    name_kana STRING,
    scientificName STRING,
    scientificName_kana STRING,
    englishName STRING,
    englishName_kana STRING,
    family STRING,
    family_kana STRING,
    category STRING,
    category_kana STRING,
    search_text STRING,
    updated_at TIMESTAMP
)"

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
CONVERTER_URL=$(gcloud functions describe kana-converter --project=$PROJECT_ID --region=$LOCATION --gen2 --format='value(serviceConfig.uri)')
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
    sql_content=$(sed "s/\`wedive_master_data_v1/\`$PROJECT_ID.$DATASET/g" "$file")
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
