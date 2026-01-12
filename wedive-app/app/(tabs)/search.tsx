import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, FlatList, Dimensions, ActivityIndicator, Platform, BackHandler } from 'react-native';
import { Text, View } from '@/components/Themed';
import { Search as SearchIcon, MapPin, Star, ChevronRight, Anchor, BookOpen, Clock, Plus as PlusIcon, ArrowLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Point, Creature } from '../../src/types';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';
import { useMasterSearch } from '../../src/hooks/useMasterSearch';
import { masterDataService } from '../../src/services/MasterDataService';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');
const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');

type SearchMode = 'spots' | 'creatures' | 'logs';
type NavLevel = 'root' | 'region' | 'zone' | 'area';

interface NavItem {
  type: NavLevel;
  id?: string;
  name: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams();
  const [mode, setMode] = useState<SearchMode>((tab as SearchMode) || 'spots');

  // 爆速検索フック！
  const { keyword, setKeyword, points: masterPoints, creatures: masterCreatures, isLoading: isSearchLoading } = useMasterSearch();

  // 階層ナビゲーション用State
  const [navStack, setNavStack] = useState<NavItem[]>([{ type: 'root', name: 'エリア選択' }]);
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [isHierarchyLoading, setIsHierarchyLoading] = useState(false);

  useEffect(() => {
    if (tab && ['spots', 'creatures', 'logs'].includes(tab as string)) {
      setMode(tab as SearchMode);
    }
  }, [tab]);

