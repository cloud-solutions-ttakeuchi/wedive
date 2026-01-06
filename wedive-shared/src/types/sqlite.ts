export interface SQLiteRegion {
  document_id: string; // or id? usually from view it is document_id aliased or just id
  id: string;
  name: string;
  description?: string;
  type?: string;
  status?: string;
  // Flattend view columns
  region_id?: string;
  region_name?: string;
  region_description?: string;
}

export interface SQLiteZone {
  id: string;
  name: string;
  description?: string;
  region_id: string;
  type?: string;
  // Flattend view columns
  zone_id?: string;
  zone_name?: string;
  zone_description?: string;
}

export interface SQLiteArea {
  id: string;
  name: string;
  description?: string;
  zone_id: string;
  region_id?: string;
  type?: string;
  // Flattend view columns
  area_id?: string;
  area_name?: string;
  area_description?: string;
}

export interface SQLitePoint {
  id: string;
  name: string;
  name_kana?: string;
  description?: string;

  // Location hierarchy
  region?: string;
  region_name?: string;
  region_id?: string;
  area?: string;
  area_name?: string;
  area_id?: string;
  zone?: string;
  zone_name?: string;
  zone_id?: string;

  // Coordinates
  latitude?: number | string;
  longitude?: number | string;
  google_place_id?: string;
  formatted_address?: string;

  // Attributes
  level?: string;
  max_depth?: number;
  entry_type?: string;
  current_condition?: string;
  rating?: number;

  // JSON strings
  main_depth_json?: string;
  topography_json?: string; // array
  features_json?: string;   // array
  images_json?: string;     // array
  official_stats_json?: string;
  actual_stats_json?: string;

  // Images
  image_url?: string;
  image_keyword?: string;

  // Meta
  submitter_id?: string;
  bookmark_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SQLiteCreature {
  id: string;
  name: string;
  name_kana?: string;
  scientific_name?: string;
  english_name?: string;
  category?: string;
  family?: string;
  description?: string;
  rarity?: string;
  size?: string;

  // Images
  image_url?: string;
  image_credit?: string;
  image_license?: string;
  image_keyword?: string;

  // JSON strings
  tags_json?: string;
  depth_range_json?: string;
  special_attributes_json?: string;
  water_temp_range_json?: string;
  season_json?: string;
  gallery_json?: string;
  stats_json?: string;
}

export interface SQLitePointCreature {
  id: string;
  point_id: string;
  creature_id: string;
  local_rarity?: string;
  last_sighted?: string;
  reasoning?: string;
  confidence?: number;
  status?: string;
}

export interface SQLiteReview {
  id: string;
  point_id: string;
  user_id: string;
  user_name?: string;
  rating?: number;
  comment?: string;
  images_json?: string; // or just images if array in sqlite(not supported usually)
  // ... add other fields as needed
  created_at?: string;
}
