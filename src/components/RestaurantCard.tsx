import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';
import { formatDistance } from '../lib/geo';
import { formatRating, priceLevelLabel, type FeedRestaurant } from '../lib/featuredFeed';

// Maps-style "Directions" glyph: an accent diamond road-sign with a white turn arrow.
function DirectionsIcon({ size, color, arrow }: { size: number; color: string; arrow: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.4-.38.4-1.01.01-1.41z"
        fill={color}
      />
      <Path d="M14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" fill={arrow} />
    </Svg>
  );
}

interface RestaurantCardProps {
  restaurant: FeedRestaurant;
  onDirections: () => void;
  saved: boolean;
  onToggleSave: () => void;
}

// DoorDash-style vertical card: an optional photo carousel on top (photos come
// only from a restaurant's partner profile), then name + a compact meta line.
// Restaurants without a profile simply render everything minus the images.
export function RestaurantCard({ restaurant, onDirections, saved, onToggleSave }: RestaurantCardProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const rating = formatRating(restaurant.rating, restaurant.userRatingCount);
  const price = priceLevelLabel(restaurant.priceLevel);
  const photos = restaurant.photos ?? [];

  // Only the segments that actually have a value, so separators land between
  // real values (no stray leading "·") and the row is omitted when empty.
  const metaSegments: React.ReactNode[] = [];
  if (rating) {
    // Gold star first so this reads clearly as a rating (not confused with the
    // distance number that follows).
    metaSegments.push(
      <Text key="rating" style={styles.metaStrong}>
        <Text style={styles.starIcon}>★</Text> {rating}
        {restaurant.userRatingCount ? (
          <Text style={styles.metaSoft}> ({restaurant.userRatingCount.toLocaleString()})</Text>
        ) : null}
      </Text>,
    );
  } else {
    // No rating available. This does NOT mean the place is new — some spots
    // (e.g. sushi counters inside grocery stores) have reviews hidden — so keep
    // it neutral rather than labelling it "New".
    metaSegments.push(
      <Text key="norating" style={styles.noReviews}>
        No reviews
      </Text>,
    );
  }
  if (restaurant.distanceKm !== undefined) {
    metaSegments.push(
      <Text key="dist" style={styles.metaSoft}>
        {formatDistance(restaurant.distanceKm)}
      </Text>,
    );
  }
  if (price) {
    metaSegments.push(
      <Text key="price" style={styles.metaSoft}>
        {price}
      </Text>,
    );
  }
  if (restaurant.openNow !== undefined) {
    metaSegments.push(
      <Text key="open" style={restaurant.openNow ? styles.open : styles.closed}>
        {restaurant.openNow ? 'Open' : 'Closed'}
      </Text>,
    );
  }

  return (
    <View style={styles.card}>
      {photos.length > 0 ? <PhotoCarousel photos={photos} styles={styles} /> : null}

      <View style={styles.info}>
        <View style={styles.infoText}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {metaSegments.length > 0 ? (
            <View style={styles.metaRow}>
              {metaSegments.map((seg, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <Text style={styles.dot}>·</Text> : null}
                  {seg}
                </React.Fragment>
              ))}
            </View>
          ) : null}
          {restaurant.featured ? <Text style={styles.sponsored}>Sponsored</Text> : null}
        </View>

        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onToggleSave}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          accessibilityLabel={saved ? `Unsave ${restaurant.name}` : `Save ${restaurant.name}`}
        >
          <Text style={[styles.heart, saved && styles.heartActive]}>{saved ? '♥' : '♡'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={onDirections}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          accessibilityLabel={`Directions to ${restaurant.name}`}
        >
          <DirectionsIcon size={36} color={t.color.accent} arrow={t.color.onAccent} />
        </TouchableOpacity>
      </View>
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
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    infoText: { flex: 1, gap: 4 },
    name: { fontSize: 18, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    metaStrong: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
    metaSoft: { fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary },
    starIcon: { color: t.color.amber },
    noReviews: { fontSize: 14, fontFamily: t.font.body, color: t.color.textTertiary, fontStyle: 'italic' },
    dot: { fontSize: 14, color: t.color.textTertiary },
    open: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.success },
    closed: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.textTertiary },
    sponsored: { fontSize: 13, fontFamily: t.font.body, color: t.color.textTertiary },
    heartBtn: { padding: 2 },
    heart: { fontSize: 24, color: t.color.textTertiary },
    heartActive: { color: t.color.accent },
    directionsBtn: { alignItems: 'center', justifyContent: 'center', padding: 2 },
  });
