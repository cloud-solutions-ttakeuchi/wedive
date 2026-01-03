
CREATE TABLE IF NOT EXISTS `${PROJECT_ID}.${DATASET}.creatures_enriched` (
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
);
