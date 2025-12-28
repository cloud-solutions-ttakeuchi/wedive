import { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, FlatList, Dimensions, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Sun, Cloud, CloudRain, Check, Star, Navigation, Droplets, X, ArrowRight, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { db, storage } from '../../../src/firebase';
import { collection, addDoc, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import type { Review } from '../../../src/types';
import React from 'react';

const { width } = Dimensions.get('window');

// --- Internal Types ---
interface Condition {
  weather: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'typhoon' | 'spring_bloom';
  airTemp?: number;
  waterTemp?: number;
  wave: 'none' | 'low' | 'high';
}

interface Metrics {
  visibility: number;
  flow: 'none' | 'weak' | 'strong' | 'drift';
  difficulty: 'easy' | 'normal' | 'hard';
  macroWideRatio: number;
}

interface Radar {
  encounter: number;
  excite: number;
  macro: number;
  comfort: number;
  visibility: number;
}

export default function AddReviewScreen() {
  const { id: pointId, logId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<Partial<Review>>({
    pointId: pointId as string,
    logId: (logId as string) || undefined,
    rating: 4,
    condition: {
      weather: 'sunny',
      wave: 'none',
      airTemp: 25,
      waterTemp: 22,
    },
    metrics: {
      visibility: 15,
      flow: 'none',
      difficulty: 'normal',
      macroWideRatio: 50,
    },
    radar: {
      encounter: 4,
      excite: 4,
      macro: 3,
      comfort: 4,
      visibility: 4,
    },
    tags: [],
    comment: '',
    images: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const newImages = [...(formData.images || [])];
        for (const asset of result.assets) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const filename = asset.uri.split('/').pop();
          const imageRef = ref(storage, `reviews/${pointId}/${Date.now()}_${filename}`);
          await uploadBytes(imageRef, blob);
          const url = await getDownloadURL(imageRef);
          newImages.push(url);
        }
        setFormData(prev => ({ ...prev, images: newImages }));
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
      flatListRef.current?.scrollToIndex({ index: step + 1 });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      flatListRef.current?.scrollToIndex({ index: step - 1 });
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) return;
    setIsSubmitting(true);

    try {
      const reviewData = {
        ...formData,
        userId: user.id,
        userName: user.name,
        userProfileImage: user.profileImage,
        userLogsCount: 20, // Dummy or actual logs count
        isTrusted: !!formData.logId || user.role !== 'user',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = ({ index }: { index: number }) => {
    switch (index) {
      case 0: return <Step1 data={formData.condition as Condition} onChange={(c) => setFormData(p => ({ ...p, condition: { ...p.condition!, ...c } }))} />;
      case 1: return <Step2 data={formData.metrics as Metrics} radar={formData.radar as Radar} onChange={(m) => setFormData(p => ({ ...p, metrics: { ...p.metrics!, ...m } }))} onRadarChange={(r) => setFormData(p => ({ ...p, radar: { ...p.radar!, ...r } }))} />;
      case 2: return <Step3 data={formData} onChange={(d) => setFormData(p => ({ ...p, ...d }))} onPickImage={handlePickImage} uploading={uploading} />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <X size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>レビュー投稿</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBar, { width: `${((step + 1) / 3) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        ref={flatListRef}
        data={[0, 1, 2]}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.toString()}
      />

      {/* Navigation */}
      <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, step === 2 && styles.submitBtn]}
          onPress={step === 2 ? handleSubmit : handleNext}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryBtnText}>{step === 2 ? 'レビューを投稿する' : '次へ進む'}</Text>
          {step < 2 ? <ArrowRight size={20} color="#fff" /> : <Check size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Steps ---

const Step1 = ({ data, onChange }: { data: Condition, onChange: (c: Partial<Condition>) => void }) => (
  <ScrollView style={{ width }} contentContainerStyle={styles.stepContent}>
    <Text style={styles.stepTitle}>今日の環境は？</Text>

    <Text style={styles.label}>天候</Text>
    <View style={styles.grid}>
      {[
        { id: 'sunny', icon: <Sun />, label: '晴天' },
        { id: 'cloudy', icon: <Cloud />, label: '曇り' },
        { id: 'rainy', icon: <CloudRain />, label: '雨' },
        { id: 'typhoon', icon: <Navigation />, label: '台風' },
        { id: 'spring_bloom', icon: <Droplets />, label: '春濁り' }
      ].map(opt => (
        <TouchableOpacity
          key={opt.id}
          onPress={() => onChange({ weather: opt.id as Condition['weather'] })}
          style={[styles.gridBtn, data.weather === opt.id && styles.gridBtnActive]}
        >
          {React.cloneElement(opt.icon as React.ReactElement<any>, { color: data.weather === opt.id ? '#0ea5e9' : '#94a3b8', size: 28 })}
          <Text style={[styles.gridBtnText, data.weather === opt.id && styles.gridBtnTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <Text style={styles.label}>波の状態</Text>
    <View style={styles.stack}>
      {['none', 'low', 'high'].map(id => (
        <TouchableOpacity
          key={id}
          onPress={() => onChange({ wave: id as Condition['wave'] })}
          style={[styles.stackBtn, data.wave === id && styles.stackBtnActive]}
        >
          <Text style={[styles.stackBtnText, data.wave === id && styles.stackBtnTextActive]}>
            {id === 'none' ? 'ベタ凪' : id === 'low' ? 'さざ波' : 'うねり/高波'}
          </Text>
          {data.wave === id && <Check size={18} color="#0ea5e9" />}
        </TouchableOpacity>
      ))}
    </View>

    <View style={styles.row}>
      <View style={styles.flex1}>
        <Text style={styles.label}>気温 (°C)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(data.airTemp)}
          onChangeText={t => onChange({ airTemp: Number(t) })}
        />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.label}>水温 (°C)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(data.waterTemp)}
          onChangeText={t => onChange({ waterTemp: Number(t) })}
        />
      </View>
    </View>
  </ScrollView>
);

const Step2 = ({ data, radar, onChange, onRadarChange }: { data: Metrics, radar: Radar, onChange: (m: Partial<Metrics>) => void, onRadarChange: (r: Partial<Radar>) => void }) => (
  <ScrollView style={{ width }} contentContainerStyle={styles.stepContent}>
    <Text style={styles.stepTitle}>計測データ</Text>

    <View style={styles.card}>
      <Text style={styles.cardLabel}>透明度</Text>
      <Text style={styles.cardMainValue}>{data.visibility}m</Text>
      {/* Simple slider replacement for now or just buttons */}
      <View style={styles.sliderMock}>
        {[5, 10, 15, 20, 30].map(v => (
          <TouchableOpacity
            key={v}
            onPress={() => onChange({ visibility: v })}
            style={[styles.circleBtn, data.visibility === v && styles.circleBtnActive]}
          >
            <Text style={[styles.circleBtnText, data.visibility === v && styles.circleBtnTextActive]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>

    <Text style={styles.label}>5象限評価 (1-5)</Text>
    <View style={styles.radarInputs}>
      <RadarInput label="遭遇度" value={radar.encounter} onChange={(v: number) => onRadarChange({ encounter: v })} />
      <RadarInput label="ワイド" value={radar.excite} onChange={(v: number) => onRadarChange({ excite: v })} />
      <RadarInput label="マクロ" value={radar.macro} onChange={(v: number) => onRadarChange({ macro: v })} />
      <RadarInput label="快適度" value={radar.comfort} onChange={(v: number) => onRadarChange({ comfort: v })} />
      <RadarInput label="透明度" value={radar.visibility} onChange={(v: number) => onRadarChange({ visibility: v })} />
    </View>
  </ScrollView>
);

const RadarInput = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
  <View style={styles.radarRow}>
    <Text style={styles.radarLabel}>{label}</Text>
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} style={{ marginLeft: 4 }}>
          <Star size={24} color={i <= value ? "#fbbf24" : "#e2e8f0"} fill={i <= value ? "#fbbf24" : "transparent"} />
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const Step3 = ({
  data,
  onChange,
  onPickImage,
  uploading
}: {
  data: Partial<Review>,
  onChange: (d: Partial<Review>) => void,
  onPickImage: () => void,
  uploading: boolean
}) => (
  <ScrollView style={{ width }} contentContainerStyle={styles.stepContent}>
    <Text style={styles.stepTitle}>最後の一押し</Text>

    <Text style={styles.label}>写真を追加 (最大5枚)</Text>
    <View style={styles.photoGrid}>
      <TouchableOpacity
        style={styles.photoAddBtn}
        onPress={onPickImage}
        disabled={uploading || (data.images?.length || 0) >= 5}
      >
        {uploading ? (
          <ActivityIndicator color="#0ea5e9" />
        ) : (
          <>
            <Camera size={32} color="#94a3b8" />
            <Text style={styles.photoAddText}>追加</Text>
          </>
        )}
      </TouchableOpacity>
      {data.images?.map((url, idx) => (
        <View key={idx} style={styles.photoItem}>
          <Image source={{ uri: url }} style={styles.photoImage} />
          <TouchableOpacity
            style={styles.photoRemove}
            onPress={() => {
              const newImgs = data.images?.filter((_, i) => i !== idx);
              onChange({ images: newImgs });
            }}
          >
            <X size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
    </View>

    <Text style={styles.label}>遭遇タグ</Text>
    <View style={styles.tagsGrid}>
      {['サメ', 'エイ', 'カメ', '地形', '洞窟', '群れ', 'ハゼ', 'ウミウシ'].map(tag => (
        <TouchableOpacity
          key={tag}
          onPress={() => {
            const newTags = data.tags && data.tags.includes(tag)
              ? data.tags.filter((t: string) => t !== tag)
              : [...(data.tags || []), tag];
            onChange({ tags: newTags });
          }}
          style={[styles.tag, data.tags && data.tags.includes(tag) && styles.tagActive]}
        >
          <Text style={[styles.tagText, data.tags && data.tags.includes(tag) && styles.tagTextActive]}>#{tag}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <Text style={styles.label}>コメント</Text>
    <TextInput
      style={styles.textArea}
      multiline
      placeholder="今日のポイントはどうでしたか？"
      value={data.comment}
      onChangeText={t => onChange({ comment: t })}
    />

    <View style={styles.satisfaction}>
      <Text style={styles.labelCenter}>総合満足度</Text>
      <View style={styles.starsLarge}>
        {[1, 2, 3, 4, 5].map(i => (
          <TouchableOpacity key={i} onPress={() => onChange({ rating: i })} style={{ marginLeft: 8 }}>
            <Star size={44} color={i <= (data.rating || 0) ? "#fbbf24" : "#e2e8f0"} fill={i <= (data.rating || 0) ? "#fbbf24" : "transparent"} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerBtn: { padding: 10 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 8 },
  headerSpacer: { width: 44 },
  progressBarBg: { width: '80%', height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#0ea5e9' },
  stepContent: { padding: 24, paddingBottom: 120 },
  stepTitle: { fontSize: 26, fontWeight: '900', color: '#1e293b', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '900', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  labelCenter: { fontSize: 13, fontWeight: '900', color: '#94a3b8', marginBottom: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  gridBtn: { width: (width - 48 - 20) / 3, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: '#f1f5f9', alignItems: 'center', marginRight: 10, marginBottom: 10 },
  gridBtnActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  gridBtnText: { fontSize: 12, fontWeight: '800', color: '#94a3b8' },
  gridBtnTextActive: { color: '#0ea5e9' },
  stack: { marginBottom: 24 },
  stackBtn: { padding: 18, borderRadius: 20, borderWidth: 2, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stackBtnActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  stackBtnText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
  stackBtnTextActive: { color: '#0ea5e9', fontWeight: '900' },
  row: { flexDirection: 'row' },
  flex1: { flex: 1, marginRight: 16 }, // Added marginRight to simulate gap
  input: { height: 54, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, fontSize: 18, fontWeight: '900' },
  nav: { position: 'absolute', bottom: 0, width: '100%', padding: 24, backgroundColor: 'rgba(255,255,255,0.9)' },
  primaryBtn: { height: 60, backgroundColor: '#0ea5e9', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: '#10b981' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 12 },
  card: { backgroundColor: '#f8fafc', padding: 24, borderRadius: 32, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', marginBottom: 32 },
  cardLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 8 },
  cardMainValue: { fontSize: 44, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  sliderMock: { flexDirection: 'row' },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  circleBtnActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  circleBtnText: { fontSize: 12, fontWeight: '900', color: '#64748b' },
  circleBtnTextActive: { color: '#fff' },
  radarInputs: {},
  radarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 16, borderRadius: 20, marginBottom: 16 },
  radarLabel: { fontSize: 13, fontWeight: '800', color: '#475569' },
  stars: { flexDirection: 'row' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  tag: { padding: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8, marginBottom: 8 },
  tagActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  tagTextActive: { color: '#fff' },
  tagText: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  textArea: { height: 120, backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, fontSize: 16, marginBottom: 32, textAlignVertical: 'top' },
  satisfaction: { alignItems: 'center' },
  starsLarge: { flexDirection: 'row' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  photoAddBtn: { width: 100, height: 100, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', marginRight: 12, marginBottom: 12 },
  photoAddText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginTop: 4, textTransform: 'uppercase' },
  photoItem: { width: 100, height: 100, borderRadius: 20, overflow: 'hidden', marginRight: 12, marginBottom: 12, position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }
});
