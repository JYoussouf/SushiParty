import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { buildPlaceInsights, type PlaceInsight } from '../../src/lib/placeInsights';
import {
  getFavoritePlaceKey,
  getViewedPlaces,
  setFavoritePlaceKey,
} from '../../src/lib/local/placeHistory';

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PlacesScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile } = useAuth();
  const [places, setPlaces] = useState<PlaceInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userProfile) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [sessions, viewed, favoriteKey] = await Promise.all([
        getAllSessions(),
        getViewedPlaces(),
        getFavoritePlaceKey(),
      ]);
      setPlaces(buildPlaceInsights(sessions, userProfile.uid, viewed, favoriteKey));
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleFavorite = async (place: PlaceInsight) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setFavoritePlaceKey(place.isFavorite ? null : place.name);
    await load();
  };

  const favorite = places.find((place) => place.isFavorite) ?? null;
  const partySpots = places.filter((place) => place.visited && !place.isFavorite);
  const browsed = places.filter((place) => !place.visited && !place.isFavorite);

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={t.color.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Your Places</Text>
            <Text style={styles.subtitle}>
              Spots you&apos;ve partied at and browsed. Tap the star to pin your favourite.
            </Text>

            {places.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No places yet. Pick a restaurant and log a party to start your map.
                </Text>
              </View>
            ) : (
              <>
                {favorite && (
                  <View style={styles.favoriteCard}>
                    <Text style={styles.favoriteLabel}>★ Favourite spot</Text>
                    <Text style={styles.favoriteName}>{favorite.name}</Text>
                    {favorite.address ? (
                      <Text style={styles.favoriteAddress}>{favorite.address}</Text>
                    ) : null}
                    <Text style={styles.favoriteMeta}>
                      {favorite.visited
                        ? `${favorite.visits} part${favorite.visits === 1 ? 'y' : 'ies'} · ${favorite.totalPieces} pieces`
                        : `Browsed ${formatDate(favorite.lastViewedAt)}`}
                    </Text>
                    <TouchableOpacity
                      style={styles.unpinBtn}
                      onPress={() => void toggleFavorite(favorite)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.unpinText}>Unpin favourite</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {partySpots.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Party spots</Text>
                    {partySpots.map((place) => (
                      <PlaceRow key={place.key} place={place} onStar={() => void toggleFavorite(place)} styles={styles} />
                    ))}
                  </View>
                )}

                {browsed.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Browsed, not yet partied</Text>
                    {browsed.map((place) => (
                      <PlaceRow key={place.key} place={place} onStar={() => void toggleFavorite(place)} styles={styles} />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function PlaceRow({
  place,
  onStar,
  styles,
}: {
  place: PlaceInsight;
  onStar: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{place.name}</Text>
        {place.address ? (
          <Text style={styles.address} numberOfLines={1}>
            {place.address}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {place.visited
            ? `${place.visits} part${place.visits === 1 ? 'y' : 'ies'} · ${place.totalPieces} pieces · last ${formatDate(place.lastVisitedAt)}`
            : `Browsed ${formatDate(place.lastViewedAt)}`}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.starBtn}
        onPress={onStar}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={[styles.star, place.isFavorite && styles.starActive]}>
          {place.isFavorite ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, gap: 16 },
    title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
    subtitle: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary, marginBottom: 4 },
    emptyCard: {
      borderRadius: t.radius.md,
      padding: 18,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
    },
    emptyText: { fontSize: 14, lineHeight: 21, fontFamily: t.font.body, color: t.color.textSecondary },
    favoriteCard: {
      borderRadius: t.radius.lg,
      padding: 20,
      gap: 4,
      backgroundColor: t.color.accentSoft,
      borderWidth: 1,
      borderColor: t.color.accent,
      ...t.shadow.glow(t.color.accent),
    },
    favoriteLabel: {
      fontSize: 12,
      fontFamily: t.font.bodyBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: t.color.accent,
    },
    favoriteName: { fontSize: 22, fontFamily: t.font.display, color: t.color.textPrimary },
    favoriteAddress: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
    favoriteMeta: { fontSize: 14, fontFamily: t.font.bodySemibold, color: t.color.textSecondary, marginTop: 2 },
    unpinBtn: { alignSelf: 'flex-start', marginTop: 10 },
    unpinText: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.accent },
    section: { gap: 10 },
    sectionTitle: {
      fontSize: 13,
      fontFamily: t.font.bodyBold,
      color: t.color.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: t.radius.md,
      padding: 16,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      ...t.shadow.card,
    },
    cardBody: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
    address: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
    meta: { fontSize: 13, fontFamily: t.font.body, color: t.color.textTertiary, marginTop: 2 },
    starBtn: { padding: 4 },
    star: { fontSize: 26, color: t.color.textTertiary },
    starActive: { color: t.color.amber },
  });
