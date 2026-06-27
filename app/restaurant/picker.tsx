import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useLocation } from '../../src/hooks/useLocation';
import { useRestaurant } from '../../src/contexts/RestaurantContext';
import {
  getNearbyRestaurants,
  searchRestaurantsByName,
  createRestaurant,
} from '../../src/lib/cloudflare/restaurants';
import { formatDistance } from '../../src/lib/geo';
import type { Restaurant } from '../../src/types';

type RestaurantWithDistance = Restaurant & { distanceKm?: number };

// Session-scoped cache so repeat searches are instant (cleared on app restart)
const searchCache = new Map<string, RestaurantWithDistance[]>();

export default function RestaurantPickerScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { location, permission, loading: locLoading, refresh } = useLocation();
  const { setRestaurant } = useRestaurant();

  const [nearby, setNearby] = useState<RestaurantWithDistance[]>([]);
  const [searchResults, setSearchResults] = useState<RestaurantWithDistance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load nearby when location becomes available; auto-select if one is within 100m
  useEffect(() => {
    if (!location) return;
    setNearbyLoading(true);
    getNearbyRestaurants(location)
      .then((results) => {
        const here = results.find((r) => r.distanceKm !== undefined && r.distanceKm <= 0.1);
        if (here) {
          setRestaurant(here);
          router.back();
          return;
        }
        setNearby(results);
      })
      .catch(() => {})
      .finally(() => setNearbyLoading(false));
  }, [location, router, setRestaurant]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      setSearchError(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.trim().length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const cacheKey = text.trim().toLowerCase();
      if (searchCache.has(cacheKey)) {
        setSearchResults(searchCache.get(cacheKey)!);
        return;
      }

      setSearchLoading(true);
      debounceRef.current = setTimeout(() => {
        searchRestaurantsByName(text, location ?? undefined)
          .then((results) => {
            searchCache.set(cacheKey, results);
            setSearchResults(results);
          })
          .catch((e: unknown) => {
            setSearchError(e instanceof Error ? e.message : 'Search failed. Try again.');
            setSearchResults([]);
          })
          .finally(() => setSearchLoading(false));
      }, 350);
    },
    [location],
  );

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
  }, []);

  const handleSelect = (restaurant: RestaurantWithDistance) => {
    setRestaurant(restaurant);
    router.back();
  };

  const handleCreated = (newRestaurant: Restaurant) => {
    setAddModalVisible(false);
    setRestaurant(newRestaurant);
    router.back();
  };

  const showSearch = searchQuery.trim().length >= 2;
  const displayList = showSearch ? searchResults : nearby;
  const listLoading = showSearch ? searchLoading : nearbyLoading;


  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />

      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={[styles.searchInput, searchFocused && styles.searchInputFocused]}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search by name or city…"
          placeholderTextColor={t.color.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity style={styles.searchAction} onPress={clearSearch}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        ) : searchLoading ? (
          <ActivityIndicator style={styles.searchAction} size="small" color={t.color.accent} />
        ) : null}
      </View>

      {searchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{searchError}</Text>
        </View>
      )}

      {!showSearch && (
        <View style={styles.header}>
          {permission === 'denied' ? (
            <View>
              <Text style={styles.sectionLabel}>Location access needed</Text>
              <Text style={styles.helperText}>
                Location is needed to find nearby spots — enable it to search by distance.
              </Text>
              <TouchableOpacity style={styles.linkBtn} onPress={refresh}>
                <Text style={styles.linkBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : permission === 'denied-permanent' ? (
            <View>
              <Text style={styles.sectionLabel}>Location access needed</Text>
              <Text style={styles.helperText}>
                Location permission was denied. Open Settings to allow Sushi Party to access your
                location, or search by name above.
              </Text>
              <TouchableOpacity style={styles.linkBtn} onPress={() => void Linking.openSettings()}>
                <Text style={styles.linkBtnText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Nearby</Text>
              {(locLoading || nearbyLoading) && <ActivityIndicator size="small" color={t.color.accent} />}
            </View>
          )}
        </View>
      )}

      <FlatList
        data={displayList}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSelect(item); }}>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowAddress} numberOfLines={1}>
                {item.address}
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
              <ActivityIndicator color={t.color.accent} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {showSearch
                  ? 'No results. Try adding the city name, e.g. "Taka Sushi Windsor".'
                  : location
                    ? 'No restaurants detected nearby.'
                    : 'Waiting for location…'}
              </Text>
            </View>
          )
        }
      />

      {location && (
        <TouchableOpacity style={styles.addBtnShadow} onPress={() => setAddModalVisible(true)} activeOpacity={0.85}>
          <LinearGradient
            colors={t.color.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ Add a new restaurant here</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <AddRestaurantModal
        visible={addModalVisible}
        location={location}
        onClose={() => setAddModalVisible(false)}
        onCreated={handleCreated}
        t={t}
      />
      </SafeAreaView>
    </View>
  );
}

// ─── Add Restaurant Modal ────────────────────────────────────────────────────

interface AddRestaurantModalProps {
  visible: boolean;
  location: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onCreated: (r: Restaurant) => void;
  t: Theme;
}

function AddRestaurantModal({ visible, location, onClose, onCreated, t }: AddRestaurantModalProps) {
  const modalStyles = useMemo(() => makeModalStyles(t), [t]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!location) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter the restaurant name.');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createRestaurant({
        name: trimmedName,
        address: address.trim(),
        location,
      });
      // Hand back a fully-formed restaurant object so parent can select it immediately
      onCreated({
        id,
        name: trimmedName,
        address: address.trim(),
        location,
        menuId: 'global-default',
        stats: {
          totalSessions: 0,
          meanPiecesPerSession: 0,
          stdDevPiecesPerSession: 0,
          updatedAt: new Date().toISOString(),
        },
      });
      setName('');
      setAddress('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create restaurant.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container}>
        <KeyboardAvoidingView
          style={modalStyles.kb}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <Text style={modalStyles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modalStyles.title}>New Restaurant</Text>
            <TouchableOpacity onPress={handleCreate} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={t.color.accent} />
              ) : (
                <Text style={modalStyles.save}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={modalStyles.body}>
            <Text style={modalStyles.label}>Name</Text>
            <TextInput
              style={modalStyles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sushi Palace"
              placeholderTextColor={t.color.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={modalStyles.label}>Address (optional)</Text>
            <TextInput
              style={modalStyles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St"
              placeholderTextColor={t.color.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={modalStyles.note}>
              {location
                ? `Will save with your current location (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}).`
                : 'Waiting for location…'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.surfaceAlt,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchInputFocused: {
    borderColor: t.color.accent,
    backgroundColor: t.color.surface,
  },
  searchAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClear: { fontSize: 14, color: t.color.textTertiary, fontFamily: t.font.bodySemibold },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.color.surfaceAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
  errorText: { fontSize: 13, fontFamily: t.font.body, color: t.color.danger },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: {
    fontSize: 13,
    fontFamily: t.font.bodyBold,
    color: t.color.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  helperText: { marginTop: 8, fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary, lineHeight: 20 },
  linkBtn: { marginTop: 12, alignSelf: 'flex-start' },
  linkBtnText: { color: t.color.accent, fontSize: 15, fontFamily: t.font.bodySemibold },
  listContent: { paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBody: { flex: 1 },
  rowName: { fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
  rowAddress: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary, marginTop: 2 },
  rowDistance: { fontSize: 13, color: t.color.textTertiary, fontFamily: t.font.bodySemibold },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.color.border, marginLeft: 16 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: t.color.textTertiary, fontSize: 14, fontFamily: t.font.body, textAlign: 'center' },
  addBtnShadow: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  addBtn: {
    height: 50,
    borderRadius: t.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: t.color.onAccent, fontSize: 16, fontFamily: t.font.bodyBold },
});

const makeModalStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  kb: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
  title: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  cancel: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary },
  save: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.accent },
  body: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontFamily: t.font.bodySemibold, color: t.color.textSecondary, marginTop: 14 },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: t.color.border,
    borderRadius: t.radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    backgroundColor: t.color.surface,
  },
  note: { marginTop: 20, fontSize: 12, fontFamily: t.font.body, color: t.color.textTertiary, lineHeight: 18 },
});
