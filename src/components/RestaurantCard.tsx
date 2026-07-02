import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';
import { formatDistance } from '../lib/geo';
import { formatRating, priceLevelLabel, type FeedRestaurant } from '../lib/featuredFeed';

interface RestaurantCardProps {
  restaurant: FeedRestaurant;
  onPress: () => void;
  saved: boolean;
  onToggleSave: () => void;
}

// DoorDash-style vertical card: an optional photo carousel on top (photos come
// only from a restaurant's partner profile), then name + a compact meta line.
// Restaurants without a profile simply render everything minus the images.
export function RestaurantCard({ restaurant, onPress, saved, onToggleSave }: RestaurantCardProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const rating = formatRating(restaurant.rating, restaurant.userRatingCount);
  const price = priceLevelLabel(restaurant.priceLevel);
  const photos = restaurant.photos ?? [];

  return (
    <View style={styles.card}>
      {photos.length > 0 ? <PhotoCarousel photos={photos} styles={styles} /> : null}

      <TouchableOpacity style={styles.info} activeOpacity={0.85} onPress={onPress}>
        <View style={styles.infoText}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.metaRow}>
            {rating ? (
              <Text style={styles.metaStrong}>
                {rating} ★
                {restaurant.userRatingCount ? (
                  <Text style={styles.metaSoft}> ({restaurant.userRatingCount.toLocaleString()})</Text>
                ) : null}
              </Text>
            ) : null}
            {restaurant.distanceKm !== undefined ? (
              <>
                {rating ? <Text style={styles.dot}>·</Text> : null}
                <Text style={styles.metaSoft}>{formatDistance(restaurant.distanceKm)}</Text>
              </>
            ) : null}
            {price ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaSoft}>{price}</Text>
              </>
            ) : null}
            {restaurant.openNow !== undefined ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={restaurant.openNow ? styles.open : styles.closed}>
                  {restaurant.openNow ? 'Open' : 'Closed'}
                </Text>
              </>
            ) : null}
          </View>
          {restaurant.featured ? <Text style={styles.sponsored}>Sponsored</Text> : null}
        </View>

        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onToggleSave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={saved ? `Unsave ${restaurant.name}` : `Save ${restaurant.name}`}
        >
          <Text style={[styles.heart, saved && styles.heartActive]}>{saved ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

function PhotoCarousel({ photos, styles }: { photos: string[]; styles: ReturnType<typeof makeStyles> }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  // Render the images only once the width is known, so they never paint at
  // width 0 and flash. The fixed-height wrapper reserves the space meanwhile.
  return (
    <View style={styles.photoWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {photos.map((uri, i) => (
              <Image key={`${uri}-${i}`} source={{ uri }} style={[styles.photo, { width }]} resizeMode="cover" />
            ))}
          </ScrollView>
          {photos.length > 1 ? (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dotPip, i === active && styles.dotPipActive]} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const PHOTO_HEIGHT = 172;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      overflow: 'hidden',
      ...t.shadow.card,
    },
    photoWrap: {
      width: '100%',
      height: PHOTO_HEIGHT,
      backgroundColor: t.color.surfaceAlt,
    },
    photo: { height: PHOTO_HEIGHT },
    dots: {
      position: 'absolute',
      bottom: 10,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    dotPip: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
    dotPipActive: { backgroundColor: '#FFFFFF' },
    info: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    infoText: { flex: 1, gap: 4 },
    name: { fontSize: 18, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    metaStrong: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
    metaSoft: { fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary },
    dot: { fontSize: 14, color: t.color.textTertiary },
    open: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.success },
    closed: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.textTertiary },
    sponsored: { fontSize: 13, fontFamily: t.font.body, color: t.color.textTertiary },
    heartBtn: { paddingTop: 2 },
    heart: { fontSize: 24, color: t.color.textTertiary },
    heartActive: { color: t.color.accent },
  });
