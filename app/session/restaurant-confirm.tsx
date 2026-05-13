import React, { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

export default function SessionRestaurantConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; origin?: string }>();
  const { location, permission, loading: locationLoading, refresh } = useLocation();
  const { setRestaurant } = useRestaurant();

  const [nearby, setNearby] = useState<RestaurantWithDistance[]>([]);
  const [searchResults, setSearchResults] = useState<RestaurantWithDistance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    void searchRestaurantsByName(text)
      .then(setSearchResults)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not search restaurants.';
        Alert.alert('Restaurant lookup failed', message);
      });
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>One last detail</Text>
        <Text style={styles.title}>Where did this party happen?</Text>
        <Text style={styles.subtitle}>
          Pick the restaurant if you know it. If not, skip and keep the recap rolling.
        </Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search restaurants by name"
          placeholderTextColor="#a68a7b"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          editable={!saving}
        />
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
              {locationLoading && <ActivityIndicator size="small" color="#d7522e" />}
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
          listLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#d7522e" />
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
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={saving}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff4eb' },
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#c46535' },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '900', color: '#2c211c' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6e5a4f' },
  searchBar: { paddingHorizontal: 20, paddingBottom: 14 },
  searchInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f0d8ca',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2c211c',
  },
  metaRow: { paddingHorizontal: 20, paddingBottom: 8 },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nearbyLabel: { fontSize: 15, fontWeight: '800', color: '#2c211c' },
  permissionBlock: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f0d8ca',
  },
  permissionTitle: { fontSize: 15, fontWeight: '800', color: '#2c211c' },
  permissionText: { fontSize: 14, lineHeight: 20, color: '#6e5a4f' },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffe1d2',
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '800', color: '#d7522e' },
  listContent: { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 6 },
  separator: { height: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#f0d8ca',
  },
  rowBody: { flex: 1, gap: 4 },
  rowName: { fontSize: 16, fontWeight: '800', color: '#2c211c' },
  rowAddress: { fontSize: 13, color: '#806d61' },
  rowDistance: { fontSize: 13, fontWeight: '800', color: '#d7522e' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44 },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22, color: '#806d61' },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
  },
  skipButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2c211c',
  },
  skipButtonText: { fontSize: 16, fontWeight: '800', color: '#fff7f1' },
});
