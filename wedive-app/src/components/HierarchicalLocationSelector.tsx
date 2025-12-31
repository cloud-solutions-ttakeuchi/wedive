import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronRight, Check, Plus, Edit2 } from 'lucide-react-native';
import { Region, Zone, Area } from '../types';

interface SelectionResult {
  region: string;
  regionId: string;
  zone: string;
  zoneId: string;
  area: string;
  areaId: string;
}

interface HierarchicalLocationSelectorProps {
  isVisible: boolean;
  onClose: () => void;
  regions: Region[];
  zones: Zone[];
  areas: Area[];
  onSelect: (selection: SelectionResult) => void;
  initialSelection?: {
    region?: string;
    zone?: string;
    area?: string;
  };
}

export const HierarchicalLocationSelector: React.FC<HierarchicalLocationSelectorProps> = ({
  isVisible,
  onClose,
  regions,
  zones,
  areas,
  onSelect,
  initialSelection
}) => {
  const [step, setStep] = useState<'region' | 'zone' | 'area'>('region');
  const [selectedRegion, setSelectedRegion] = useState<{ id: string, name: string } | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ id: string, name: string } | null>(null);

  const [manualInput, setManualInput] = useState('');
  const [isManual, setIsManual] = useState(false);

  const insets = useSafeAreaInsets();

  // 1. Filtered Zones
  const filteredZones = useMemo(() => {
    if (!selectedRegion) return [];
    return zones.filter(z => z.regionId === selectedRegion.id);
  }, [zones, selectedRegion]);

  // 2. Filtered Areas
  const filteredAreas = useMemo(() => {
    if (!selectedZone) return [];
    return areas.filter(a => a.zoneId === selectedZone.id);
  }, [areas, selectedZone]);

  const handleRegionSelect = (region: Region) => {
    setSelectedRegion({ id: region.id, name: region.name });
    setStep('zone');
    setIsManual(false);
    setManualInput('');
  };

  const handleZoneSelect = (zone: Zone) => {
    setSelectedZone({ id: zone.id, name: zone.name });
    setStep('area');
    setIsManual(false);
    setManualInput('');
  };

  const handleAreaSelect = (area: Area) => {
    onSelect({
      region: selectedRegion?.name || '',
      regionId: selectedRegion?.id || '',
      zone: selectedZone?.name || '',
      zoneId: selectedZone?.id || '',
      area: area.name,
      areaId: area.id
    });
    onClose();
  };

  const handleManualSubmit = () => {
    const input = manualInput.trim();
    if (!input) return;

    if (step === 'region') {
      setSelectedRegion({ id: `custom_${Date.now()}`, name: input });
      setStep('zone');
    } else if (step === 'zone') {
      setSelectedZone({ id: `custom_${Date.now()}`, name: input });
      setStep('area');
    } else {
      onSelect({
        region: selectedRegion?.name || '',
        regionId: selectedRegion?.id || '',
        zone: selectedZone?.name || '',
        zoneId: selectedZone?.id || '',
        area: input,
        areaId: `custom_${Date.now()}`
      });
      onClose();
    }
    setManualInput('');
    setIsManual(false);
  };

  const reset = () => {
    setStep('region');
    setSelectedRegion(null);
    setSelectedZone(null);
    setIsManual(false);
    setManualInput('');
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (isManual) setIsManual(false);
            else if (step === 'area') setStep('zone');
            else if (step === 'zone') setStep('region');
            else onClose();
          }} style={styles.backBtn}>
            <Text style={styles.headerBtnText}>{step === 'region' && !isManual ? '閉じる' : '戻る'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isManual ? '手入力' : (step === 'region' ? '地域を選択' : step === 'zone' ? 'エリアを選択' : '場所を選択')}
          </Text>
          <TouchableOpacity onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>クリア</Text>
          </TouchableOpacity>
        </View>

        {isManual ? (
          <View style={styles.manualContainer}>
            <Text style={styles.manualLabel}>
              {step === 'region' ? '地域名を入力' : step === 'zone' ? 'エリア名を入力' : '場所名を入力'}
            </Text>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="ここに入力..."
              autoFocus
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit}>
              <Text style={styles.submitBtnText}>確定</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.breadcrumb}>
              <Text style={styles.breadcrumbText}>
                {selectedRegion ? selectedRegion.name : '未選択'}
                {selectedZone ? ` > ${selectedZone.name}` : ''}
              </Text>
            </View>

            {step === 'region' && regions.map(r => (
              <TouchableOpacity key={r.id} style={styles.item} onPress={() => handleRegionSelect(r)}>
                <Text style={styles.itemText}>{r.name}</Text>
                <ChevronRight size={20} color="#cbd5e1" />
              </TouchableOpacity>
            ))}

            {step === 'zone' && filteredZones.map(z => (
              <TouchableOpacity key={z.id} style={styles.item} onPress={() => handleZoneSelect(z)}>
                <Text style={styles.itemText}>{z.name}</Text>
                <ChevronRight size={20} color="#cbd5e1" />
              </TouchableOpacity>
            ))}

            {step === 'area' && filteredAreas.map(a => (
              <TouchableOpacity key={a.id} style={styles.item} onPress={() => handleAreaSelect(a)}>
                <Text style={styles.itemText}>{a.name}</Text>
                <Check size={20} color="#0ea5e9" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.manualToggle} onPress={() => setIsManual(true)}>
              <Edit2 size={18} color="#64748b" />
              <Text style={styles.manualToggleText}>
                {step === 'region' ? 'リストにない地域を入力' : step === 'zone' ? 'リストにないエリアを入力' : 'リストにない場所を入力'}
              </Text>
            </TouchableOpacity>

            {(step === 'region' && regions.length === 0) ||
              (step === 'zone' && filteredZones.length === 0) ||
              (step === 'area' && filteredAreas.length === 0) ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>既存の候補がありません。手入力してください。</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  headerBtnText: { fontSize: 16, color: '#0ea5e9' },
  resetBtnText: { fontSize: 14, color: '#94a3b8' },
  backBtn: { padding: 4 },
  resetBtn: { padding: 4 },
  content: { flex: 1 },
  breadcrumb: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  breadcrumbText: { fontSize: 13, color: '#94a3b8' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  itemText: { fontSize: 16, color: '#1e293b' },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc'
  },
  manualToggleText: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  manualContainer: { padding: 24 },
  manualLabel: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  manualInput: {
    fontSize: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#0ea5e9',
    paddingVertical: 8,
    color: '#1e293b',
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', textAlign: 'center' }
});
