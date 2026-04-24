import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLocation } from '../../src/hooks/useLocation';
import { useRestaurant } from '../../src/contexts/RestaurantContext';
import {
  getNearbyRestaurants,
  searchRestaurantsByName,
  createRestaurant,
  getRestaurant,
} from '../../src/lib/firebase/restaurants';
import { formatDistance } from '../../src/lib/geo';
import type { Restaurant } from '../../src/types';

type RestaurantWithDistance = Restaurant & { distanceKm?: number };

export default function RestaurantPickerScreen() {
  const router = useRouter();
  const { location, permission, loading: locLoading, refresh } = useLocation();
  const { setRestaurant } = useRestaurant();

  const [nearby, setNearby] = useState<RestaurantWithDistance[]>([]);
  const [searchResults, setSearchResults] = useState<RestaurantWithDistance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Load nearby when location becomes available
  useEffect(() => {
    if (!location) return;
    setListLoading(true);
    getNearbyRestaurants(location)
      .then(setNearby)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Could not load restaurants.';
        Alert.alert('Error', msg);
      })
      .finally(() => setListLoading(false));
  }, [location]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    void searchRestaurantsByName(text).then(setSearchResults);
  }, []);

  const handleSelect = async (restaurantId: string) => {
    const full = await getRestaurant(restaurantId);
    if (!full) {
      Alert.alert('Error', 'Could not load restaurant details.');
      return;
    }
    setRestaurant(full);
    router.back();
  };

  const handleCreated = (newRestaurant: Restaurant) => {
    setAddModalVisible(false);
    setRestaurant(newRestaurant);
    router.back();
  };

  const showSearch = searchQuery.trim().length >= 2;
  const displayList = showSearch ? searchResults : nearby;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search restaurants by name…"
          placeholderTextColor="#bbb"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {!showSearch && (
        <View style={styles.header}>
          {permission === 'denied' ? (
            <View>
              <Text style={styles.sectionLabel}>Location access needed</Text>
              <Text style={styles.helperText}>
                Grant location permission in Settings to see nearby restaurants, or search by name
                above.
              </Text>
              <TouchableOpacity style={styles.linkBtn} onPress={refresh}>
                <Text style={styles.linkBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Nearby</Text>
              {locLoading && <ActivityIndicator size="small" color="#e53935" />}
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
          <TouchableOpacity style={styles.row} onPress={() => handleSelect(item.id)}>
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
              <ActivityIndicator color="#e53935" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {showSearch
                  ? 'No matching restaurants found.'
                  : location
                    ? 'No restaurants nearby yet.'
                    : 'Waiting for location…'}
              </Text>
            </View>
          )
        }
      />

      {location && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add a new restaurant here</Text>
        </TouchableOpacity>
      )}

      <AddRestaurantModal
        visible={addModalVisible}
        location={location}
        onClose={() => setAddModalVisible(false)}
        onCreated={handleCreated}
      />
    </SafeAreaView>
  );
}

// ─── Add Restaurant Modal ────────────────────────────────────────────────────

interface AddRestaurantModalProps {
  visible: boolean;
  location: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onCreated: (r: Restaurant) => void;
}

function AddRestaurantModal({ visible, location, onClose, onCreated }: AddRestaurantModalProps) {
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
        >
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <Text style={modalStyles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modalStyles.title}>New Restaurant</Text>
            <TouchableOpacity onPress={handleCreate} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#e53935" />
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
              placeholderTextColor="#bbb"
              autoCapitalize="words"
            />

            <Text style={modalStyles.label}>Address (optional)</Text>
            <TextInput
              style={modalStyles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St"
              placeholderTextColor="#bbb"
              autoCapitalize="words"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#222',
  },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  helperText: { marginTop: 8, fontSize: 14, color: '#666', lineHeight: 20 },
  linkBtn: { marginTop: 12, alignSelf: 'flex-start' },
  linkBtnText: { color: '#e53935', fontSize: 15, fontWeight: '600' },
  listContent: { paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBody: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#222' },
  rowAddress: { fontSize: 13, color: '#888', marginTop: 2 },
  rowDistance: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#eee', marginLeft: 16 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  addBtn: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  kb: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#222' },
  cancel: { fontSize: 15, color: '#888' },
  save: { fontSize: 15, fontWeight: '700', color: '#e53935' },
  body: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 14 },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  note: { marginTop: 20, fontSize: 12, color: '#aaa', lineHeight: 18 },
});
