import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackButton, SessionCard } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { buildSessionExportText } from '../../src/lib/exportSessions';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { getSessionTotalPieces } from '../../src/lib/sessionSummary';
import type { SushiSession } from '../../src/types';

const PAGE_SIZE = 20;

type SortOption = 'newest' | 'oldest' | 'mostPieces' | 'fewestPieces';

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'mostPieces', label: 'Most pieces' },
  { key: 'fewestPieces', label: 'Fewest pieces' },
];

function sessionTimestamp(session: SushiSession): number {
  return new Date(session.submittedAt ?? session.startedAt).getTime();
}

function compareSessions(left: SushiSession, right: SushiSession, sort: SortOption): number {
  switch (sort) {
    case 'newest':
      return sessionTimestamp(right) - sessionTimestamp(left);
    case 'oldest':
      return sessionTimestamp(left) - sessionTimestamp(right);
    case 'mostPieces':
      return getSessionTotalPieces(right) - getSessionTotalPieces(left);
    case 'fewestPieces':
      return getSessionTotalPieces(left) - getSessionTotalPieces(right);
  }
}

export default function HistoryScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile } = useAuth();
  const [allSessions, setAllSessions] = useState<SushiSession[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  const loadSessions = useCallback(async () => {
    if (!userProfile) {
      setAllSessions([]);
      setInitialLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const sessions = await getAllSessions();
      const userSessions = sessions.filter((session) =>
        session.participants.some((participant) => participant.userId === userProfile.uid),
      );
      setAllSessions(userSessions);
      setVisibleCount(PAGE_SIZE);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const matched =
      normalizedQuery.length === 0
        ? allSessions
        : allSessions.filter(
            (session) =>
              session.restaurantName.toLowerCase().includes(normalizedQuery) ||
              session.note?.toLowerCase().includes(normalizedQuery) ||
              session.participants.some((participant) =>
                participant.displayName.toLowerCase().includes(normalizedQuery),
              ),
          );

    return [...matched].sort((left, right) => compareSessions(left, right, sortOption));
  }, [allSessions, query, sortOption]);

  const displayedSessions = filteredSessions.slice(0, visibleCount);

  const handleExport = async () => {
    if (!userProfile || filteredSessions.length === 0) return;
    await Share.share({
      message: buildSessionExportText(filteredSessions, userProfile.uid),
      title: 'Sushi Party History Export',
    });
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingState}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={t.color.accent} />
      </View>
    );
  }

  if (allSessions.length === 0 && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.backRow}>
          <BackButton onPress={() => router.replace('/(tabs)/home')} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No sushi history yet</Text>
          <Text style={styles.emptySubtitle}>
            Finish your first party and it will show up here with a full breakdown.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/session/mode-select')}>
            <Text style={styles.emptyButtonText}>Start counting</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <FlatList
        data={displayedSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSessions()} />}
        onEndReached={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredSessions.length))}
        onEndReachedThreshold={0.25}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() =>
              router.push({ pathname: '/session/summary', params: { id: item.id, origin: 'history' } })
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <BackButton onPress={() => router.replace('/(tabs)/home')} />
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.title}>History</Text>
                <Text style={styles.subtitle}>Search, filter, and export your parties.</Text>
              </View>
              <TouchableOpacity style={styles.exportButton} onPress={() => void handleExport()}>
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search restaurant, note, or attendee"
              placeholderTextColor={t.color.textTertiary}
              autoCorrect={false}
              spellCheck={false}
            />

            <View style={styles.filterRow}>
              <Text style={styles.sortLabel}>Sort by</Text>
              {SORT_OPTIONS.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, sortOption === key && styles.filterChipActive]}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  onPress={() => setSortOption(key)}
                >
                  <Text style={[styles.filterChipText, sortOption === key && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredSessions.length === 0 && (
              <View style={styles.filteredEmptyCard}>
                <Text style={styles.filteredEmptyTitle}>No parties match your search</Text>
                <Text style={styles.filteredEmptyText}>Try a different restaurant, note, or attendee.</Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          displayedSessions.length < filteredSessions.length ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={t.color.accent} />
            </View>
          ) : (
            <View style={styles.footerSpacing} />
          )
        }
      />
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  list: { padding: 20, gap: 12 },
  header: { marginBottom: 8, gap: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
  subtitle: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary },
  exportButton: { borderRadius: t.radius.pill, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: t.color.accentSoft },
  exportButtonText: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  backRow: { paddingHorizontal: 20, paddingTop: 16 },
  searchInput: {
    height: 48,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 12, fontFamily: t.font.bodyBold, color: t.color.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 2 },
  filterChip: { borderRadius: t.radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.color.surfaceAlt },
  filterChipActive: { backgroundColor: t.color.accentSoft },
  filterChipText: { fontSize: 12, fontFamily: t.font.bodyBold, color: t.color.textSecondary },
  filterChipTextActive: { color: t.color.onAccent },
  filteredEmptyCard: { borderRadius: t.radius.md, padding: 16, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border },
  filteredEmptyTitle: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  filteredEmptyText: { marginTop: 4, fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingState: { flex: 1, backgroundColor: t.color.bg, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontFamily: t.font.display, color: t.color.textPrimary, textAlign: 'center' },
  emptySubtitle: { marginTop: 8, fontSize: 16, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary, textAlign: 'center' },
  emptyButton: { marginTop: 20, borderRadius: t.radius.button, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: t.color.accent },
  emptyButtonText: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  footerLoader: { paddingVertical: 16 },
  footerSpacing: { height: 20 },
});
