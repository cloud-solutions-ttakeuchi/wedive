import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { collection, getDocs, query, limit, orderBy, where } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Point, Creature } from '../../src/types';
import { Star, MapPin, Sparkles, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';
import { usePoints } from '../../src/hooks/usePoints';
import { useCreatures } from '../../src/hooks/useCreatures';
import { useHomeData } from '../../src/hooks/useHomeData';
import { FEATURE_FLAGS } from '../../src/constants/features';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');
const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');
const NO_IMAGE_USER = require('../../assets/images/no-image-user.png');

export default function TabOneScreen() {
  const router = useRouter();
  const { data: allPoints = [], isLoading: pLoading } = usePoints();
  const { data: allCreatures = [], isLoading: cLoading } = useCreatures();
  const { latestReviews, isLoading: rLoading } = useHomeData();

  const isLoading = pLoading || cLoading || rLoading;

  // 評価（rating）が高い順にソートして、評価がついているものを優先
  const popularPoints = allPoints
    .filter(p => p.status === 'approved')
    .sort((a, b) => {
      // 両方評価ありなら評価順
      if (a.rating && b.rating) return b.rating - a.rating;
      // 評価ありを優先
      if (a.rating) return -1;
      if (b.rating) return 1;
      // どちらもなしならID順
      return 0;
    })
    .slice(0, 5);

  const creatures = allCreatures.filter(c => c.status === 'approved').slice(0, 10);

  /*
  useEffect(() => {
    // Legacy fetching logic removed
  }, []);
  */

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} stickyHeaderIndices={[0]}>
        {/* Search Header Placeholder */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}><Text style={styles.logoBrand}>We</Text>Dive</Text>
            </View>
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => router.push('/search')}
            >
              <Text style={styles.searchText}>スポットや生物を検索...</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Hero Section */}
          {FEATURE_FLAGS.ENABLE_V2_AI_CONCIERGE && (
            <View style={styles.heroSection}>
              <View style={styles.aiBadge}>
                <Sparkles size={12} color="#0ea5e9" />
                <Text style={styles.aiBadgeText}>NEW AI FEATURE</Text>
              </View>
              <Text style={styles.heroTitle}>あなただけの{"\n"}<Text style={styles.heroHighlight}>コンシェルジュ</Text></Text>
              <Text style={styles.heroDesc}>最高のダイビングプランをAIと一緒に作りましょう。</Text>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => router.push('/ai')}
              >
                <Text style={styles.heroBtnText}>AIに相談する</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Featured Spot */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FEATURED SPOTS</Text>
              <TouchableOpacity onPress={() => router.push('/search?tab=spots')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            {popularPoints.length === 0 ? (
              <Text style={styles.emptyText}>No spots found.</Text>
            ) : (
              <FlatList
                data={popularPoints}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.horizontalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.popularPointCard}
                    onPress={() => router.push(`/details/spot/${item.id}`)}
                  >
                    <ImageWithFallback
                      source={item.imageUrl ? { uri: item.imageUrl } : null}
                      fallbackSource={NO_IMAGE_POINT}
                      style={styles.popularPointImage}
                    />
                    <View style={styles.popularPointOverlay}>
                      <View style={styles.ratingBadge}>
                        <Star size={10} color="#fbbf24" fill="#fbbf24" />
                        <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : '-'}</Text>
                      </View>
                      <Text style={styles.popularPointName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.popularPointLoc} numberOfLines={1}>{item.area}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* Latest Reviews (NEW) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LATEST REVIEWS</Text>
              <TouchableOpacity onPress={() => { }}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            {latestReviews.length === 0 ? (
              <Text style={styles.emptyText}>No reviews yet.</Text>
            ) : (
              <FlatList
                data={latestReviews}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.horizontalList}
                renderItem={({ item }) => {
                  const point = allPoints.find(p => p.id === item.pointId);
                  return (
                    <TouchableOpacity
                      style={styles.reviewCard}
                      onPress={() => item.pointId && router.push(`/details/spot/${item.pointId}`)}
                    >
                      <View style={styles.reviewHeader}>
                        <ImageWithFallback
                          source={null}
                          fallbackSource={NO_IMAGE_USER}
                          style={styles.reviewUserIcon}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewPointName} numberOfLines={1}>
                            {point ? point.name : 'Unknown Point'}
                          </Text>
                          <View style={styles.ratingRow}>
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={10}
                                color={i < (item.rating || 0) ? "#fbbf24" : "#e2e8f0"}
                                fill={i < (item.rating || 0) ? "#fbbf24" : "transparent"}
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                      <Text style={styles.reviewComment} numberOfLines={2}>
                        {item.comment || 'No comment'}
                      </Text>
                      <View style={styles.reviewFooter}>
                        <Text style={styles.reviewDate}>
                          {item.date ? new Date(item.date).toLocaleDateString() : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {/* Popular Creatures */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>POPULAR CREATURES</Text>
              <TouchableOpacity onPress={() => router.push('/search?tab=creatures')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            <FlatList
              data={creatures}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.creatureList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.creatureCard}
                  onPress={() => router.push(`/details/creature/${item.id}`)}
                >
                  <View style={styles.creatureImageWrapper}>
                    <ImageWithFallback
                      source={item.imageUrl ? { uri: item.imageUrl } : null}
                      fallbackSource={NO_IMAGE_CREATURE}
                      style={styles.creatureImage}
                    />
                  </View>
                  <View style={styles.creatureInfo}>
                    <Text style={styles.creatureCategory}>{item.category}</Text>
                    <Text style={styles.creatureName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.rarityRow}>
                      <Star size={10} color="#fbbf24" fill="#fbbf24" />
                      {/* Note: rarity logic requires complex calculation, falling back to static for now or item.rarity */}
                      <Text style={styles.rarityText}>{item.rarity || 'Common'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button for Add Log */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/log/add')}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  headerContent: {
    backgroundColor: 'transparent',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 2,
    marginBottom: 6,
  },
  logoImage: {
    height: 50,
    width: 50,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: -0.5,
  },
  logoBrand: {
    color: '#0ea5e9',
  },
  searchBar: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  searchText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  heroSection: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    marginTop: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0ea5e9',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0c4a6e',
    lineHeight: 34,
    marginBottom: 8,
  },
  heroHighlight: {
    color: '#0ea5e9',
  },
  heroDesc: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  horizontalList: {
    paddingRight: 20,
    backgroundColor: 'transparent',
  },

  // Popular Point Card (New)
  popularPointCard: {
    width: 200,
    height: 140,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  popularPointImage: {
    width: '100%',
    height: '100%',
  },
  popularPointOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: 'bold',
  },
  popularPointName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  popularPointLoc: {
    color: '#cbd5e1',
    fontSize: 11,
  },

  // Review Card (New)
  reviewCard: {
    width: 260,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  reviewUserIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  reviewPointName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    height: 36, // 2 lines
  },
  reviewFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  reviewDate: {
    fontSize: 11,
    color: '#94a3b8',
  },

  // Creature Card
  creatureList: {
    paddingRight: 20,
    backgroundColor: 'transparent',
  },
  creatureCard: {
    width: 130,
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  creatureImageWrapper: {
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  creatureImage: {
    width: '100%',
    height: '100%',
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  rarityText: {
    fontSize: 10,
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  heroBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 20,
  },
});
