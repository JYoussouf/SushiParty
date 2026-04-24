import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { getAchievements } from '../../src/lib/achievements';
import {
  deleteSessionTemplate,
  getSessionTemplates,
} from '../../src/lib/local/templates';
import { getAllSessions } from '../../src/lib/local/sessions';
import { calculateUserProfileStats, type UserProfileStats } from '../../src/lib/profileStats';
import type { Achievement, SessionTemplate } from '../../src/types';

const EMPTY_STATS: UserProfileStats = {
  totalSessions: 0,
  totalPieces: 0,
  averagePiecesPerSession: 0,
  favoriteRestaurant: null,
  favoriteRestaurantVisits: 0,
  mostOrderedItem: null,
  mostOrderedItemCount: 0,
  recentStreakWeeks: 0,
  lastSessionAt: null,
};

export default function ProfileScreen() {
  const router = useRouter();
  const { userProfile, firebaseUser } = useAuth();
  const [stats, setStats] = useState<UserProfileStats>(EMPTY_STATS);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!userProfile) {
      setStats(EMPTY_STATS);
      setAchievements([]);
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [sessions, savedTemplates] = await Promise.all([getAllSessions(), getSessionTemplates()]);
      setStats(calculateUserProfileStats(sessions, userProfile.uid));
      setAchievements(getAchievements(sessions, userProfile.uid));
      setTemplates(savedTemplates);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteSessionTemplate(templateId);
    setTemplates((prev) => prev.filter((template) => template.id !== templateId));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{userProfile?.displayName ?? '—'}</Text>
          <Text style={styles.username}>{userProfile?.username ? `@${userProfile.username}` : ''}</Text>
          <Text style={styles.email}>{firebaseUser?.email || 'Local-only profile'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#e53935" />
            </View>
          ) : stats.totalSessions === 0 ? (
            <EmptyCard text="Submit a few parties and this tab will start tracking your pace, favorite restaurant, and most-ordered sushi." />
          ) : (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Parties" value={String(stats.totalSessions)} />
                <StatCard label="Pieces" value={String(stats.totalPieces)} />
                <StatCard label="Avg / Party" value={String(stats.averagePiecesPerSession)} />
                <StatCard label="Streak" value={`${stats.recentStreakWeeks} wk`} />
              </View>
              <InsightCard
                title="Favorite Restaurant"
                value={stats.favoriteRestaurant ?? '—'}
                note={
                  stats.favoriteRestaurant
                    ? `${stats.favoriteRestaurantVisits} visit${stats.favoriteRestaurantVisits === 1 ? '' : 's'}`
                    : 'No visits yet'
                }
              />
              <InsightCard
                title="Most Ordered Item"
                value={stats.mostOrderedItem ?? '—'}
                note={
                  stats.mostOrderedItem
                    ? `${stats.mostOrderedItemCount} total pieces logged`
                    : 'No item data yet'
                }
              />
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('../profile/favorites')}>
            <Text style={styles.listRowText}>Top dishes</Text>
            <Text style={styles.listRowChevron}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('../profile/restaurants')}>
            <Text style={styles.listRowText}>Restaurant insights</Text>
            <Text style={styles.listRowChevron}>Open</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          {achievements.filter((item) => item.earned).length === 0 ? (
            <EmptyCard text="No badges yet. Keep logging parties to unlock milestones." />
          ) : (
            achievements
              .filter((item) => item.earned)
              .map((achievement) => (
                <View key={achievement.id} style={styles.badgeCard}>
                  <Text style={styles.badgeTitle}>{achievement.title}</Text>
                  <Text style={styles.badgeText}>{achievement.description}</Text>
                </View>
              ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start Templates</Text>
          {templates.length === 0 ? (
            <EmptyCard text="Save templates from the Scoreboard to launch favorite setups faster." />
          ) : (
            templates.map((template) => (
              <View key={template.id} style={styles.templateRow}>
                <View style={styles.templateBody}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateMeta}>
                    {template.restaurantName ?? 'Any restaurant'} • {template.mode}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => void handleDeleteTemplate(template.id)}>
                  <Text style={styles.templateDelete}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          <TouchableOpacity style={styles.listRow}>
            <Text style={styles.listRowText}>Display name saved on this phone</Text>
            <Text style={styles.listRowChevron}>{userProfile?.displayName ?? '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listRow}>
            <Text style={styles.listRowText}>Device ID</Text>
            <Text style={styles.listRowChevron}>{userProfile?.uid?.slice(0, 8) ?? '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/settings')}>
            <Text style={styles.listRowText}>History data and sound settings</Text>
            <Text style={styles.listRowChevron}>Open</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function InsightCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightNote}>{note}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  value: { fontSize: 28, fontWeight: '800', color: '#e53935' },
  label: { fontSize: 13, color: '#888', fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 28 },
  avatarWrap: { alignItems: 'center', gap: 6, paddingTop: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  displayName: { fontSize: 22, fontWeight: '700', color: '#222' },
  username: { fontSize: 15, color: '#888' },
  email: { fontSize: 13, color: '#bbb' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#aaa', letterSpacing: 0.8, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  loadingCard: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#f0f0f0' },
  emptyCard: { borderRadius: 16, padding: 18, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#f0f0f0' },
  emptyText: { fontSize: 14, lineHeight: 21, color: '#777' },
  insightCard: { borderRadius: 16, padding: 18, gap: 6, backgroundColor: '#fff7f5', borderWidth: 1, borderColor: '#f4d7d4' },
  insightTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#c26a62' },
  insightValue: { fontSize: 20, fontWeight: '800', color: '#222' },
  insightNote: { fontSize: 13, color: '#777' },
  badgeCard: { borderRadius: 16, padding: 16, backgroundColor: '#fff6e7', borderWidth: 1, borderColor: '#f0d7a0', gap: 4 },
  badgeTitle: { fontSize: 15, fontWeight: '800', color: '#8b6a1d' },
  badgeText: { fontSize: 13, color: '#6e5723' },
  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16, padding: 16, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#f0f0f0' },
  templateBody: { flex: 1, gap: 4 },
  templateName: { fontSize: 15, fontWeight: '700', color: '#222' },
  templateMeta: { fontSize: 13, color: '#777' },
  templateDelete: { fontSize: 13, fontWeight: '700', color: '#e53935' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0', gap: 12 },
  listRowText: { fontSize: 16, color: '#222', flex: 1 },
  listRowChevron: { fontSize: 14, color: '#999' },
});
