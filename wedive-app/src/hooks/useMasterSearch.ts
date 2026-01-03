import { useState, useEffect, useCallback } from 'react';
import { masterDataService } from '../services/MasterDataService';
import { Point, Creature } from '../types';

/**
 * マスターデータを爆速で検索するためのフック
 */
export function useMasterSearch() {
  const [keyword, setKeyword] = useState('');
  const [points, setPoints] = useState<Point[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 実際の検索を実行
   */
  const performSearch = useCallback(async (text: string) => {
    if (!text.trim()) {
      setPoints([]);
      setCreatures([]);
      return;
    }

    setIsLoading(true);
    try {
      // 並列で検索を実行
      const [pointResults, creatureResults] = await Promise.all([
        masterDataService.searchPoints(text),
        masterDataService.searchCreatures(text)
      ]);

      setPoints(pointResults);
      setCreatures(creatureResults);
    } catch (error) {
      console.error('Master search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * デバウンス処理
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(keyword);
    }, 200); // 200ms 入力が止まったら検索

    return () => clearTimeout(timer);
  }, [keyword, performSearch]);

  return {
    keyword,
    setKeyword,
    points,
    creatures,
    isLoading
  };
}
