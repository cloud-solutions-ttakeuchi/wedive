#!/bin/bash

# Configuration
PROJECT_ID="we-dive"
DATASET_ID="wedive_master_data_v1"

# List of collections to import
# Note: 'raw' suffix is not needed here, the tool handles it or we specify the table name.
# The previous view definitions used tables like `areas_raw_latest`.
# Usually the extension creates tables with `_raw_changelog` suffix for updates,
# and this import tool creates `_raw_changelog` compatible entries or just imports to a table.
# Let's align with the conventions. The import tool asks for "identifying prefix".
# If we give "points", it creates "points_raw_changelog".
# So we should match the COLLECTION names with the TABLE PREFIXES.

COLLECTIONS=(
  "areas"
  "zones"
  "regions"
  "points"
  "creatures"
  "point_creatures"
  "users"
  "agencies"
)

echo "Starting bulk import to BigQuery for Project: $PROJECT_ID, Dataset: $DATASET_ID"
echo "Collections to process: ${COLLECTIONS[*]}"
echo "---------------------------------------------------"

for COL in "${COLLECTIONS[@]}"; do
  echo ">>> Processing Collection: $COL"

  # Check if we should use a different table prefix? Assume Table Prefix = Collection Name
  TABLE_PREFIX="$COL"

  echo "    Importing '$COL' into BigQuery table with prefix '$TABLE_PREFIX'..."

  # Run the import tool in non-interactive mode
  # --source-collection-path: Firestore path
  # --dataset: BigQuery dataset
  # --table-name-prefix: The prefix for the table (e.g. 'points' -> 'points_raw_changelog')
  # --batch-size: Number of documents to read at once (optional)
  # --multi-threaded: Use multiple threads (optional)

  npx @firebaseextensions/fs-bq-import-collection \
    --non-interactive \
    --project "$PROJECT_ID" \
    --source-collection-path "$COL" \
    --dataset "$DATASET_ID" \
    --table-name-prefix "$TABLE_PREFIX" \
    --query-collection-group "true" \
    --dataset-location "asia-northeast1" \
    --batch-size 1000 \
    --multi-threaded > /dev/null

    # Note: Redirecting stdout to /dev/null to reduce noise, errors will still show.
    # Remove > /dev/null if you want detailed progress.

  if [ $? -eq 0 ]; then
    echo ">>> Successfully imported: $COL"
  else
    echo "!!! Failed to import: $COL"
  fi

  echo "---------------------------------------------------"
done

echo "Bulk import completed."
