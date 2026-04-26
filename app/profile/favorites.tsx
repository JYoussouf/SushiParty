import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { getUserTopCategories } from '../../src/lib/analytics';
import type { RankedCategory } from '../../src/lib/analytics';

export default function FavoritesScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [categories, setCategories] = useState<RankedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      if (!userProfile) {
        setCategories([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const sessions = await getAllSessions();
        setCategories(getUserTopCategories(sessions, userProfile.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const toggle = (category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

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
          <Text style={styles.title}>Top Dishes</Text>
          <Text style={styles.subtitle}>Your most ordered sushi across all saved parties.</Text>
          {categories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No favourites yet. Log a few parties first.</Text>
            </View>
          ) : (
            categories.map((cat, index) => {
              const isOpen = expanded.has(cat.category);
              const hasDetail = cat.subItems.length > 0;

              return (
                <View key={cat.category} style={styles.card}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => { if (hasDetail) toggle(cat.category); }}
                    activeOpacity={hasDetail ? 0.7 : 1}
                  >
                    <Text style={styles.rank}>{index + 1}</Text>
                    <View style={styles.rowBody}>
                      <Text style={styles.name}>{cat.label}</Text>
                      <Text style={styles.meta}>{cat.totalCount} pieces</Text>
                    </View>
                    {hasDetail && (
                      <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                    )}
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.subList}>
                      {cat.subItems.map((item) => (
                        <View key={item.id} style={styles.subRow}>
                          <Text style={styles.subName}>{item.name}</Text>
                          <Text style={styles.subCount}>{item.count}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
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
  content: { padding: 20, gap: 10 },
  title: { fontSize: 28, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 15, color: '#777', marginBottom: 4 },
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
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  rank: { width: 26, fontSize: 18, fontWeight: '800', color: '#e53935' },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: '#222' },
  meta: { fontSize: 13, color: '#777' },
  chevron: { fontSize: 11, color: '#aaa' },
  subList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subName: { fontSize: 14, color: '#444' },
  subCount: { fontSize: 14, fontWeight: '700', color: '#222' },
});
