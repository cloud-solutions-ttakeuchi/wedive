import type { Creature, Point, PointCreature, Review, Region, Zone, Area } from '../types';
import type { SQLitePoint, SQLiteCreature, SQLitePointCreature, SQLiteReview } from '../types/sqlite';

// Helper to safely parse JSON
const safeParse = <T>(json: string | undefined | null, fallback: T): T => {
  if (!json || typeof json !== 'string') return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed === null ? fallback : parsed;
  } catch (e) {
    console.warn('Failed to parse JSON:', json);
    return fallback;
  }
};

// Helper to safely parse numbers
const safeNumber = (val: string | number | undefined | null): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
};

export const mapPointFromSQLite = (row: SQLitePoint): Point => {
  const lat = safeNumber(row.latitude);
  const lng = safeNumber(row.longitude);
  const hasCoords = lat !== undefined && lng !== undefined;

  return {
    id: row.id,
    name: row.name,
    name_kana: row.name_kana,

    // Hierarchy
    regionId: row.region_id || '',
    zoneId: row.zone_id || '',
    areaId: row.area_id || '',
    region: row.region_name || row.region || '',
    area: row.area_name || row.area || '',
    zone: row.zone_name || row.zone || '',

    // Location
    latitude: lat,
    longitude: lng,
    coordinates: hasCoords ? { lat: lat!, lng: lng! } : undefined,
    googlePlaceId: row.google_place_id,
    formattedAddress: row.formatted_address,

    // Attributes
    level: (row.level as any) || 'Unknown',
    maxDepth: row.max_depth || 0,
    mainDepth: safeParse(row.main_depth_json, undefined),
    entryType: (row.entry_type as any) || 'boat',
    current: (row.current_condition as any) || 'none',

    // Content
    description: row.description || '',
    topography: safeParse(row.topography_json, []),
    features: safeParse(row.features_json, []),

    // Images
    imageUrl: row.image_url || '',
    images: safeParse(row.images_json, []),
    imageKeyword: row.image_keyword,

    // Meta
    submitterId: row.submitter_id || 'system',
    bookmarkCount: row.bookmark_count || 0,
    status: 'approved', // Master data is always approved
    createdAt: row.created_at || new Date().toISOString(),

    // Stats
    officialStats: safeParse(row.official_stats_json, undefined),
    actualStats: safeParse(row.actual_stats_json, undefined),
    rating: row.rating
  };
};

export const mapCreatureFromSQLite = (row: SQLiteCreature): Creature => {
  return {
    id: row.id,
    name: row.name,
    name_kana: row.name_kana,
    scientificName: row.scientific_name,
    englishName: row.english_name,
    category: row.category || '',
    family: row.family,
    description: row.description || '',
    rarity: (row.rarity as any) || 'Common',
    size: row.size,

    imageUrl: row.image_url || '',
    imageCredit: row.image_credit,
    imageLicense: row.image_license,
    imageKeyword: row.image_keyword,

    tags: safeParse(row.tags_json, []),
    depthRange: safeParse(row.depth_range_json, undefined),
    specialAttributes: safeParse(row.special_attributes_json, []),
    waterTempRange: safeParse(row.water_temp_range_json, undefined),
    season: safeParse(row.season_json, []),
    gallery: safeParse(row.gallery_json, []),
    stats: safeParse(row.stats_json, undefined),

    status: 'approved'
  };
};

export const mapPointCreatureFromSQLite = (row: SQLitePointCreature): PointCreature => {
  return {
    id: row.id,
    pointId: row.point_id,
    creatureId: row.creature_id,
    localRarity: (row.local_rarity as any) || 'Common',
    lastSighted: row.last_sighted,
    reasoning: row.reasoning,
    confidence: row.confidence,
    status: 'approved'
  };
};

export const mapReviewFromSQLite = (row: SQLiteReview): Review => {
  return {
    ...row as any, // Temporary spread for fields that match exactly
    id: row.id,
    pointId: row.point_id,
    userId: row.user_id,
    userName: row.user_name || 'Anonymous',
    rating: row.rating || 0,
    comment: row.comment || '',
    status: 'approved',
    // We might need more robust mapping here if Review structure gets complex
  };
};

export const mapGeographyFromFlattenedSQLite = (rows: any[]): { regions: Region[], zones: Zone[], areas: Area[] } => {
  const uniqueRegions = new Map<string, Region>();
  const uniqueZones = new Map<string, Zone>();
  const uniqueAreas = new Map<string, Area>();

  rows.forEach(row => {
    // Adapter logic to handle snake_case from View
    const rId = row.region_id;
    const rName = row.region_name;
    const rDesc = row.region_description;

    const zId = row.zone_id;
    const zName = row.zone_name;
    const zDesc = row.zone_description;

    const aId = row.area_id; // Usually document_id aliased
    const aName = row.area_name;
    const aDesc = row.area_description;

    if (rId && !uniqueRegions.has(rId)) {
      uniqueRegions.set(rId, { id: rId, name: rName, description: rDesc });
    }
    if (zId && !uniqueZones.has(zId)) {
      uniqueZones.set(zId, { id: zId, name: zName, regionId: rId, description: zDesc });
    }
    if (aId && !uniqueAreas.has(aId)) {
      uniqueAreas.set(aId, { id: aId, name: aName, zoneId: zId, regionId: rId, description: aDesc });
    }
  });

  return {
    regions: Array.from(uniqueRegions.values()),
    zones: Array.from(uniqueZones.values()),
    areas: Array.from(uniqueAreas.values())
  };
};
