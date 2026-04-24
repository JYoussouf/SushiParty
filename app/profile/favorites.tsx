import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../src/contexts/AuthContext';
import { getAllSessions } from '../../src/lib/local/sessions';
import { getUserTopItems } from '../../src/lib/analytics';
import type { RankedItem } from '../../src/lib/analytics';

export default function FavoritesScreen() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!userProfile) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const sessions = await getAllSessions();
        setItems(getUserTopItems(sessions, userProfile.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#e53935" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Top Dishes</Text>
          <Text style={styles.subtitle}>Your most ordered sushi across all saved parties.</Text>
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No favorites yet. Log a few parties first.</Text>
            </View>
          ) : (
            items.map((item, index) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.count} pieces across {item.sessionCount} part{item.sessionCount === 1 ? 'y' : 'ies'}
                  </Text>
                </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  rank: { width: 26, fontSize: 18, fontWeight: '800', color: '#e53935' },
  rowBody: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#222' },
  meta: { fontSize: 13, color: '#777' },
});
