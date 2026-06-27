import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { getUserTopCategories } from '../../src/lib/analytics';
import type { RankedCategory } from '../../src/lib/analytics';

export default function FavoritesScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 10 },
  title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
  subtitle: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary, marginBottom: 4 },
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
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  rank: { width: 26, fontSize: 18, fontFamily: t.font.bodyBold, color: t.color.accent },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
  meta: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  chevron: { fontSize: 11, color: t.color.textTertiary },
  subList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.color.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subName: { fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary },
  subCount: { fontSize: 14, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
});
