import type { SQLiteExecutor } from '../repository/SQLiteExecutor';
import type { Point, Creature } from '../types';

/**
 * Web と App で共有されるマスタデータアクセスの基本クラス
 * 固有のストレージ (SQLite / Firestore) への依存を SQLiteExecutor 経由で抽象化します。
 */
export class BaseMasterDataService {
  protected sqlite: SQLiteExecutor;

  constructor(sqlite: SQLiteExecutor) {
    this.sqlite = sqlite;
  }

  /**
   * ポイントの高速検索 (search_text 利用)
   */
  async searchPoints(text: string, limitCount = 50): Promise<Point[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    const sql = `
      SELECT * FROM master_points
      WHERE search_text LIKE ?
      ORDER BY
        CASE
          WHEN name = ? THEN 1
          WHEN name LIKE ? THEN 2
          ELSE 3
        END,
        name ASC
      LIMIT ?
    `;

    const results = await this.sqlite.getAllAsync<any>(sql, [
      `%${normalizedQuery}%`,
      normalizedQuery,
      `${normalizedQuery}%`,
      limitCount
    ]);

    if (results.length > 0) {
      console.log('[BaseMasterData] Raw SQLite result:', results[0]);
    }

    return results.map(p => {
      const lat = p.latitude != null ? Number(p.latitude) : undefined;
      const lng = p.longitude != null ? Number(p.longitude) : undefined;
      const hasCoords = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng);

      return {
        id: p.id,
        name: p.name,
        name_kana: p.name_kana,
        region: p.region_name || p.region || '',
        area: p.area_name || p.area || '',
        zone: p.zone_name || p.zone || '',
        latitude: lat,
        longitude: lng,
        level: p.level || 'Unknown',
        maxDepth: p.max_depth,
        mainDepth: typeof p.main_depth_json === 'string' ? JSON.parse(p.main_depth_json) : p.main_depth_json,
        entryType: p.entry_type,
        current: p.current_condition,
        topography: (typeof p.topography_json === 'string' ? JSON.parse(p.topography_json) : p.topography_json) || [],
        description: p.description || '',
        features: (typeof p.features_json === 'string' ? JSON.parse(p.features_json) : p.features_json) || [],
        coordinates: hasCoords ? { lat, lng } : undefined,
        googlePlaceId: p.google_place_id,
        formattedAddress: p.formatted_address,
        imageUrl: p.image_url,
        images: (typeof p.images_json === 'string' ? JSON.parse(p.images_json) : p.images_json) || [],
        imageKeyword: p.image_keyword,
        submitterId: p.submitter_id,
        bookmarkCount: p.bookmark_count,
        officialStats: typeof p.official_stats_json === 'string' ? JSON.parse(p.official_stats_json) : p.official_stats_json,
        actualStats: typeof p.actual_stats_json === 'string' ? JSON.parse(p.actual_stats_json) : p.actual_stats_json,
        rating: p.rating,
        status: 'approved'
      } as unknown as Point;
    });
  }

  /**
   * 生物の高速検索 (search_text 利用)
   */
  async searchCreatures(text: string, limitCount = 50): Promise<Creature[]> {
    const normalizedQuery = text.trim();
    if (!normalizedQuery) return [];

    const sql = `
      SELECT * FROM master_creatures
      WHERE search_text LIKE ?
      ORDER BY
        CASE
          WHEN name = ? THEN 1
          WHEN name LIKE ? THEN 2
          ELSE 3
        END,
        name ASC
      LIMIT ?
    `;

    const results = await this.sqlite.getAllAsync<any>(sql, [
      `%${normalizedQuery}%`,
      normalizedQuery,
      `${normalizedQuery}%`,
      limitCount
    ]);

    return results.map(c => ({
      id: c.id,
      name: c.name,
      name_kana: c.name_kana,
      scientificName: c.scientific_name,
      englishName: c.english_name,
      category: c.category || '',
      family: c.family,
      description: c.description || '',
      rarity: c.rarity,
      imageUrl: c.image_url,
      tags: (typeof c.tags_json === 'string' ? JSON.parse(c.tags_json) : c.tags_json) || [],
      depthRange: typeof c.depth_range_json === 'string' ? JSON.parse(c.depth_range_json) : c.depth_range_json,
      specialAttributes: (typeof c.special_attributes_json === 'string' ? JSON.parse(c.special_attributes_json) : c.special_attributes_json) || [],
      waterTempRange: typeof c.water_temp_range_json === 'string' ? JSON.parse(c.water_temp_range_json) : c.water_temp_range_json,
      size: c.size,
      season: (typeof c.season_json === 'string' ? JSON.parse(c.season_json) : c.season_json) || [],
      gallery: (typeof c.gallery_json === 'string' ? JSON.parse(c.gallery_json) : c.gallery_json) || [],
      stats: typeof c.stats_json === 'string' ? JSON.parse(c.stats_json) : c.stats_json,
      imageCredit: c.image_credit,
      imageLicense: c.image_license,
      imageKeyword: c.image_keyword,
      status: 'approved'
    } as unknown as Creature));
  }
}
