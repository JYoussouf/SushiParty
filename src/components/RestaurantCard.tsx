import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';
import { formatDistance } from '../lib/geo';
import { formatRating, priceLevelLabel, type FeedRestaurant } from '../lib/featuredFeed';

interface RestaurantCardProps {
  restaurant: FeedRestaurant;
  onPress: () => void;
}

// Slick, DoorDash-style row: thumbnail tile, name, and a compact meta line
// (rating · reviews · distance · price · open-now). Featured spots get a badge.
export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const rating = formatRating(restaurant.rating, restaurant.userRatingCount);
  const price = priceLevelLabel(restaurant.priceLevel);

  return (
    <TouchableOpacity
      style={[styles.card, restaurant.featured && styles.cardFeatured]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Directions to ${restaurant.name}`}
    >
      <View style={styles.thumb}>
        <Text style={styles.thumbEmoji}>🍣</Text>
      </View>

      <View style={styles.body}>
        {restaurant.featured ? (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>★ Featured</Text>
          </View>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>
        {restaurant.address ? (
          <Text style={styles.address} numberOfLines={1}>
            {restaurant.address}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {rating ? (
            <Text style={styles.metaStrong}>
              ★ {rating}
              {restaurant.userRatingCount ? (
                <Text style={styles.metaSoft}> ({restaurant.userRatingCount.toLocaleString()})</Text>
              ) : null}
            </Text>
          ) : null}
          {restaurant.distanceKm !== undefined ? (
            <Text style={styles.metaSoft}>{formatDistance(restaurant.distanceKm)}</Text>
          ) : null}
          {price ? <Text style={styles.metaSoft}>{price}</Text> : null}
          {restaurant.openNow !== undefined ? (
            <Text style={restaurant.openNow ? styles.open : styles.closed}>
              {restaurant.openNow ? 'Open' : 'Closed'}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 12,
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      ...t.shadow.card,
    },
    cardFeatured: {
      borderColor: t.color.amber,
      ...t.shadow.glow(t.color.amber),
    },
    thumb: {
      width: 58,
      height: 58,
      borderRadius: t.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.color.surfaceAlt,
    },
    thumbEmoji: { fontSize: 30 },
    body: { flex: 1, gap: 2 },
    featuredBadge: {
      alignSelf: 'flex-start',
      backgroundColor: t.color.amber,
      borderRadius: t.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginBottom: 2,
    },
    featuredBadgeText: {
      fontSize: 10,
      fontFamily: t.font.bodyBold,
      color: '#1A1300',
      letterSpacing: 0.4,
    },
    name: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
    address: { fontSize: 13, fontFamily: t.font.body, color: t.color.textTertiary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 3 },
    metaStrong: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.amber },
    metaSoft: { fontSize: 13, fontFamily: t.font.bodySemibold, color: t.color.textSecondary },
    open: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.success },
    closed: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.textTertiary },
    chevron: { fontSize: 24, color: t.color.textTertiary, paddingRight: 4 },
  });
