import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

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
import { calculateLevel, levelTitle, type LevelInfo } from '../../src/lib/leveling';
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
  const levelInfo = calculateLevel(achievements);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('🐱');
  const [saving, setSaving] = useState(false);
  const [lockedExpanded, setLockedExpanded] = useState(false);

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

        <LevelCard levelInfo={levelInfo} />

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

        <AchievementsSection
          achievements={achievements}
          lockedExpanded={lockedExpanded}
          onToggleLocked={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLockedExpanded((v) => !v);
          }}
        />

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

const SCREEN_WIDTH = Dimensions.get('window').width;

function LevelCard({ levelInfo: li }: { levelInfo: LevelInfo }) {
  const barWidth = useSharedValue(0);

  React.useEffect(() => {
    barWidth.value = withSpring(li.progress, { damping: 28, stiffness: 120, mass: 1 });
  }, [li.progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as `${number}%`,
  }));

  return (
    <View style={levelStyles.card}>
      {/* Mascot placeholder */}
      <View style={levelStyles.mascotWrap}>
        <Text style={levelStyles.mascotEmoji}>🐟</Text>
        <Text style={levelStyles.mascotLabel}>Party Sashimi</Text>
        <Text style={levelStyles.mascotSub}>coming soon</Text>
      </View>

      {/* Level info */}
      <View style={levelStyles.info}>
        <View style={levelStyles.titleRow}>
          <View style={levelStyles.levelBadge}>
            <Text style={levelStyles.levelNum}>{li.level}</Text>
          </View>
          <View style={levelStyles.titleBlock}>
            <Text style={levelStyles.titleText}>{levelTitle(li.level)}</Text>
            <Text style={levelStyles.xpText}>{li.totalXp} XP total</Text>
          </View>
        </View>

        <View style={levelStyles.barTrack}>
          <Animated.View style={[levelStyles.barFill, barStyle]} />
        </View>

        {li.isMaxLevel ? (
          <Text style={levelStyles.barLabel}>Max level reached</Text>
        ) : (
          <Text style={levelStyles.barLabel}>{li.currentLevelXp} / {li.nextLevelXp} XP to level {li.level + 1}</Text>
        )}
      </View>
    </View>
  );
}

