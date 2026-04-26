import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { getUserRestaurantInsights, type RankedRestaurant } from '../../src/lib/analytics';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';

export default function RestaurantInsightsScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [restaurants, setRestaurants] = useState<RankedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!userProfile) {
        setRestaurants([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const sessions = await getAllSessions();
        setRestaurants(getUserRestaurantInsights(sessions, userProfile.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#e53935" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Restaurant Insights</Text>
          <Text style={styles.subtitle}>Where you go most, how much you eat, and what you order there.</Text>
          {restaurants.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No restaurant data yet.</Text>
            </View>
          ) : (
            restaurants.map((restaurant) => (
              <View key={restaurant.restaurantName} style={styles.card}>
                <Text style={styles.name}>{restaurant.restaurantName}</Text>
                <Text style={styles.meta}>
                  {restaurant.visits} visits • {restaurant.totalPieces} pieces • last on{' '}
                  {new Date(restaurant.lastVisitedAt).toLocaleDateString()}
                </Text>
                {restaurant.topItems.map((item) => (
                  <Text key={item.id} style={styles.item}>
                    {item.name}: {item.count}
                  </Text>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '700', color: '#e53935' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 15, color: '#777', marginBottom: 6 },
  emptyCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  emptyText: { fontSize: 14, color: '#777' },
  card: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    backgroundColor: '#fff7f5',
    borderWidth: 1,
    borderColor: '#f4d7d4',
  },
  name: { fontSize: 18, fontWeight: '800', color: '#222' },
  meta: { fontSize: 13, color: '#777' },
  item: { fontSize: 14, color: '#444' },
});
