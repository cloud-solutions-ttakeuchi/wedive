import { SQLiteExecutor } from '../repository/SQLiteExecutor';
import { Point, Creature } from '../types';

/**
 * Web と App で共有されるマスタデータアクセスの基本クラス
 * 固有のストレージ (SQLite / Firestore) への依存を SQLiteExecutor 経由で抽象化します。
 */
export class BaseMasterDataService {
  constructor(protected sqlite: SQLiteExecutor) { }

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

    return results.map(p => ({
      id: p.id,
      name: p.name,
      name_kana: p.name_kana,
      region: p.region_name || '',
      area: p.area_name || '',
      zone: p.zone_name || '',
      latitude: p.latitude,
      longitude: p.longitude,
      level: p.level || 'Unknown',
      status: 'approved'
    } as unknown as Point));
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
      category: c.category || '',
      status: 'approved'
    } as unknown as Creature));
  }
}
