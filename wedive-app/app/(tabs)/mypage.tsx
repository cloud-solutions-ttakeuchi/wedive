import React, { useState } from 'react';
import { StyleSheet, Pressable, ScrollView, Image, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { LogOut, ChevronRight, Bookmark, Heart, Settings, Activity, BookOpen, Grid, User as UserIcon, Award, Star, MapPin, Plus, Clock, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useApp } from '../../src/context/AppContext';
import { DiveLog, Creature, Point } from '../../src/types';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');
const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');
const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');

type TabType = 'dashboard' | 'logbook' | 'collection' | 'favorites' | 'wanted' | 'plan';

export default function MyPageScreen() {
  const router = useRouter();
  const { user, logs, isLoading: authLoading, signOut } = useAuth();
  const { creatures, points, isLoading: appLoading } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const isLoading = authLoading || appLoading;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { padding: 40 }]}>
        <View style={styles.guestIconBg}>
          <UserIcon size={48} color="#94a3b8" />
        </View>
        <Text style={styles.guestTitle}>ログインが必要です</Text>
        <Text style={styles.guestText}>
          ログブックの記録やコレクション、お気に入りの保存にはログインが必要です。
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginBtnText}>ログインする</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signupBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.signupBtnText}>アカウント作成</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Derived Data
  const uniqueCreatureIds = Array.from(new Set(logs.flatMap(l => [l.creatureId, ...(l.sightedCreatures || [])]).filter(Boolean)));
  const discoveredCreatures = uniqueCreatureIds.map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined);
  const favoriteCreatures = (user?.favoriteCreatureIds || []).map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined);
  const wantedCreatures = (user?.wanted || []).map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined);
  const bookmarkedPoints = (user?.bookmarkedPointIds || []).map(id => points.find(p => p.id === id)).filter((p): p is Point => p !== undefined);

  const completionRate = creatures.length > 0 ? Math.round((uniqueCreatureIds.length / creatures.length) * 100) : 0;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>STATS</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{logs.length || 0}</Text>
                  <Text style={styles.statLabel}>Dives</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{uniqueCreatureIds.length}</Text>
                  <Text style={styles.statLabel}>Found</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#0ea5e9' }]}>{completionRate}%</Text>
                  <Text style={styles.statLabel}>Comp.</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>MASTERY</Text>
              {/* Simplified Point Mastery for mobile */}
              {bookmarkedPoints.slice(0, 3).map(point => (
                <TouchableOpacity
                  key={point.id}
                  style={styles.masteryRow}
                  onPress={() => router.push(`/details/spot/${point.id}`)}
                >
                  <View style={styles.masteryInfo}>
                    <Text style={styles.masteryPointName}>{point.name}</Text>
                    <Text style={styles.masteryPointArea}>{point.area || point.region}</Text>
                  </View>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
              {bookmarkedPoints.length === 0 && (
                <Text style={styles.emptyMasteryText}>ブックマークしたポイントの進捗が表示されます。</Text>
              )}
            </View>
          </View>
        );
      case 'logbook':
        return (
          <View style={styles.tabContent}>
            {logs.length > 0 ? (
              <View style={{ gap: 12 }}>
                {logs.map((log: DiveLog) => (
                  <TouchableOpacity
                    key={log.id}
                    style={styles.logCard}
                    onPress={() => router.push(`/log/${log.id}` as any)}
                  >
                    <View style={styles.logCardHeader}>
                      <View>
                        <Text style={styles.logDate}>{log.date}</Text>
                        <Text style={styles.logTitle}>{log.title}</Text>
                      </View>
                      <View style={styles.diveNumBadge}>
                        <Text style={styles.diveNumText}>#{log.diveNumber || '-'}</Text>
                      </View>
                    </View>
                    <View style={styles.logCardFooter}>
                      <View style={styles.logMeta}>
                        <MapPin size={12} color="#64748b" />
                        <Text style={styles.logMetaText}>{log.location.pointName}</Text>
                      </View>
                      <View style={styles.logMeta}>
                        <Clock size={12} color="#64748b" />
                        <Text style={styles.logMetaText}>{log.time.duration} min</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <BookOpen size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>まだログがありません。ダイビングを記録しましょう！</Text>
                <TouchableOpacity
                  style={styles.addLogBtnInline}
                  onPress={() => router.push('/log/add')}
                >
                  <Plus size={20} color="#fff" />
                  <Text style={styles.addLogBtnInlineText}>最初のログを追加</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      case 'collection':
        return (
          <View style={styles.tabContent}>
            <View style={styles.creatureGrid}>
              {discoveredCreatures.map(creature => (
                <TouchableOpacity
                  key={creature.id}
                  style={styles.creatureSmallCard}
                  onPress={() => router.push(`/details/creature/${creature.id}`)}
                >
                  <ImageWithFallback
                    source={creature.imageUrl ? { uri: creature.imageUrl } : null}
                    fallbackSource={NO_IMAGE_CREATURE}
                    style={styles.creatureSmallThumb}
                  />
                  <View style={styles.creatureSmallInfo}>
                    <Text style={styles.creatureSmallName} numberOfLines={1}>{creature.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {discoveredCreatures.length === 0 && (
                <View style={styles.emptyState}>
                  <Grid size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>まだ発見した生物がいません。</Text>
                </View>
              )}
            </View>
          </View>
        );
      case 'favorites':
        return (
          <View style={styles.tabContent}>
            <View style={styles.creatureGrid}>
              {favoriteCreatures.map(creature => (
                <TouchableOpacity
                  key={creature.id}
                  style={styles.creatureSmallCard}
                  onPress={() => router.push(`/details/creature/${creature.id}`)}
                >
                  <ImageWithFallback
                    source={creature.imageUrl ? { uri: creature.imageUrl } : null}
                    fallbackSource={NO_IMAGE_CREATURE}
                    style={styles.creatureSmallThumb}
                  />
                  <View style={styles.creatureSmallInfo}>
                    <Text style={styles.creatureSmallName} numberOfLines={1}>{creature.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {favoriteCreatures.length === 0 && (
                <View style={styles.emptyState}>
                  <Heart size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>お気に入りの生物がありません。</Text>
                </View>
              )}
            </View>
          </View>
        );
      case 'wanted':
        return (
          <View style={styles.tabContent}>
            <View style={styles.creatureGrid}>
              {wantedCreatures.map(creature => (
                <TouchableOpacity
                  key={creature.id}
                  style={styles.creatureSmallCard}
                  onPress={() => router.push(`/details/creature/${creature.id}`)}
                >
                  <ImageWithFallback
                    source={creature.imageUrl ? { uri: creature.imageUrl } : null}
                    fallbackSource={NO_IMAGE_CREATURE}
                    style={styles.creatureSmallThumb}
                  />
                  {uniqueCreatureIds.includes(creature.id) && (
                    <View style={styles.checkBadge}>
                      <Star size={10} color="#fff" fill="#fff" />
                    </View>
                  )}
                  <View style={styles.creatureSmallInfo}>
                    <Text style={styles.creatureSmallName} numberOfLines={1}>{creature.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {wantedCreatures.length === 0 && (
                <View style={styles.emptyState}>
                  <Bookmark size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>いつか見たい生物を登録しましょう。</Text>
                </View>
              )}
            </View>
          </View>
        );
      case 'plan':
        return (
          <View style={styles.tabContent}>
            <View style={{ gap: 12 }}>
              {bookmarkedPoints.map(point => (
                <TouchableOpacity
                  key={point.id}
                  style={styles.pointRowCard}
                  onPress={() => router.push(`/details/spot/${point.id}`)}
                >
                  <ImageWithFallback
                    source={point.imageUrl ? { uri: point.imageUrl } : null}
                    fallbackSource={NO_IMAGE_POINT}
                    style={styles.pointRowThumb}
                  />
                  <View style={styles.pointRowInfo}>
                    <Text style={styles.pointRowName}>{point.name}</Text>
                    <Text style={styles.pointRowArea}>{point.area || point.region}</Text>
                  </View>
                  <ChevronRight size={20} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
              {bookmarkedPoints.length === 0 && (
                <View style={styles.emptyState}>
                  <MapPin size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>行きたいスポットをブックマークしましょう。</Text>
                </View>
              )}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: user.profileImage || 'https://via.placeholder.com/150' }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.name || 'Diver'}</Text>
              <Text style={styles.role}>{user.role === 'admin' ? 'Admin' : 'Diver'}</Text>
              <View style={styles.rankBadge}>
                <Sparkles size={10} color="#0ea5e9" fill="#0ea5e9" />
                <Text style={styles.rankText}>{user.trustScore || 0} TP</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.settingsBtn, { marginRight: 8 }]}
              onPress={() => router.push('/log/add')}
            >
              <Plus size={20} color="#0ea5e9" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn}>
              <Settings size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBar}
        >
          {[
            { id: 'dashboard', icon: Activity, label: 'ダッシュボード' },
            { id: 'logbook', icon: BookOpen, label: 'ログブック' },
            { id: 'collection', icon: Grid, label: 'コレクション' },
            { id: 'favorites', icon: Heart, label: 'Favorites' },
            { id: 'wanted', icon: Bookmark, label: 'Wanted' },
            { id: 'plan', icon: MapPin, label: 'Plan' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, activeTab === tab.id && styles.activeTabItem]}
              onPress={() => setActiveTab(tab.id as TabType)}
            >
              <tab.icon size={20} color={activeTab === tab.id ? '#0ea5e9' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {renderContent()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTRIBUTION</Text>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/details/spot/add')}
          >
            <View style={styles.menuLeft}>
              <MapPin size={20} color="#0ea5e9" />
              <Text style={styles.menuLabel}>Propose a Spot</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/details/creature/add')}
          >
            <View style={styles.menuLeft}>
              <Sparkles size={20} color="#8b5cf6" />
              <Text style={styles.menuLabel}>Propose a Creature</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVITY</Text>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/search?tab=spots')}
          >
            <View style={styles.menuLeft}>
              <Bookmark size={20} color="#0ea5e9" />
              <Text style={styles.menuLabel}>Bookmarked Spots</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/search?tab=creatures')}
          >
            <View style={styles.menuLeft}>
              <Heart size={20} color="#ef4444" />
              <Text style={styles.menuLabel}>Favorite Creatures</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Settings size={20} color="#64748b" />
              <Text style={styles.menuLabel}>Account Settings</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
          <Pressable style={[styles.menuItem, styles.lastItem]} onPress={handleSignOut}>
            <View style={styles.menuLeft}>
              <LogOut size={20} color="#94a3b8" />
              <Text style={styles.menuLabel}>Log Out</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.footerText}>WeDive Mobile v1.0.0</Text>
      </ScrollView>

      {activeTab === 'logbook' && logs.length > 0 && (
        <TouchableOpacity
          style={styles.addLogBtnFab}
          onPress={() => router.push('/log/add')}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    marginRight: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  role: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 4,
  },
  rankText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  tabBarScroll: {
    flexGrow: 0,
    backgroundColor: '#fff',
  },
  tabItem: {
    minWidth: 80,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#0ea5e9',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#0ea5e9',
  },
  tabContent: {
    padding: 20,
    backgroundColor: '#f8fafc',
    minHeight: 200,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94a3b8',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fefce8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'transparent',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 12,
    marginBottom: 4,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  footerText: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 20,
  },
  addLogBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  addLogBtnInlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 2,
  },
  diveNumBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diveNumText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  logCardFooter: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 12,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  addLogBtnFab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  guestIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  guestText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  loginBtn: {
    backgroundColor: '#0ea5e9',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupBtn: {
    backgroundColor: '#fff',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signupBtnText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  creatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  creatureSmallCard: {
    width: (width - 40 - 12) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureSmallThumb: {
    width: '100%',
    aspectRatio: 1,
  },
  creatureSmallInfo: {
    padding: 8,
  },
  creatureSmallName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  masteryInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  masteryPointName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  masteryPointArea: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyMasteryText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pointRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pointRowThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  pointRowInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pointRowName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  pointRowArea: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
