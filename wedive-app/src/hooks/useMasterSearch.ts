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
  const [reviews, setReviews] = useState<any[]>([]);
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
      const [pointResults, creatureResults, reviewResults] = await Promise.all([
        masterDataService.searchPoints(text),
        masterDataService.searchCreatures(text),
        masterDataService.searchReviews(text)
      ]);

      setPoints(pointResults);
      setCreatures(creatureResults);
      setReviews(reviewResults);
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
    reviews,
    isLoading
  };
}
