import { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, FlatList, Dimensions, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Sun, Cloud, CloudRain, Check, Star, Navigation, Droplets, X, ArrowRight, Camera, Shield, Calendar, Activity, Sparkles, ArrowLeft, Anchor } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { db, storage } from '../../../src/firebase';
import { collection, addDoc, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import type { Review, ReviewRadar } from '../../../src/types';
import { CERTIFICATIONS } from '../../../src/constants/masterData';
import { Wind, Waves, Search, Maximize, Map, Mountain, Boxes } from 'lucide-react-native';
import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

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
  terrainIntensity: number;
  depthAvg: number;
  depthMax: number;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerBtn: { padding: 10 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 8 },
  headerSpacer: { width: 44 },
  progressBarBg: { width: '80%', height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#0ea5e9' },
  stepContent: { padding: 24, paddingBottom: 150 },
  stepTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '900', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16 },
  subLabel: { fontSize: 10, fontWeight: '900', color: '#cbd5e1', marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { height: 50, flex: 1, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  inputSmall: { height: 44, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, fontSize: 16, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, marginTop: 4 },
  gridBtn: { width: (width - 48 - 20) / 3, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: '#f1f5f9', alignItems: 'center', marginRight: 10, marginBottom: 10 },
  gridBtnActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  gridBtnText: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 8 },
  gridBtnTextActive: { color: '#0ea5e9' },
  stack: { marginBottom: 16 },
  stackBtn: { padding: 16, borderRadius: 16, borderWidth: 2, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stackBtnActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  stackBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  stackBtnTextActive: { color: '#0ea5e9', fontWeight: '900' },
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1 },
  nav: { position: 'absolute', bottom: 0, width: '100%', padding: 24, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  primaryBtn: { height: 56, backgroundColor: '#0ea5e9', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: '#10b981' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 12 },
  card: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', marginBottom: 24 },
  cardLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 4 },
  cardMainValue: { fontSize: 36, fontWeight: '900', color: '#1e293b' },
  sliderMock: { flexDirection: 'row', marginTop: 8 },
  sliderSubText: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginTop: 4 },
  scrollSelector: { flexDirection: 'row', marginTop: 12, marginBottom: 8 },
  chipBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  chipBtnActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  chipBtnText: { fontSize: 14, fontWeight: '900', color: '#64748b' },
  chipBtnTextActive: { color: '#fff' },
  smallChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f8fafc', marginRight: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  smallChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  smallChipText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  smallChipTextActive: { color: '#fff' },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 6 },
  circleBtnActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  circleBtnTextActive: { color: '#fff' },

  // New Premium Styles
  premiumCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  premiumCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  premiumCardLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginLeft: 8, flex: 1 },
  statusBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', color: '#10b981' },
  premiumCardValueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  premiumCardValue: { fontSize: 32, fontWeight: '900', color: '#1e293b' },
  premiumCardUnit: { fontSize: 14, fontWeight: '800', color: '#94a3b8', marginLeft: 4 },
  sliderContainer: { height: 40, justifyContent: 'center' },
  sliderBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 4 },
  sliderTicks: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  sliderTicksLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  tick: { padding: 4 },
  tickText: { fontSize: 10, fontWeight: '700', color: '#cbd5e1' },
  centeredBadge: { alignSelf: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  centeredBadgeText: { fontSize: 12, fontWeight: '900', color: '#1e293b' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, marginTop: 12 },
  sideLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8' },
  gradientSliderContainer: { height: 24, justifyContent: 'center' },
  gradientSliderBg: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  gradientFill: { height: '100%' },
  sliderThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, top: -5, marginLeft: -10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, borderWidth: 2, borderColor: '#fff' },
  sliderOverlay: {
    position: 'absolute',
    top: -15,
    bottom: -15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 10
  },
  sliderInteractionZone: { flex: 1, height: 40 },
  depthValueContainer: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  depthValue: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  depthUnit: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginLeft: 4 },
  miniSliderContainer: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, marginTop: 12, marginBottom: 12 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  miniGridBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  miniGridBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  miniGridBtnText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  miniGridBtnTextActive: { color: '#fff' },
  depthAdjustContainer: { marginTop: 12, gap: 12 },
  depthAdjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  depthAdjustLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', width: 22 },
  miniSliderBg: { flex: 1, height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, position: 'relative' },
  miniSliderDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', top: -2, marginLeft: -4 },
  depthAdjustValue: { fontSize: 11, fontWeight: '900', color: '#1e293b', width: 32, textAlign: 'right' },
  depthQuickBtn: { backgroundColor: '#f8fafc', paddingVertical: 6, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  depthQuickBtnText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  flowTileGrid: { gap: 10, marginTop: 8 },
  flowTileBtn: { width: '100%', height: 64, borderRadius: 16, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, gap: 16 },
  flowTileBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  flowTileIcon: { fontSize: 24 },
  flowTileTextContent: { flex: 1 },
  flowTileLabel: { fontSize: 15, fontWeight: '900', color: '#1e293b' },
  flowTileDesc: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
  flowTileLabelActive: { color: '#fff', opacity: 1 },
  sideLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionMargin: { marginTop: 24, marginBottom: 24 },
  labelCenter: { fontSize: 13, fontWeight: '800', color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  difficultyContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  diffBtn: { flex: 1, height: 90, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  diffBtnActive: { borderColor: '#0ea5e9', borderWidth: 2, backgroundColor: '#f0f9ff' },
  diffEmoji: { fontSize: 24, marginBottom: 8 },
  diffLabel: { fontSize: 12, fontWeight: '900', color: '#64748b' },
  diffLabelActive: { color: '#0ea5e9' },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 8, marginBottom: 8 },
  smallBtnActive: { backgroundColor: '#6366f1' },
  smallBtnText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  smallBtnTextActive: { color: '#fff' },
  radarCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 24, marginBottom: 24 },
  radarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  radarHeaderText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  radarList: { gap: 12 },
  radarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radarLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8' },
  stars: { flexDirection: 'row' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  photoAddBtn: { width: 80, height: 80, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', marginRight: 8, marginBottom: 8 },
  photoAddText: { fontSize: 9, fontWeight: '900', color: '#94a3b8', marginTop: 2 },
  photoItem: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', marginRight: 8, marginBottom: 8 },
  photoImage: { width: '100%', height: '100%' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  tag: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 6, marginBottom: 6 },
  tagActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  tagText: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  tagTextActive: { color: '#fff' },
  textArea: { height: 100, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, fontSize: 14, marginBottom: 24, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e2e8f0' },
  reviewerInfo: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoTitle: { fontSize: 11, fontWeight: '900', color: '#475569', marginLeft: 8 },
  selectBox: { backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4 },
  selectInput: { height: 24, fontSize: 12, fontWeight: '900', color: '#1e293b', marginBottom: 8 },
  orgList: { flexDirection: 'row' },
  orgChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f8fafc', marginRight: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  orgChipActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  orgChipText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  orgChipTextActive: { color: '#fff' }
});

export default function AddReviewScreen() {
  const { pointId: pointIdFromParams, logId, reviewId } = useLocalSearchParams();
  const isEdit = !!reviewId;
  const pointId = pointIdFromParams as string;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logs } = useAuth();

  const [step, setStep] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<Partial<Review>>({
    pointId: pointId as string,
    logId: (logId as string) || undefined,
    date: new Date().toISOString().split('T')[0],
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
      terrainIntensity: 0,
      depthAvg: 10,
      depthMax: 20,
    },
    radar: {
      visibility: 3,
      satisfaction: 4,
      excite: 3,
      comfort: 4,
      encounter: 4,
      topography: 3,
    },
    tags: [],
    comment: '',
    images: [],
    userOrgId: user?.certification?.orgId || 'padi',
    userRank: user?.certification?.rankId || 'entry',
    userLogsCount: logs.length || 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(isEdit);

  // Fetch Existing Review for Edit Mode
  useEffect(() => {
    async function fetchReview() {
      if (isEdit && reviewId) {
        setIsLoadingReview(true);
        try {
          // We need to find by ID. In AddReviewScreen, we might not have 'reviews' state.
          // Directly fetch from Firestore.
          const q = query(collection(db, 'reviews'), where('id', '==', reviewId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data() as Review;
            setFormData({ ...data });
          } else {
            Alert.alert('Error', 'Review not found');
            router.back();
          }
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to load review');
        } finally {
          setIsLoadingReview(false);
        }
      }
    }
    fetchReview();
  }, [isEdit, reviewId]);

  // Sync Log Data if logId is provided
  useEffect(() => {
    if (logId && logs.length > 0) {
      const log = logs.find(l => l.id === logId);
      if (log) {
        setFormData(prev => ({
          ...prev,
          date: log.date,
          condition: {
            ...prev.condition!,
            weather: (log.condition?.weather as any) || prev.condition!.weather,
            wave: log.condition?.wave ? (log.condition.wave === 'none' ? 'none' : 'low' as any) : prev.condition!.wave,
            airTemp: log.condition?.airTemp || prev.condition!.airTemp,
            waterTemp: log.condition?.waterTemp?.surface || prev.condition!.waterTemp,
          },
          metrics: {
            ...prev.metrics!,
            visibility: log.condition?.transparency || prev.metrics!.visibility,
            flow: (log.condition?.current as any) || prev.metrics!.flow,
            depthAvg: log.depth?.average || prev.metrics!.depthAvg,
            depthMax: log.depth?.max || prev.metrics!.depthMax,
          }
        }));
      }
    }
  }, [logId, logs]);

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
    console.log("[ReviewSubmit] Starting submission process...");
    console.log("[ReviewSubmit] Auth Status:", { isAuthenticated, hasUser: !!user, uid: user?.id });
    console.log("[ReviewSubmit] Point ID:", pointId);

    if (!isAuthenticated || !user || !pointId) {
      console.warn("[ReviewSubmit] Submission aborted: Missing requirements", {
        auth: isAuthenticated,
        user: !!user,
        point: !!pointId
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("[ReviewSubmit] Constructing review data...");
      // Determine Trust Level
      let trustLevel: Review['trustLevel'] = 'standard';
      if (user.role === 'admin' || user.role === 'moderator') {
        trustLevel = 'official';
      } else if (!!formData.logId) {
        trustLevel = 'verified';
      } else if (logs.length >= 100) {
        trustLevel = 'expert';
      }

      // Determine Approval Status (Only Official is auto-approved to prevent negative campaign)
      const isApproved = trustLevel === 'official';

      const reviewData: any = {
        ...formData,
        id: `rv${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userProfileImage: user.profileImage || null,
        userLogsCount: formData.userLogsCount || logs.length,
        status: isApproved ? 'approved' : 'pending',
        trustLevel,
        helpfulCount: 0,
        helpfulBy: [],
        createdAt: new Date().toISOString()
      };

      // Firestore doesn't accept 'undefined'. Remove undefined keys.
      Object.keys(reviewData).forEach(key => {
        if (reviewData[key] === undefined) {
          delete reviewData[key];
        }
      });

      console.log("[ReviewSubmit] Review data ready, sending to Firestore...", reviewData);

      if (isEdit && reviewId) {
        const q = query(collection(db, 'reviews'), where('id', '==', reviewId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'reviews', snap.docs[0].id), reviewData);
          console.log("[ReviewSubmit] Successfully updated Firestore!");
          Alert.alert('完了', 'レビューを更新しました！');
        } else {
          throw new Error('Review document not found for update');
        }
      } else {
        await addDoc(collection(db, 'reviews'), reviewData);
        console.log("[ReviewSubmit] Successfully added to Firestore!");
        Alert.alert('完了', 'レビューを投稿しました！');
      }

      router.back();
    } catch (error) {
      console.error("[ReviewSubmit] Firestore Error:", error);
      Alert.alert('エラー', '投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = ({ index }: { index: number }) => {
    switch (index) {
      case 0: return (
        <Step1
          data={formData.condition as Condition}
          date={formData.date!}
          onDateChange={(d: string) => setFormData(p => ({ ...p, date: d }))}
          onChange={(c: Partial<Condition>) => setFormData(p => ({ ...p, condition: { ...p.condition!, ...c } }))}
        />
      );
      case 1: return (
        <Step2
          data={formData.metrics as Metrics}
          radar={formData.radar as ReviewRadar}
          onChange={(m: Partial<Metrics>) => setFormData(p => {
            const nextMetrics = { ...p.metrics!, ...m };
            const nextRadar = { ...p.radar! };

            // Automated Pre-filling logic
            if (m.visibility !== undefined) {
              nextRadar.visibility = m.visibility >= 30 ? 5 : m.visibility >= 20 ? 4 : m.visibility >= 10 ? 3 : m.visibility >= 5 ? 2 : 1;
            }
            if (m.flow !== undefined || m.difficulty !== undefined || m.depthMax !== undefined) {
              const f = m.flow || nextMetrics.flow;
              const d = m.difficulty || nextMetrics.difficulty;
              const dep = m.depthMax || nextMetrics.depthMax;

              let baseComfort = 5;
              if (f === 'strong' || f === 'drift') baseComfort -= 2;
              else if (f === 'weak') baseComfort -= 1;

              if (d === 'hard') baseComfort -= 2;
              else if (d === 'normal') baseComfort -= 1;

              if (dep && dep > 30) baseComfort -= 1;
              nextRadar.comfort = Math.max(1, baseComfort);
            }

            if (m.terrainIntensity !== undefined) {
              nextRadar.topography = Math.min(5, Math.floor(m.terrainIntensity / 20) + 1);
            }

            return { ...p, metrics: nextMetrics, radar: nextRadar };
          })}
          onRadarChange={(r: Partial<ReviewRadar>) => setFormData(p => ({ ...p, radar: { ...p.radar!, ...r } }))}
        />
      );
      case 2: return (
        <Step3
          data={formData}
          onChange={(d: Partial<Review>) => setFormData(p => ({ ...p, ...d }))}
          onRadarChange={(r: Partial<ReviewRadar>) => setFormData(p => ({ ...p, radar: { ...p.radar!, ...r } }))}
          onPickImage={handlePickImage}
          uploading={uploading}
        />
      );
      default: return null;
    }
  };

  if (isLoadingReview) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={{ marginTop: 12, color: '#94a3b8', fontWeight: '800' }}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{isEdit ? 'レビューを編集' : 'レビューを投稿'}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBar, { width: `${(step + 1) * 33.3}%` }]} />
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

const Step1 = ({ data, date, onDateChange, onChange }: { data: Condition, date: string, onDateChange: (d: string) => void, onChange: (c: Partial<Condition>) => void }) => {
  const [show, setShow] = useState(false);

  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>いつ、どんな環境でしたか？</Text>

      <View style={styles.premiumCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Calendar size={16} color="#94a3b8" />
            <Text style={[styles.premiumCardLabel, { marginLeft: 6 }]}>潜水日</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, flex: 1, marginLeft: 10 }}>
            {[
              { label: '今日', offset: 0, color: '#0ea5e9', bg: '#f0f9ff' },
              { label: '昨日', offset: 1, color: '#f59e0b', bg: '#fffbeb' },
              {
                label: '先週末',
                getOffset: () => {
                  const d = new Date();
                  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
                  return day === 0 ? 1 : day === 6 ? 0 : day + 1; // Simplistic: nearest previous Sat/Sun
                },
                color: '#8b5cf6',
                bg: '#f5f3ff'
              }
            ].map((chip) => {
              const chipDate = new Date();
              const offset = ('offset' in chip) ? (chip.offset as number) : (chip as any).getOffset();
              chipDate.setDate(chipDate.getDate() - offset);
              const chipIso = chipDate.toISOString().split('T')[0];
              const isActive = date === chipIso;

              return (
                <TouchableOpacity
                  key={chip.label}
                  onPress={() => onDateChange(chipIso)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 10,
                    backgroundColor: isActive ? chip.bg : '#f8fafc',
                    borderWidth: 1.5,
                    borderColor: isActive ? chip.color : '#e2e8f0',
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '900', color: isActive ? chip.color : '#94a3b8' }}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 24,
            padding: 20,
            borderWidth: 2,
            borderColor: show ? '#0ea5e9' : '#f1f5f9',
            justifyContent: 'space-between',
            shadowColor: '#0ea5e9',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: show ? 0.1 : 0,
            shadowRadius: 12,
            elevation: show ? 4 : 0
          }}
          onPress={() => setShow(!show)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Sparkles size={22} color="#0ea5e9" />
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Selected Date</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e293b' }}>
                {date ? date.replace(/-/g, ' / ') : '日付を選択'}
              </Text>
            </View>
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: show ? '#0ea5e9' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={16} color={show ? "#fff" : "#cbd5e1"} />
          </View>
        </TouchableOpacity>

        {date && !show && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Check size={12} color="#10b981" />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#10b981' }}>素晴らしいダイビングの日ですね！</Text>
            </View>
          </View>
        )}

        {show && (
          <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#f1f5f9' }}>
            <DateTimePicker
              value={date ? new Date(date) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              locale="ja-JP"
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') setShow(false);
                if (selectedDate) {
                  onDateChange(selectedDate.toISOString().split('T')[0]);
                }
              }}
              maximumDate={new Date()}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShow(false)}
                style={{ alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}
              >
                <Text style={{ color: '#0ea5e9', fontWeight: '900', fontSize: 14 }}>完了</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

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

      {/* Temperature Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Sun size={16} color="#f97316" />
          <Text style={styles.premiumCardLabel}>気温</Text>
        </View>
        <View style={styles.premiumCardValueRow}>
          <Text style={styles.premiumCardValue}>{data.airTemp || '25'}</Text>
          <Text style={styles.premiumCardUnit}>°C</Text>
        </View>
        <View style={styles.sliderContainer}>
          <View style={styles.sliderBg}>
            <View style={[styles.sliderFill, { width: `${((data.airTemp || 25) / 45) * 100}%`, backgroundColor: '#f97316' }]} />
          </View>
          <View style={styles.sliderOverlay}>
            {[0, 10, 20, 25, 30, 40].map(v => (
              <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ airTemp: v })} />
            ))}
          </View>
        </View>
      </View>

      {/* Water Temperature Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Droplets size={16} color="#0ea5e9" />
          <Text style={styles.premiumCardLabel}>水温</Text>
        </View>
        <View style={styles.premiumCardValueRow}>
          <Text style={styles.premiumCardValue}>{data.waterTemp || '22'}</Text>
          <Text style={styles.premiumCardUnit}>°C</Text>
        </View>
        <View style={styles.sliderContainer}>
          <View style={styles.sliderBg}>
            <View style={[styles.sliderFill, { width: `${((data.waterTemp || 22) / 35) * 100}%`, backgroundColor: '#0ea5e9' }]} />
          </View>
          <View style={styles.sliderOverlay}>
            {[10, 15, 20, 22, 25, 30].map(v => (
              <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ waterTemp: v })} />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const Step2 = ({ data, radar, onChange, onRadarChange }: { data: Metrics, radar: ReviewRadar, onChange: (m: Partial<Metrics>) => void, onRadarChange: (r: Partial<ReviewRadar>) => void }) => {
  const getMacroWideLabel = (val: number) => {
    if (val < 30) return 'マクロ狙い';
    if (val > 70) return 'ワイド狙い';
    return 'バランス型';
  };

  const getVisibilityLabel = (v: number) => {
    if (v >= 30) return { label: '神の領域 (Godly)', color: '#fbbf24', bg: '#fffbeb' };
    if (v >= 20) return { label: '抜群！ (Fantastic)', color: '#10b981', bg: '#f0fdf4' };
    if (v >= 10) return { label: '良好 (Clear)', color: '#0ea5e9', bg: '#f0f9ff' };
    return { label: '濁り気味 (Misty)', color: '#f59e0b', bg: '#fffbeb' };
  };

  const getVisibilityProgress = (v: number) => {
    // 20m should feel like a major milestone (around 60% of the bar)
    // Non-linear scaling: y = (x/60)^0.6
    return Math.pow(v / 60, 0.6) * 100;
  };

  const getTerrainLabel = (val: number) => {
    if (val < 30) return '標準ポイント';
    if (val > 70) return '地形で遊ぶ';
    return '地形・沈船';
  };

  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>ポイントの特性</Text>

      {/* Visibility Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Activity size={18} color={getVisibilityLabel(data.visibility).color} />
          <Text style={styles.premiumCardLabel}>透明度</Text>
          <View style={[styles.statusBadge, { backgroundColor: getVisibilityLabel(data.visibility).bg }]}>
            <Text style={[styles.statusBadgeText, { color: getVisibilityLabel(data.visibility).color }]}>
              {getVisibilityLabel(data.visibility).label}
            </Text>
          </View>
        </View>
        <View style={styles.premiumCardValueRow}>
          <Text style={[styles.premiumCardValue, { color: getVisibilityLabel(data.visibility).color }]}>{data.visibility}</Text>
          <Text style={styles.premiumCardUnit}>M</Text>
        </View>
        <View style={styles.sliderContainer}>
          <View style={styles.sliderBg}>
            <View style={[styles.sliderFill, { width: `${getVisibilityProgress(data.visibility)}%`, backgroundColor: getVisibilityLabel(data.visibility).color }]} />
          </View>
          <View style={styles.sliderOverlay}>
            {[2, 5, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50, 60].map(v => (
              <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ visibility: v })} />
            ))}
          </View>
          <View style={styles.sliderTicksLabels}>
            {[5, 15, 30, 60].map(t => (
              <Text key={t} style={styles.tickText}>{t}</Text>
            ))}
          </View>
        </View>
      </View>

      {/* Macro/Wide Slider Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Search size={16} color="#f97316" />
          <Text style={styles.premiumCardLabel}>マクロ・ワイド比率</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{getMacroWideLabel(data.macroWideRatio)}</Text>
          </View>
        </View>
        <View style={styles.labelRow}>
          <View style={styles.sideLabelContainer}>
            <Search size={12} color="#f97316" />
            <Text style={[styles.sideLabel, { color: '#f97316' }]}>マクロ狙い</Text>
          </View>
          <View style={styles.sideLabelContainer}>
            <Text style={[styles.sideLabel, { color: '#0ea5e9' }]}>ワイド狙い</Text>
            <Maximize size={12} color="#0ea5e9" />
          </View>
        </View>
        <View style={styles.gradientSliderContainer}>
          <View style={[styles.gradientSliderBg, { backgroundColor: '#f1f5f9' }]}>
            <View style={[styles.gradientFill, {
              position: 'absolute',
              width: `${data.macroWideRatio}%`,
              height: '100%',
              backgroundColor: '#f97316',
              opacity: 0.1
            }]} />
            <View style={[styles.gradientFill, {
              position: 'absolute',
              right: 0,
              width: `${100 - data.macroWideRatio}%`,
              height: '100%',
              backgroundColor: '#0ea5e9',
              opacity: 0.1
            }]} />
            <View style={[styles.sliderThumb, { left: `${data.macroWideRatio}%`, backgroundColor: data.macroWideRatio < 50 ? '#f97316' : '#0ea5e9' }]} />
          </View>
          <View style={styles.sliderOverlay}>
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
              <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ macroWideRatio: v })} />
            ))}
          </View>
        </View>
      </View>

      {/* Terrain Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Map size={16} color="#6366f1" />
          <Text style={styles.premiumCardLabel}>地形・環境の激しさ</Text>
          <View style={[styles.statusBadge, { backgroundColor: '#eef2ff' }]}>
            <Text style={[styles.statusBadgeText, { color: '#6366f1' }]}>{getTerrainLabel(data.terrainIntensity)}</Text>
          </View>
        </View>
        <View style={styles.labelRow}>
          <View style={styles.sideLabelContainer}>
            <Boxes size={12} color="#94a3b8" />
            <Text style={styles.sideLabel}>標準的な構成</Text>
          </View>
          <View style={styles.sideLabelContainer}>
            <Text style={[styles.sideLabel, { color: '#6366f1' }]}>地形・沈船</Text>
            <Mountain size={12} color="#6366f1" />
          </View>
        </View>
        <View style={styles.gradientSliderContainer}>
          <View style={styles.gradientSliderBg}>
            <View style={[styles.gradientFill, {
              position: 'absolute',
              width: `${data.terrainIntensity}%`,
              height: '100%',
              backgroundColor: '#6366f1',
              opacity: 0.2
            }]} />
            <View style={[styles.sliderThumb, { left: `${data.terrainIntensity}%`, backgroundColor: '#6366f1' }]} />
          </View>
          <View style={styles.sliderOverlay}>
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
              <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ terrainIntensity: v })} />
            ))}
          </View>
        </View>
      </View>

      {/* Depth Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Anchor size={18} color="#6366f1" />
          <Text style={styles.premiumCardLabel}>潜水水深</Text>
          <View style={styles.depthValueContainer}>
            <Text style={styles.depthValue}>{data.depthAvg}-{data.depthMax}</Text>
            <Text style={styles.depthUnit}>M</Text>
          </View>
        </View>
        <View style={styles.depthAdjustContainer}>
          <View style={styles.depthAdjustRow}>
            <Text style={styles.depthAdjustLabel}>平均</Text>
            <View style={styles.miniSliderBg}>
              <View style={[styles.miniSliderDot, { left: `${(data.depthAvg / 40) * 100}%` }]} />
              <View style={styles.sliderOverlay}>
                {[0, 2, 5, 8, 10, 12, 15, 18, 20, 25, 30, 40].map(v => (
                  <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ depthAvg: Math.min(v, data.depthMax) })} />
                ))}
              </View>
            </View>
            <Text style={styles.depthAdjustValue}>{data.depthAvg}m</Text>
          </View>
          <View style={styles.depthAdjustRow}>
            <Text style={styles.depthAdjustLabel}>最大</Text>
            <View style={styles.miniSliderBg}>
              <View style={[styles.miniSliderDot, { left: `${(data.depthMax / 40) * 100}%`, backgroundColor: '#f43f5e' }]} />
              <View style={styles.sliderOverlay}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60].map(v => (
                  <TouchableOpacity key={v} style={styles.sliderInteractionZone} onPress={() => onChange({ depthMax: Math.max(v, data.depthAvg) })} />
                ))}
              </View>
            </View>
            <Text style={styles.depthAdjustValue}>{data.depthMax}m</Text>
          </View>
        </View>
      </View>

      {/* Flow Card */}
      <View style={styles.premiumCard}>
        <View style={styles.premiumCardHeader}>
          <Wind size={20} color="#6366f1" />
          <Text style={styles.premiumCardLabel}>水の流れ</Text>
        </View>
        <View style={styles.flowTileGrid}>
          {[
            { id: 'none', label: 'なし (None)', icon: '〰', desc: '穏やかな状態' },
            { id: 'weak', label: '弱い (Weak)', icon: '🌬️', desc: '心地よい流れ' },
            { id: 'strong', label: '強い (Strong)', icon: '🌪️', desc: '注意が必要' },
            { id: 'drift', label: '流す (Drift)', icon: '🚤', desc: 'ドリフトダイビング' }
          ].map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => onChange({ flow: f.id as any })}
              style={[styles.flowTileBtn, data.flow === f.id && styles.flowTileBtnActive]}
            >
              <Text style={styles.flowTileIcon}>{f.icon}</Text>
              <View style={styles.flowTileTextContent}>
                <Text style={[styles.flowTileLabel, data.flow === f.id && styles.flowTileLabelActive]}>{f.label}</Text>
                <Text style={[styles.flowTileDesc, data.flow === f.id && styles.flowTileLabelActive]}>{f.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Difficulty */}
      <View style={styles.sectionMargin}>
        <Text style={styles.labelCenter}>体感難易度</Text>
        <View style={styles.difficultyContainer}>
          {[
            { id: 'easy', label: 'ゆったり', emoji: '😊' },
            { id: 'normal', label: '普通', emoji: '👌' },
            { id: 'hard', label: 'ハード', emoji: '😰' }
          ].map(d => (
            <TouchableOpacity
              key={d.id}
              onPress={() => onChange({ difficulty: d.id as any })}
              style={[styles.diffBtn, data.difficulty === d.id && styles.diffBtnActive]}
            >
              <Text style={styles.diffEmoji}>{d.emoji}</Text>
              <Text style={[styles.diffLabel, data.difficulty === d.id && styles.diffLabelActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const Step3 = ({
  data,
  onChange,
  onRadarChange,
  onPickImage,
  uploading
}: {
  data: Partial<Review>,
  onChange: (d: Partial<Review>) => void,
  onRadarChange: (r: Partial<ReviewRadar>) => void,
  onPickImage: () => void,
  uploading: boolean
}) => (
  <ScrollView style={{ width }} contentContainerStyle={styles.stepContent}>
    <Text style={styles.stepTitle}>今回の感想・評価</Text>

    <View style={styles.radarCard}>
      <View style={styles.radarHeader}>
        <Sparkles size={16} color="#fbbf24" style={{ marginRight: 8 }} />
        <Text style={styles.radarHeaderText}>詳細評価 (6象限)</Text>
      </View>
      <View style={styles.radarList}>
        <RadarRow label="透明感 (Auto)" value={data.radar!.visibility} onChange={(v) => onRadarChange({ visibility: v })} color="#38bdf8" />
        <RadarRow label="遭遇ポイント" value={data.radar!.encounter} onChange={(v) => onRadarChange({ encounter: v })} color="#0ea5e9" />
        <RadarRow label="地形満足度" value={data.radar!.topography} onChange={(v) => onRadarChange({ topography: v })} color="#f59e0b" />
        <RadarRow label="エキサイト" value={data.radar!.excite} onChange={(v) => onRadarChange({ excite: v })} color="#f43f5e" />
        <RadarRow label="快適さ / 余裕" value={data.radar!.comfort} onChange={(v) => onRadarChange({ comfort: v })} color="#6366f1" />
        <RadarRow label="総合満足度" value={data.radar!.satisfaction} onChange={(v) => { onRadarChange({ satisfaction: v }); onChange({ rating: v }) }} color="#fbbf24" />
      </View>
    </View>

    <Text style={styles.label}>写真を追加</Text>
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
        </View>
      ))}
    </View>

    <Text style={styles.label}>タグ</Text>
    <View style={styles.tagsGrid}>
      {['ドリフト', '絶景', '魚群', '透明度抜群', '洞窟', 'ドロップオフ', '沈船', 'サンゴ', 'ハゼ', 'ウミウシ'].map(tag => (
        <TouchableOpacity
          key={tag}
          onPress={() => {
            const newTags = data.tags?.includes(tag)
              ? data.tags.filter((t: string) => t !== tag)
              : [...(data.tags || []), tag];
            onChange({ tags: newTags });
          }}
          style={[styles.tag, data.tags?.includes(tag) && styles.tagActive]}
        >
          <Text style={[styles.tagText, data.tags?.includes(tag) && styles.tagTextActive]}>#{tag}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <Text style={styles.label}>コメント</Text>
    <TextInput
      style={styles.textArea}
      multiline
      placeholder="今日の海はどうでしたか？"
      value={data.comment}
      onChangeText={t => onChange({ comment: t })}
    />

    <View style={styles.reviewerInfo}>
      <View style={styles.infoRow}>
        <Shield size={16} color="#64748b" />
        <Text style={styles.infoTitle}>レビュアー情報 (自己申告)</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.flex1, { marginRight: 8 }]}>
          <Text style={styles.subLabel}>指導団体</Text>
          <View style={styles.selectBox}>
            <TextInput
              style={styles.selectInput}
              value={CERTIFICATIONS.find(o => o.id === data.userOrgId)?.name || 'PADI'}
              editable={false}
            />
            {/* Simple list of orgs for now */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgList}>
              {CERTIFICATIONS.map(o => (
                <TouchableOpacity key={o.id} onPress={() => onChange({ userOrgId: o.id, userRank: 'entry' })} style={[styles.orgChip, data.userOrgId === o.id && styles.orgChipActive]}>
                  <Text style={[styles.orgChipText, data.userOrgId === o.id && styles.orgChipTextActive]}>{o.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.subLabel}>ランク</Text>
          <View style={styles.selectBox}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CERTIFICATIONS.find(o => o.id === (data.userOrgId || 'padi'))?.ranks.map(r => (
                <TouchableOpacity key={r.id} onPress={() => onChange({ userRank: r.id })} style={[styles.orgChip, data.userRank === r.id && styles.orgChipActive]}>
                  <Text style={[styles.orgChipText, data.userRank === r.id && styles.orgChipTextActive]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <Text style={styles.subLabel}>経験本数</Text>
        <TextInput
          style={styles.inputSmall}
          keyboardType="numeric"
          value={String(data.userLogsCount || 0)}
          onChangeText={t => onChange({ userLogsCount: Number(t) })}
        />
      </View>
    </View>
  </ScrollView>
);

const RadarRow = ({ label, value, onChange, color }: { label: string, value: number, onChange: (v: number) => void, color: string }) => (
  <View style={styles.radarRow}>
    <Text style={styles.radarLabel}>{label}</Text>
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} style={{ marginLeft: 6 }}>
          <Star size={18} color={i <= value ? color : "#e2e8f0"} fill={i <= value ? color : "transparent"} />
        </TouchableOpacity>
      ))}
    </View>
  </View>
);
