import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, MapPin, ChevronRight } from 'lucide-react-native';
import { Point } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { useMasterSearch } from '../hooks/useMasterSearch';

interface PointSelectorModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (point: Point) => void;
}

const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');

export const PointSelectorModal: React.FC<PointSelectorModalProps> = ({
  isVisible,
  onClose,
  onSelect
}) => {
  const { keyword, setKeyword, points: masterPoints, isLoading } = useMasterSearch();

  useEffect(() => {
    if (isVisible) {
      setKeyword('');
    }
  }, [isVisible, setKeyword]);

  // SQLiteの結果(MasterPoint)をUIが期待するPoint型に変換
  const points = masterPoints.map(p => ({
    id: p.id,
    name: p.name,
    nameKana: p.name_kana,
    region: p.region_name || '',
    area: p.area_name || '',
    zone: p.zone_name || '',
    status: 'approved',
  } as unknown as Point));

  const renderItem = ({ item }: { item: Point }) => (
    <TouchableOpacity style={styles.item} onPress={() => onSelect(item)}>
      <ImageWithFallback
        source={item.imageUrl ? { uri: item.imageUrl } : null}
        fallbackSource={NO_IMAGE_POINT}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.locationRow}>
          <MapPin size={12} color="#64748b" />
          <Text style={styles.itemLocation}>{item.region} / {item.area}</Text>
        </View>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>スポットを選択</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="スポット名で検索..."
            value={keyword}
            onChangeText={setKeyword}
            autoFocus
          />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        ) : (
          <FlatList
            data={points}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>該当するスポットが見つかりませんでした。</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemLocation: {
    fontSize: 12,
    color: '#64748b',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});
