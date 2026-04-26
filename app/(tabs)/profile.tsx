import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { CAT_AVATARS } from '../../src/lib/catAvatars';
import { getAchievements } from '../../src/lib/achievements';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { calculateUserProfileStats, type UserProfileStats } from '../../src/lib/profileStats';
import type { Achievement } from '../../src/types';

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
  const { userProfile, remoteUser, updateLocalProfile } = useAuth();
  const [stats, setStats] = useState<UserProfileStats>(EMPTY_STATS);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('🐱');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userProfile) {
      setStats(EMPTY_STATS);
      setAchievements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sessions = await getAllSessions();
      setStats(calculateUserProfileStats(sessions, userProfile.uid));
      setAchievements(getAchievements(sessions, userProfile.uid));
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      return () => {
        setEditingProfile(false);
      };
    }, [loadProfile]),
  );

  const openEdit = () => {
    setDraftName(userProfile?.displayName ?? '');
    setDraftAvatar(userProfile?.avatar ?? '🐱');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingProfile(true);
  };

  const cancelEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!draftName.trim()) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }
    setSaving(true);
    try {
      await updateLocalProfile({ displayName: draftName.trim(), avatar: draftAvatar });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setEditingProfile(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarCard}>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={editingProfile ? undefined : openEdit}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarEmoji}>{editingProfile ? draftAvatar : (userProfile?.avatar ?? '🐱')}</Text>
            {!editingProfile && (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeText}>✏️</Text>
              </View>
            )}
          </TouchableOpacity>

          {editingProfile ? (
            <View style={styles.inlineEdit}>
              <View style={styles.catGrid}>
                {CAT_AVATARS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, draftAvatar === cat && styles.catBtnSelected]}
                    onPress={() => setDraftAvatar(cat)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.catEmoji}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Your name"
                placeholderTextColor="#bbb"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={32}
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSaveProfile()} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.avatarMeta}>
              <Text style={styles.displayName}>{userProfile?.displayName ?? '—'}</Text>
              <Text style={styles.username}>{userProfile?.username ? `@${userProfile.username}` : ''}</Text>
              <Text style={styles.email}>{remoteUser?.email || 'Local-only profile'}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#e53935" />
            </View>
          ) : stats.totalSessions === 0 ? (
            <EmptyCard text="Submit a few parties and this tab will start tracking your pace, favourite restaurant, and most-ordered sushi." />
          ) : (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Parties" value={String(stats.totalSessions)} />
                <StatCard label="Pieces" value={String(stats.totalPieces)} />
                <StatCard label="Avg / Party" value={String(stats.averagePiecesPerSession)} />
              </View>
              {stats.favoriteRestaurant && (
                <InsightCard
                  title="Favourite Restaurant"
                  value={stats.favoriteRestaurant}
                  note={`${stats.favoriteRestaurantVisits} visit${stats.favoriteRestaurantVisits === 1 ? '' : 's'}`}
                />
              )}
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
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/profile/favorites')}>
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
                  {achievement.earnedAt && (
                    <Text style={styles.badgeDate}>
                      Unlocked {new Date(achievement.earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                </View>
              ))
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/settings')}>
            <Text style={styles.listRowText}>App settings</Text>
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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '700', color: '#e53935' },
  scroll: { padding: 24, gap: 28 },
  avatarCard: { alignItems: 'center', gap: 12, paddingTop: 16 },
  avatarMeta: { alignItems: 'center', gap: 4 },
  inlineEdit: { width: '100%', gap: 12, paddingHorizontal: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  editActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#888' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#e53935', alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  avatarWrap: { alignItems: 'center', gap: 6, paddingTop: 16 },
  avatarBtn: { position: 'relative', marginBottom: 8 },
  avatarEmoji: { fontSize: 72, lineHeight: 84 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: { fontSize: 14 },
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
  badgeDate: { fontSize: 11, color: '#b09040', marginTop: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0', gap: 12 },
  listRowText: { fontSize: 16, color: '#222', flex: 1 },
  listRowChevron: { fontSize: 14, color: '#999' },
  catBtn: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#eee',
  },
  catBtnSelected: { borderColor: '#e53935', backgroundColor: '#fff0f0' },
  catEmoji: { fontSize: 28 },
  nameInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#222',
    backgroundColor: '#fafafa',
  },
});
