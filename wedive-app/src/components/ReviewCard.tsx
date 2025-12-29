import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Star, MessageSquare, ThumbsUp, Shield, Clock, Droplets, Thermometer, Wind, AlertCircle } from 'lucide-react-native';
import { Review } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

const { width } = Dimensions.get('window');

interface ReviewCardProps {
  review: Review;
  onPress?: () => void;
  isOwn?: boolean;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review, onPress, isOwn }) => {
  const isPending = review.status === 'pending';

  const getTrustColor = (level: Review['trustLevel']) => {
    switch (level) {
      case 'official': return '#0ea5e9';
      case 'expert': return '#8b5cf6';
      case 'verified': return '#10b981';
      default: return '#94a3b8';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, isPending && styles.pendingCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header: User Info */}
      <View style={styles.header}>
        <ImageWithFallback
          source={review.userProfileImage ? { uri: review.userProfileImage } : null}
          fallbackSource={require('../../assets/images/no-image-creature.png')}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{review.userName}</Text>
            {review.trustLevel !== 'standard' && (
              <Shield size={12} color={getTrustColor(review.trustLevel)} fill={getTrustColor(review.trustLevel)} />
            )}
          </View>
          <Text style={styles.userMeta}>
            {review.userLogsCount} Dives
            {review.userOrgId ? ` • ${review.userOrgId.toUpperCase()}` : ''}
            {review.userRank ? ` ${review.userRank.toUpperCase()}` : ''}
          </Text>
        </View>
        <View style={styles.ratingBadge}>
          <Star size={12} color="#f59e0b" fill="#f59e0b" />
          <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Date and Status Banner */}
      <View style={styles.dateRow}>
        <View style={styles.dateItem}>
          <Clock size={12} color="#94a3b8" />
          <Text style={styles.dateText}>{review.date || 'Unknown Date'}</Text>
        </View>
        {isPending && (
          <View style={styles.pendingBadge}>
            <AlertCircle size={10} color="#f59e0b" />
            <Text style={styles.pendingText}>承認待ち (審査中)</Text>
          </View>
        )}
      </View>

      {/* Comment */}
      <Text style={styles.comment} numberOfLines={3}>
        {review.comment || 'コメントなし'}
      </Text>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Droplets size={14} color="#0ea5e9" />
          <Text style={styles.metricText}>{review.metrics.visibility}m</Text>
        </View>
        <View style={styles.metric}>
          <Thermometer size={14} color="#f43f5e" />
          <Text style={styles.metricText}>{review.condition.waterTemp || '--'}°C</Text>
        </View>
        <View style={styles.metric}>
          <Wind size={14} color="#10b981" />
          <Text style={styles.metricText}>{review.metrics.flow === 'none' ? 'なし' : review.metrics.flow === 'weak' ? '弱' : '強'}</Text>
        </View>
      </View>

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <View style={styles.imageGrid}>
          {review.images.slice(0, 3).map((img, idx) => (
            <Image key={idx} source={{ uri: img }} style={styles.thumb} />
          ))}
          {review.images.length > 3 && (
            <View style={styles.moreImages}>
              <Text style={styles.moreText}>+{review.images.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer: Tags and Helpfulness */}
      <View style={styles.footer}>
        <View style={styles.tags}>
          {review.tags.slice(0, 2).map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <ThumbsUp size={14} color="#64748b" />
            <Text style={styles.actionText}>{review.helpfulCount || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pendingCard: {
    borderColor: '#fef3c7',
    backgroundColor: '#fffbeb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  userMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f59e0b',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  pendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#d97706',
  },
  comment: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 12,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  imageGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  thumb: {
    width: (width - 64 - 16) / 3,
    height: (width - 64 - 16) / 3,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  moreImages: {
    width: (width - 64 - 16) / 3,
    height: (width - 64 - 16) / 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
  },
  moreText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});
