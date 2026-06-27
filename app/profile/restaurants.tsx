import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { getUserRestaurantInsights, type RankedRestaurant } from '../../src/lib/analytics';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';

export default function RestaurantInsightsScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
  subtitle: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary, marginBottom: 6 },
  emptyCard: {
    borderRadius: t.radius.md,
    padding: 18,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  emptyText: { fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary },
  card: {
    borderRadius: t.radius.md,
    padding: 16,
    gap: 6,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  name: { fontSize: 18, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  meta: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  item: { fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary },
});