  // Android Back Button handling for custom navigation
  useEffect(() => {
    const backAction = () => {
      if (!keyword && mode === 'spots' && navStack.length > 1) {
        setNavStack(prev => prev.slice(0, -1));
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [keyword, mode, navStack]);

  // 階層データのロード (検索ワードがない時のみ)
  useEffect(() => {
    if (mode === 'spots' && !keyword) {
      const current = navStack[navStack.length - 1];
      const loadData = async () => {
        setIsHierarchyLoading(true);
        try {
          let data: any[] = [];
          if (current.type === 'root') {
            data = await masterDataService.getRegions();
          } else if (current.type === 'region') {
            data = await masterDataService.getZones(current.id);
          } else if (current.type === 'zone') {
            data = await masterDataService.getAreas(current.id);
          } else if (current.type === 'area') {
            // ポイント一覧
            const points = await masterDataService.getPointsByArea(current.id!);
            // マッピング済みのPointが返ってくる
            data = points;
          }
          setHierarchyData(data);
        } catch (e) {
          console.error(e);
        } finally {
          setIsHierarchyLoading(false);
        }
      };
      loadData();
    }
  }, [navStack, mode, keyword]);


  // マスターデータをUI用のPoint型にマッピング (検索時)
  const filteredSpots = masterPoints.map(p => ({
    ...p,
    region: (p as any).region_name || '',
    area: (p as any).area_name || '',
    zone: (p as any).zone_name || '',
    status: 'approved',
  } as unknown as Point));

  const filteredCreatures = masterCreatures.map(c => ({
    ...c,
    status: 'approved',
  } as unknown as Creature));

  const handleNavBack = () => {
    if (navStack.length > 1) {
      setNavStack(prev => prev.slice(0, -1));
    }
  };

  const handleItemPress = (item: any) => {
    const current = navStack[navStack.length - 1];
    if (current.type === 'root') {
      setNavStack([...navStack, { type: 'region', id: item.id, name: item.name }]);
    } else if (current.type === 'region') {
      setNavStack([...navStack, { type: 'zone', id: item.id, name: item.name }]);
    } else if (current.type === 'zone') {
      setNavStack([...navStack, { type: 'area', id: item.id, name: item.name }]);
    } else if (current.type === 'area') {
      // ポイント詳細へ
      router.push(`/details/spot/${item.id}`);
    }
  };

  const renderNavHeader = () => {
    if (Boolean(keyword) || mode !== 'spots' || navStack.length === 1) return null;
    return (
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={handleNavBack} style={styles.navBackBtn}>
          <ArrowLeft size={20} color="#1e293b" />
          <Text style={styles.navBackText}>{navStack[navStack.length - 2].name}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {navStack[navStack.length - 1].name}
        </Text>
      </View>
    );
  };

  const renderHierarchyItem = ({ item }: { item: any }) => {
    // 最終階層（ポイント）の場合
    if (navStack[navStack.length - 1].type === 'area') {
      return renderSpotItem({ item });
    }

    // 階層メニューアイテム
    return (
      <TouchableOpacity style={styles.navItem} onPress={() => handleItemPress(item)}>
        <Text style={styles.navItemText}>{item.name}</Text>
        <ChevronRight size={20} color="#cbd5e1" />
      </TouchableOpacity>
    );
  };

  const renderSpotItem = ({ item }: { item: Point }) => (
    <TouchableOpacity
      style={styles.spotCard}
      onPress={() => router.push(`/details/spot/${item.id}`)}
    >
      <View style={{ position: 'relative' }}>
        <ImageWithFallback
          source={item.imageUrl ? { uri: item.imageUrl } : (item.images && item.images.length > 0 ? { uri: item.images[0] } : null)}
          fallbackSource={NO_IMAGE_POINT}
          style={styles.spotImage}
        />
        {item.status === 'pending' && (
          <View style={styles.pendingBadge}>
            <Clock size={10} color="#fff" />
            <Text style={styles.pendingText}>提案中</Text>
          </View>
        )}
      </View>
      <View style={styles.spotInfo}>
        <View style={styles.row}>
          <Text style={styles.spotName}>{item.name}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{item.level || 'Unknown'}</Text>
          </View>
        </View>
        <View style={styles.locationRow}>
          <MapPin size={12} color="#64748b" />
          <Text style={styles.locationText}>{item.region || navStack.find(n => n.type === 'region')?.name} • {item.area || navStack.find(n => n.type === 'area')?.name}</Text>
        </View>
        <View style={styles.featuresRow}>
          {item.features && item.features.map((f, i) => (
            <View key={i} style={styles.featureTag}>
              <Text style={styles.featureText}>#{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCreatureItem = ({ item }: { item: Creature }) => (
    <TouchableOpacity
      style={styles.creatureCard}
      onPress={() => router.push(`/details/creature/${item.id}`)}
    >
      <View style={{ position: 'relative' }}>
        <ImageWithFallback
          source={item.imageUrl ? { uri: item.imageUrl } : null}
          fallbackSource={NO_IMAGE_CREATURE}
          style={styles.creatureImage}
        />
        {item.status === 'pending' && (
          <View style={styles.pendingBadge}>
            <Clock size={10} color="#fff" />
            <Text style={styles.pendingText}>提案中</Text>
          </View>
        )}
      </View>
      <View style={styles.creatureContent}>
        <View style={styles.creatureInfo}>
          <Text style={styles.creatureCategory}>{item.category}</Text>
          <Text style={styles.creatureName}>{item.name}</Text>
        </View>
        <View style={styles.rarityBadge}>
          <Star size={10} color="#fbbf24" fill="#fbbf24" />
          <Text style={styles.rarityValue}>{item.rarity || 'Common'}</Text>
        </View>
      </View>
      <ChevronRight size={16} color="#cbd5e1" />
    </TouchableOpacity>
  );

  const renderLogItem = ({ item }: { item: any }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>ログ機能は準備中です</Text>
    </View>
  );

  // 表示データの切り替え
  let dataToRender: any[] = [];
  let isLoading = isSearchLoading;
  let ItemRenderer: any = renderSpotItem;

  if (Boolean(keyword)) {
    // 検索モード
    if (mode === 'spots') {
      dataToRender = filteredSpots;
      ItemRenderer = renderSpotItem;
    } else if (mode === 'creatures') {
      dataToRender = filteredCreatures;
      ItemRenderer = renderCreatureItem;
    }
  } else {
    // 階層ブラウズモード (spotsのみ)
    if (mode === 'spots') {
      isLoading = isHierarchyLoading;
      dataToRender = hierarchyData;
      ItemRenderer = renderHierarchyItem;
    } else if (mode === 'creatures') {
      // 生物はまだ階層がないので空または検索推奨
      // 必要なら生物分類階層を実装するが、今回はPointのみ
      isLoading = false;
      dataToRender = [];
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>探す</Text>
          {mode !== 'logs' && (
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => router.push(mode === 'spots' ? '/details/spot/add' : '/details/creature/add')}
            >
              <PlusIcon size={20} color="#0ea5e9" />
              <Text style={styles.headerAddText}>{mode === 'spots' ? 'ポイント登録' : '生物登録'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.searchBox}>
          <SearchIcon size={20} color="#94a3b8" />
          <TextInput
            style={styles.input}
            placeholder={mode === 'spots' ? "ポイントを検索..." : mode === 'creatures' ? "生物を検索..." : "ログを検索..."}
            value={keyword || ''}
            onChangeText={setKeyword}
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'spots' && styles.activeModeBtn]}
            onPress={() => setMode('spots')}
          >
            <MapPin size={16} color={mode === 'spots' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeText, mode === 'spots' && styles.activeModeText]}>ポイント</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'creatures' && styles.activeModeBtn]}
            onPress={() => setMode('creatures')}
          >
            <Anchor size={16} color={mode === 'creatures' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeText, mode === 'creatures' && styles.activeModeText]}>生物</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'logs' && styles.activeModeBtn]}
            onPress={() => setMode('logs')}
          >
            <BookOpen size={16} color={mode === 'logs' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeText, mode === 'logs' && styles.activeModeText]}>ログ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderNavHeader()}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={dataToRender}
          renderItem={dataToRender.length > 0 ? ItemRenderer : () => null}
          keyExtractor={item => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {mode === 'spots' && !keyword && navStack.length === 1
                  ? 'エリアデータが見つかりません'
                  : '見つかりませんでした'}
              </Text>
              {mode !== 'logs' && (
                <TouchableOpacity
                  style={styles.addProposalBtn}
                  onPress={() => router.push(mode === 'spots' ? '/details/spot/add' : '/details/creature/add')}
                >
                  <Text style={styles.addProposalText}>
                    新しい{mode === 'spots' ? 'ポイント' : '生物'}を登録する
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  navBackText: {
    color: '#64748b',
    fontSize: 14,
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navItemText: {
    fontSize: 16,
    color: '#334155',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerAddText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 16,
    color: '#1e293b',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  activeModeBtn: {
    backgroundColor: '#0ea5e9',
  },
  modeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
  },
  activeModeText: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  spotImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  spotInfo: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  spotName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  levelBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  locationText: {
    fontSize: 13,
    color: '#64748b',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  featureTag: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featureText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  creatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  creatureContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: 'transparent',
  },
  creatureInfo: {
    backgroundColor: 'transparent',
  },
  creatureCategory: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 2,
  },
  creatureName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
  },
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rarityValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  addProposalBtn: {
    marginTop: 16,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addProposalText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  pendingText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});