function AchievementBadge({ achievement: a }: { achievement: Achievement }) {
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const show = () => {
    setOpen(true);
    progress.value = withSpring(1, { damping: 28, stiffness: 140, mass: 1.1 });
  };

  const hide = () => {
    progress.value = withSpring(0, { damping: 30, stiffness: 180, mass: 0.9 }, (done) => {
      if (done) runOnJS(setOpen)(false);
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 0.6, 1], [0.55, 1.04, 1], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP),
  }));

  return (
    <>
      <TouchableOpacity style={achStyles.badge} onPress={show} activeOpacity={0.8}>
        <Text style={achStyles.badgeEmoji}>{a.emoji}</Text>
        <Text style={achStyles.badgeTitle} numberOfLines={2}>{a.title}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={hide}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide}>
          <Animated.View style={[StyleSheet.absoluteFill, achStyles.backdrop]} pointerEvents="none">
            <BlurView style={StyleSheet.absoluteFill} intensity={40} tint="dark" />
          </Animated.View>
          <Animated.View style={[achStyles.backdropDim, backdropStyle]} pointerEvents="none" />
        </Pressable>

        <View style={achStyles.modalCenter} pointerEvents="box-none">
          <Animated.View style={[achStyles.glassCard, cardStyle]}>
            <BlurView style={achStyles.glassBlur} intensity={80} tint="light" />
            <View style={achStyles.glassContent}>
              <Text style={achStyles.glassEmoji}>{a.emoji}</Text>
              <Text style={achStyles.glassTitle}>{a.title}</Text>
              <Text style={achStyles.glassDesc}>{a.description}</Text>
              {(a.earnedAt || a.earnedAtRestaurant) && (
                <View style={achStyles.glassPill}>
                  <Text style={achStyles.glassPillText}>
                    {a.earnedAt
                      ? `Unlocked ${new Date(a.earnedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : ''}
                    {a.earnedAt && a.earnedAtRestaurant ? ' · ' : ''}
                    {a.earnedAtRestaurant ? `at ${a.earnedAtRestaurant}` : ''}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function AchievementsSection({
  achievements,
  lockedExpanded,
  onToggleLocked,
}: {
  achievements: Achievement[];
  lockedExpanded: boolean;
  onToggleLocked: () => void;
}) {
  const earned = achievements
    .filter((a) => a.earned)
    .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const locked = achievements.filter((a) => !a.earned);
  const recent = earned.slice(0, 3);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Achievements</Text>

      {earned.length === 0 ? (
        <EmptyCard text="No badges yet. Keep logging parties to unlock milestones." />
      ) : (
        <View style={achStyles.row}>
          {recent.map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
          {earned.length > 3 && (
            <View style={[achStyles.badge, achStyles.badgeMore]}>
              <Text style={achStyles.moreCount}>+{earned.length - 3}</Text>
              <Text style={achStyles.moreLabel}>more</Text>
            </View>
          )}
        </View>
      )}

      {locked.length > 0 && (
        <TouchableOpacity style={achStyles.lockedBtn} onPress={onToggleLocked} activeOpacity={0.75}>
          <Text style={achStyles.lockedBtnText}>
            {lockedExpanded ? 'Hide locked' : `+${locked.length} locked achievements`}
          </Text>
          <Text style={achStyles.lockedChevron}>{lockedExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      )}

      {lockedExpanded && locked.map((a) => (
        <View key={a.id} style={achStyles.lockedCard}>
          <Text style={achStyles.lockedEmoji}>{a.hidden ? '🔒' : a.emoji}</Text>
          <View style={achStyles.lockedBody}>
            <Text style={achStyles.lockedTitle}>{a.hidden ? 'Hidden Achievement' : a.title}</Text>
            <Text style={achStyles.lockedDesc}>{a.hidden ? 'Keep playing to unlock this secret badge.' : a.description}</Text>
          </View>
        </View>
      ))}
    </View>
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

const achStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  badge: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#fff6e7',
    borderWidth: 1,
    borderColor: '#f0d7a0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 4,
  },
  badgeEmoji: { fontSize: 28 },
  badgeTitle: { fontSize: 11, fontWeight: '700', color: '#8b6a1d', textAlign: 'center', lineHeight: 14 },
  badgeMore: { backgroundColor: '#fafafa', borderColor: '#e8e8e8' },
  moreCount: { fontSize: 22, fontWeight: '800', color: '#aaa' },
  moreLabel: { fontSize: 11, color: '#bbb', fontWeight: '600' },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
    marginTop: 4,
  },
  lockedBtnText: { fontSize: 14, color: '#999', fontWeight: '600' },
  lockedChevron: { fontSize: 10, color: '#bbb' },
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f5f5f5',
  },
  lockedEmoji: { fontSize: 28, opacity: 0.4, width: 40, textAlign: 'center' },
  lockedBody: { flex: 1, gap: 2 },
  lockedTitle: { fontSize: 14, fontWeight: '700', color: '#bbb' },
  lockedDesc: { fontSize: 12, color: '#ccc', lineHeight: 17 },
  // liquid glass modal
  backdrop: { backgroundColor: 'transparent' },
  backdropDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glassCard: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 20,
  },
  glassBlur: { ...StyleSheet.absoluteFillObject },
  glassContent: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 36,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  glassEmoji: { fontSize: 56, lineHeight: 68 },
  glassTitle: { fontSize: 22, fontWeight: '800', color: '#222', textAlign: 'center' },
  glassDesc: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  glassPill: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(229,57,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.2)',
  },
  glassPillText: { fontSize: 12, fontWeight: '700', color: '#e53935' },
});

const levelStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 16,
    borderRadius: 20,
    backgroundColor: '#fff7f5',
    borderWidth: 1,
    borderColor: '#f4d7d4',
    padding: 16,
    alignItems: 'center',
  },
  mascotWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#fff0f0',
    borderWidth: 1.5,
    borderColor: '#f4d7d4',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  mascotEmoji: { fontSize: 28 },
  mascotLabel: { fontSize: 9, fontWeight: '700', color: '#e53935', letterSpacing: 0.4 },
  mascotSub: { fontSize: 8, color: '#e09090' },
  info: { flex: 1, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontSize: 18, fontWeight: '900', color: '#fff' },
  titleBlock: { gap: 1 },
  titleText: { fontSize: 15, fontWeight: '800', color: '#222' },
  xpText: { fontSize: 12, color: '#c26a62' },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f4d7d4',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#e53935',
  },
  barLabel: { fontSize: 11, color: '#c26a62', fontWeight: '600' },
});
