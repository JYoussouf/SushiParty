import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useLocation } from '../../src/hooks/useLocation';
import { useRestaurant } from '../../src/contexts/RestaurantContext';
import {
  getNearbyRestaurants,
  searchRestaurantsByName,
} from '../../src/lib/cloudflare/restaurants';
import { formatDistance } from '../../src/lib/geo';
import { updateSession } from '../../src/lib/cloudflare/sessions';
import type { Restaurant } from '../../src/types';

type RestaurantWithDistance = Restaurant & { distanceKm?: number };

// Session-scoped cache so repeat searches are instant (cleared on app restart)
const searchCache = new Map<string, RestaurantWithDistance[]>();

export default function SessionRestaurantConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; origin?: string }>();
  const { location, permission, loading: locationLoading, refresh } = useLocation();
  const { setRestaurant } = useRestaurant();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [nearby, setNearby] = useState<RestaurantWithDistance[]>([]);
  const [searchResults, setSearchResults] = useState<RestaurantWithDistance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const origin = Array.isArray(params.origin) ? params.origin[0] : params.origin;

  useEffect(() => {
    if (!location) return;

    setListLoading(true);
    getNearbyRestaurants(location)
      .then(setNearby)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not load restaurants.';
        Alert.alert('Restaurant lookup failed', message);
      })
      .finally(() => setListLoading(false));
  }, [location]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const cacheKey = text.trim().toLowerCase();
    if (searchCache.has(cacheKey)) {
      setSearchResults(searchCache.get(cacheKey)!);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      searchRestaurantsByName(text)
        .then((results) => {
          searchCache.set(cacheKey, results);
          setSearchResults(results);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Could not search restaurants.';
          Alert.alert('Restaurant lookup failed', message);
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }, 350);
  }, []);

  // Clear any pending debounced search on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const goToSummary = useCallback(
    (allowUnknown: '0' | '1') => {
      if (!sessionId) {
        router.replace('/session/scoreboard');
        return;
      }

      router.replace({
        pathname: '/session/summary',
        params: {
          id: sessionId,
          allowUnknown,
          ...(origin ? { origin } : {}),
        },
      });
    },
    [origin, router, sessionId],
  );

  const handleSkip = () => {
    goToSummary('1');
  };

  const handleSelect = async (restaurant: RestaurantWithDistance) => {
    if (!sessionId) {
      Alert.alert('Party unavailable', 'No party id was provided.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSession(sessionId, {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        location: restaurant.location,
      });

      if (!updated) {
        Alert.alert('Party unavailable', 'Could not update that party.');
        return;
      }

      setRestaurant(restaurant);
      goToSummary('0');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save that restaurant.';
      Alert.alert('Restaurant update failed', message);
    } finally {
      setSaving(false);
    }
  };

  const showSearch = searchQuery.trim().length >= 2;
  const displayList = showSearch ? searchResults : nearby;

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>One last detail</Text>
        <Text style={styles.title}>Where did this party happen?</Text>
        <Text style={styles.subtitle}>
          Pick the restaurant if you know it. If not, skip and keep the recap rolling.
        </Text>
      </View>

      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search restaurants by name"
            placeholderTextColor={t.color.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            editable={!saving}
          />
          {searchLoading && (
            <ActivityIndicator style={styles.searchSpinner} size="small" color={t.color.accent} />
          )}
        </View>
      </View>

      {!showSearch && (
        <View style={styles.metaRow}>
          {permission === 'denied' ? (
            <View style={styles.permissionBlock}>
              <Text style={styles.permissionTitle}>Location access is off</Text>
              <Text style={styles.permissionText}>
                Search by name above, or re-try location to see nearby spots.
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={refresh} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nearbyRow}>
              <Text style={styles.nearbyLabel}>Nearby spots</Text>
              {locationLoading && <ActivityIndicator size="small" color={t.color.accent} />}
            </View>
          )}
        </View>
      )}

      <FlatList
        data={displayList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void handleSelect(item); }} disabled={saving}>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowAddress} numberOfLines={1}>
                {item.address || 'Address not available'}
              </Text>
            </View>
            {item.distanceKm !== undefined && (
              <Text style={styles.rowDistance}>{formatDistance(item.distanceKm)}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          (showSearch ? searchLoading : listLoading) ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={t.color.accent} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {showSearch
                  ? 'No matching restaurants found.'
                  : location
                    ? 'No nearby restaurants found yet.'
                    : 'Waiting for location, or search by name above.'}
              </Text>
            </View>
          )
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={saving} activeOpacity={0.85}>
          <LinearGradient
            colors={t.color.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.skipButtonInner}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 8 },
  eyebrow: { fontSize: 12, fontFamily: t.font.bodyBold, letterSpacing: 1, textTransform: 'uppercase', color: t.color.accent },
  title: { fontSize: 32, lineHeight: 36, fontFamily: t.font.display, color: t.color.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary },
  searchBar: { paddingHorizontal: 20, paddingBottom: 14 },
  searchInputWrap: { justifyContent: 'center' },
  searchSpinner: { position: 'absolute', right: 16 },
  searchInput: {
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
  },
  metaRow: { paddingHorizontal: 20, paddingBottom: 8 },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nearbyLabel: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  permissionBlock: {
    borderRadius: t.radius.md,
    padding: 16,
    gap: 10,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  permissionTitle: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  permissionText: { fontSize: 14, lineHeight: 20, fontFamily: t.font.body, color: t.color.textSecondary },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: t.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: t.color.accentSoft,
  },
  secondaryButtonText: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  listContent: { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 6 },
  separator: { height: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: t.radius.lg,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  rowBody: { flex: 1, gap: 4 },
  rowName: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  rowAddress: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  rowDistance: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.accent },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44 },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    ...t.shadow.glow(t.color.accent),
  },
  skipButton: {
    borderRadius: t.radius.button,
  },
  skipButtonInner: {
    borderRadius: t.radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
});
