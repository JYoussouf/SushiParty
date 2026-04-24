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
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { SessionCard } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { buildSessionExportText } from '../../src/lib/exportSessions';
import { getAllSessions } from '../../src/lib/local/sessions';
import type { SessionMode, SushiSession } from '../../src/types';

const PAGE_SIZE = 20;

type DateFilter = 'all' | '7d' | '30d';
type ModeFilter = 'all' | SessionMode;

function matchesDateFilter(session: SushiSession, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const submittedAt = new Date(session.submittedAt ?? session.startedAt).getTime();
  const days = filter === '7d' ? 7 : 30;
  return submittedAt >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [allSessions, setAllSessions] = useState<SushiSession[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const loadSessions = useCallback(async () => {
    if (!userProfile) {
      setAllSessions([]);
      setInitialLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const sessions = await getAllSessions();
      const userSessions = sessions
        .filter((session) =>
          session.participants.some((participant) => participant.userId === userProfile.uid),
        )
        .sort(
          (left, right) =>
            new Date(right.submittedAt ?? right.startedAt).getTime() -
            new Date(left.submittedAt ?? left.startedAt).getTime(),
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

    return allSessions.filter((session) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        session.restaurantName.toLowerCase().includes(normalizedQuery) ||
        session.note?.toLowerCase().includes(normalizedQuery) ||
        session.participants.some((participant) =>
          participant.displayName.toLowerCase().includes(normalizedQuery),
        );

      const matchesMode = modeFilter === 'all' || session.mode === modeFilter;
      const matchesDate = matchesDateFilter(session, dateFilter);

      return matchesQuery && matchesMode && matchesDate;
    });
  }, [allSessions, dateFilter, modeFilter, query]);

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
      <SafeAreaView style={styles.loadingState}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#e53935" />
      </SafeAreaView>
    );
  }

  if (allSessions.length === 0 && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No sushi history yet</Text>
          <Text style={styles.emptySubtitle}>
            Finish your first party and it will show up here with a full breakdown.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)/scoreboard')}>
            <Text style={styles.emptyButtonText}>Start counting</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
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
              router.push({ pathname: '../session/summary', params: { id: item.id, origin: 'history' } })
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
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
              placeholderTextColor="#aaa"
            />

            <View style={styles.filterRow}>
              {(['all', 'single', 'individual', 'group'] as ModeFilter[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, modeFilter === filter && styles.filterChipActive]}
                  onPress={() => setModeFilter(filter)}
                >
                  <Text style={[styles.filterChipText, modeFilter === filter && styles.filterChipTextActive]}>
                    {filter === 'all' ? 'All Modes' : filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterRow}>
              {(['all', '7d', '30d'] as DateFilter[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, dateFilter === filter && styles.filterChipActive]}
                  onPress={() => setDateFilter(filter)}
                >
                  <Text style={[styles.filterChipText, dateFilter === filter && styles.filterChipTextActive]}>
                    {filter === 'all' ? 'Any Time' : filter === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredSessions.length === 0 && (
              <View style={styles.filteredEmptyCard}>
                <Text style={styles.filteredEmptyTitle}>No parties match these filters</Text>
                <Text style={styles.filteredEmptyText}>Try clearing a filter or broadening the search.</Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          displayedSessions.length < filteredSessions.length ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color="#e53935" />
            </View>
          ) : (
            <View style={styles.footerSpacing} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 20, gap: 12 },
  header: { marginBottom: 8, gap: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 15, color: '#777' },
  exportButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#ffeaea' },
  exportButtonText: { fontSize: 14, fontWeight: '700', color: '#e53935' },
  searchInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#222',
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f5f5f5' },
  filterChipActive: { backgroundColor: '#ffeaea' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#777' },
  filterChipTextActive: { color: '#e53935' },
  filteredEmptyCard: { borderRadius: 16, padding: 16, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#f0f0f0' },
  filteredEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  filteredEmptyText: { marginTop: 4, fontSize: 13, color: '#777' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingState: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#222', textAlign: 'center' },
  emptySubtitle: { marginTop: 8, fontSize: 16, lineHeight: 22, color: '#888', textAlign: 'center' },
  emptyButton: { marginTop: 20, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#e53935' },
  emptyButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  footerLoader: { paddingVertical: 16 },
  footerSpacing: { height: 20 },
});
