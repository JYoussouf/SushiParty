import React, { useCallback, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
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
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { AVATAR_CHARACTERS } from '../../src/lib/avatars';
import { getAchievements } from '../../src/lib/achievements';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { calculateUserProfileStats, type UserProfileStats } from '../../src/lib/profileStats';
import { calculateLevel, levelTitle } from '../../src/lib/leveling';
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const params = useLocalSearchParams<{ achievements?: string }>();
  const { userProfile, updateLocalProfile } = useAuth();
  const [stats, setStats] = useState<UserProfileStats>(EMPTY_STATS);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const levelInfo = calculateLevel(achievements);
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
      try {
        const allAchievements = getAchievements(sessions, userProfile.uid);
        setAchievements(allAchievements);
      } catch (achievementError) {
        console.error('Error calculating achievements:', achievementError);
        // Fallback: create achievements with empty sessions
        setAchievements(getAchievements([], userProfile.uid));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Even on error, show locked achievements
      try {
        setAchievements(getAchievements([], userProfile.uid));
      } catch (fallbackError) {
        console.error('Error loading fallback achievements:', fallbackError);
        setAchievements([]);
      }
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
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileTitleRow}>
          <Text style={styles.profileTitle}>You</Text>
          <TouchableOpacity onPress={openEdit} disabled={editingProfile}>
            <Text style={[styles.profileEdit, editingProfile && styles.profileEditDisabled]}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarCard}>
          {editingProfile ? (
            <View style={styles.inlineEdit}>
              <AvatarProgressRing avatar={draftAvatar} progress={levelInfo.progress} />
              <View style={styles.catGrid}>
                {AVATAR_CHARACTERS.map((character) => (
                  <TouchableOpacity
                    key={character.id}
                    style={[styles.catBtn, draftAvatar === character.id && styles.catBtnSelected]}
                    onPress={() => setDraftAvatar(character.id)}
                    activeOpacity={0.75}
                  >
                    <Avatar value={character.id} size={46} />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Your name"
                placeholderTextColor={t.color.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={32}
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSaveProfile()} disabled={saving}>
                  {saving ? <ActivityIndicator color={t.color.onAccent} size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.avatarMeta}>
              <TouchableOpacity
                onPress={openEdit}
                activeOpacity={0.8}
              >
                <AvatarProgressRing avatar={userProfile?.avatar} progress={levelInfo.progress} />
              </TouchableOpacity>
              <Text style={styles.displayName}>{userProfile?.displayName ?? '-'}</Text>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText}>
                  • Level {levelInfo.level} · {levelTitle(levelInfo.level)}
                </Text>
              </View>
              <Text style={styles.levelProgressText}>
                {levelInfo.isMaxLevel
                  ? 'Max level reached'
                  : `${Math.round(levelInfo.progress * 100)}% to Level ${levelInfo.level + 1} · ${levelInfo.nextLevelXp - levelInfo.currentLevelXp} XP to go`}
              </Text>
            </View>
          )}
        </View>

        <AchievementsSection achievements={achievements} autoOpen={params.achievements === '1'} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Party History</Text>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={t.color.accent} />
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
                value={stats.mostOrderedItem ?? '-'}
                note={
                  stats.mostOrderedItem
                    ? `${stats.mostOrderedItemCount} total pieces logged`
                    : 'No item data yet'
                }
              />
              <TouchableOpacity style={styles.listRow} onPress={() => router.push('/profile/favorites')}>
                <Text style={styles.listRowText}>Top dishes</Text>
                <Text style={styles.listRowChevron}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listRow} onPress={() => router.push('/profile/restaurants')}>
                <Text style={styles.listRowText}>Restaurant insights</Text>
                <Text style={styles.listRowChevron}>Open</Text>
              </TouchableOpacity>
            </>
          )}
          {/* Always available — Places is meaningful with browse-only data too, so
              it must not be gated behind having logged a party. */}
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/profile/places')}>
            <Text style={styles.listRowText}>Your places &amp; favourite spot</Text>
            <Text style={styles.listRowChevron}>Open</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More</Text>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/(tabs)/friends')}>
            <Text style={styles.listRowText}>Friends</Text>
            <Text style={styles.listRowChevron}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.listRowText}>View all parties</Text>
            <Text style={styles.listRowChevron}>Open</Text>
          </TouchableOpacity>
        </View>


      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

function AvatarProgressRing({ avatar, progress }: { avatar?: string | undefined; progress: number }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0.04, Math.min(1, progress));

  return (
    <View style={styles.avatarRing}>
      <Svg width={size} height={size} style={styles.avatarRingSvg}>
        <Defs>
          <SvgLinearGradient id="avatarRingGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.color.accentGradient[0]} />
            <Stop offset="1" stopColor={t.color.accentGradient[1]} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.color.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#avatarRingGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clampedProgress)}
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={styles.avatarCore}>
        <Avatar value={avatar} size={80} />
      </View>
    </View>
  );
}

function AchievementBadge({ achievement: a, locked }: { achievement: Achievement; locked?: boolean }) {
  const t = useTheme();
  const achStyles = useMemo(() => makeAchStyles(t), [t]);
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const show = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setOpen(true);
    progress.value = withSpring(1, { damping: 28, stiffness: 160, mass: 1.1 });
  };

  const hide = () => {
    progress.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }, (done) => {
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

  const isHiddenLocked = locked && a.hidden;
  const displayEmoji = isHiddenLocked ? '🔒' : a.emoji;
  const displayTitle = isHiddenLocked ? '???' : a.title;
  const modalTitle = isHiddenLocked ? 'Hidden Achievement' : a.title;
  const modalDesc = isHiddenLocked ? 'Keep playing to discover this secret badge.' : a.description;

  return (
    <>
      <TouchableOpacity
        style={[achStyles.badge, locked ? achStyles.badgeLocked : achStyles.badgeEarned]}
        onPress={show}
        activeOpacity={1}
      >
        <Text style={achStyles.badgeEmoji}>{displayEmoji}</Text>
        <Text style={achStyles.badgeTitle} numberOfLines={1} ellipsizeMode="tail">{displayTitle}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={hide}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
            <BlurView style={StyleSheet.absoluteFill} intensity={24} tint={t.isDark ? 'dark' : 'light'} />
          </Animated.View>
        </Pressable>

        <View style={achStyles.modalCenter} pointerEvents="box-none">
          <Animated.View style={[achStyles.glassCard, cardStyle]}>
            <BlurView style={achStyles.glassBlur} intensity={80} tint={t.isDark ? 'dark' : 'light'} />
            <View style={achStyles.glassContent}>
              <Text style={achStyles.glassEmoji}>{isHiddenLocked ? '🔒' : a.emoji}</Text>
              <Text style={achStyles.glassTitle}>{modalTitle}</Text>
              <Text style={achStyles.glassDesc}>{modalDesc}</Text>
              {locked ? (
                <View style={achStyles.glassPillLocked}>
                  <Text style={achStyles.glassPillLockedText}>Not yet unlocked</Text>
                </View>
              ) : (a.earnedAt || a.earnedAtRestaurant) ? (
                <View style={achStyles.glassPill}>
                  <Text style={achStyles.glassPillText}>
                    {a.earnedAt
                      ? `Unlocked ${new Date(a.earnedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : ''}
                    {a.earnedAt && a.earnedAtRestaurant ? ' · ' : ''}
                    {a.earnedAtRestaurant ? `at ${a.earnedAtRestaurant}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const PREVIEW_COUNT = 8; // 2 rows × 4 cols
const PREVIEW_EARNED = 4; // of the preview, up to this many are random earned ones

function achCategory(id: string): string {
  if (id.startsWith('first-') || id === 'world-tour') return 'debut';
  if (['habit-forming','regular','committed','on-a-roll','sushi-devotee','unstoppable'].includes(id)) return 'session';
  if (['ten-in-one','twenty-in-one','thirty-in-one','forty-in-one','fifty-in-one'].includes(id)) return 'single';
  if (['friday-night','monday-warrior','weekend-warrior','late-night-craving','lunch-break','early-bird','all-days-of-week'].includes(id)) return 'time';
  if (['solo-debut','me-time','solo-twenty'].includes(id)) return 'solo';
  if (['first-group','social-butterfly','party-animal','sushi-party-legend','big-party','crowd-pleaser','balanced'].includes(id)) return 'group';
  if (id.includes('restaurant') || ['loyal-regular','home-base','truly-devoted','adventure-week','world-tour-sessions'].includes(id)) return 'restaurant';
  if (['five-nights','ten-nights','twenty-nights','three-months','half-year','ten-weeks','back-to-back','double-feature'].includes(id)) return 'consistency';
  if (['menu-tourist','connoisseur','researcher','menu-master','variety-eater'].includes(id)) return 'variety';
  if (['tasting-menu','rainbow-session','the-purist','full-course','surf-and-turf'].includes(id)) return 'combo';
  if (['note-taker','journaling','food-critic'].includes(id)) return 'notes';
  return 'pieces';
}

function interleaveByCategory(list: Achievement[]): Achievement[] {
  const buckets = new Map<string, Achievement[]>();
  list.forEach((a) => {
    const c = achCategory(a.id);
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push(a);
  });
  const lanes = Array.from(buckets.values());
  const result: Achievement[] = [];
  const maxLen = Math.max(0, ...lanes.map((l) => l.length));
  for (let i = 0; i < maxLen; i++) {
    lanes.forEach((lane) => { if (i < lane.length) result.push(lane[i]!); });
  }
  return result;
}

function AchievementsSection({
  achievements,
  autoOpen,
}: {
  achievements: Achievement[];
  autoOpen?: boolean;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const achStyles = useMemo(() => makeAchStyles(t), [t]);
  const [allOpen, setAllOpen] = useState(false);

  const earned = achievements.filter((a) => a.earned).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const lockedVisible = interleaveByCategory(achievements.filter((a) => !a.earned && !a.hidden));
  const lockedHidden = achievements.filter((a) => !a.earned && a.hidden);
  const sorted = [...earned, ...lockedVisible, ...lockedHidden];
  const earnedCount = achievements.filter((a) => a.earned).length;

  // Preview: up to 4 random earned achievements, then fill the rest with ones
  // you haven't completed yet — a taste of progress plus goals to chase.
  // Re-rolled whenever the achievements load (e.g. each time you open Profile).
  const preview = useMemo(() => {
    const pickedEarned = [...achievements.filter((a) => a.earned)]
      .sort(() => Math.random() - 0.5)
      .slice(0, PREVIEW_EARNED);
    const lockedPool = [
      ...interleaveByCategory(achievements.filter((a) => !a.earned && !a.hidden)),
      ...achievements.filter((a) => !a.earned && a.hidden),
    ];
    const pickedLocked = lockedPool.slice(0, PREVIEW_COUNT - pickedEarned.length);
    return [...pickedEarned, ...pickedLocked];
  }, [achievements]);

  React.useEffect(() => {
    if (autoOpen && achievements.length > 0) {
      setAllOpen(true);
    }
  }, [achievements.length, autoOpen]);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={achStyles.headerButton}
        onPress={() => setAllOpen(true)}
        activeOpacity={0.75}
        disabled={achievements.length === 0}
      >
        <Text style={styles.sectionTitle}>
          Achievements · {earnedCount}/{achievements.length}
        </Text>
        {achievements.length > 0 && <Text style={achStyles.headerArrow}>→</Text>}
      </TouchableOpacity>
      {achievements.length === 0 ? (
        <EmptyCard text="No achievements yet. Keep logging parties to unlock milestones." />
      ) : (
        <View style={achStyles.grid}>
          {preview.map((a) => (
            <AchievementBadge key={a.id} achievement={a} locked={!a.earned} />
          ))}
        </View>
      )}

      <Modal visible={allOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAllOpen(false)}>
        <SafeAreaView style={achStyles.sheetContainer}>
          <View style={achStyles.sheetHeader}>
            <Text style={achStyles.sheetTitle}>Achievements · {earnedCount}/{achievements.length}</Text>
            <TouchableOpacity onPress={() => setAllOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={achStyles.sheetClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={achStyles.sheetScroll} showsVerticalScrollIndicator={false}>
            <View style={achStyles.grid}>
              {sorted.map((a) => (
                <AchievementBadge key={a.id} achievement={a} locked={!a.earned} />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  const statStyles = useMemo(() => makeStatStyles(t), [t]);
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function InsightCard({ title, value, note }: { title: string; value: string; note: string }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightNote}>{note}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const makeStatStyles = (t: Theme) => StyleSheet.create({
  card: {
    flexBasis: '48%',
    backgroundColor: t.color.surface,
    borderRadius: t.radius.md,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  value: { fontSize: 28, fontFamily: t.font.display, color: t.color.accent },
  label: { fontSize: 13, color: t.color.textSecondary, fontFamily: t.font.bodySemibold },
});

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  scroll: { padding: 24, gap: 24 },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileTitle: { fontSize: 38, lineHeight: 44, fontFamily: t.font.display, color: t.color.textPrimary },
  profileEdit: { fontSize: 18, fontFamily: t.font.bodyBold, color: t.color.accent },
  profileEditDisabled: { opacity: 0.4 },
  avatarCard: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  avatarMeta: { alignItems: 'center', gap: 8 },
  inlineEdit: { width: '100%', gap: 12, paddingHorizontal: 4, alignItems: 'center' },
  catGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  editActions: { width: '100%', flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.color.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: t.radius.md, backgroundColor: t.color.accent, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  avatarRing: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.glow(t.color.accent),
  },
  avatarRingSvg: { position: 'absolute' },
  avatarCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 6,
    borderColor: t.color.surface,
  },
  displayName: { fontSize: 28, lineHeight: 34, fontFamily: t.font.display, color: t.color.textPrimary, textAlign: 'center' },
  levelPill: {
    borderRadius: t.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: t.color.surfaceAlt,
  },
  levelPillText: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.purple },
  levelProgressText: {
    marginTop: 6,
    fontSize: 15,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    textAlign: 'center',
  },
  section: { gap: 12 },
  sectionTitle: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  loadingCard: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.md, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border },
  emptyCard: { borderRadius: t.radius.md, padding: 18, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border },
  emptyText: { fontSize: 14, lineHeight: 21, fontFamily: t.font.body, color: t.color.textSecondary },
  insightCard: { borderRadius: t.radius.md, padding: 18, gap: 6, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border },
  insightTitle: { fontSize: 12, fontFamily: t.font.bodyBold, letterSpacing: 0.8, textTransform: 'uppercase', color: t.color.accent },
  insightValue: { fontSize: 20, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  insightNote: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.color.border, gap: 12 },
  listRowText: { fontSize: 16, fontFamily: t.font.body, color: t.color.textPrimary, flex: 1 },
  listRowChevron: { fontSize: 14, fontFamily: t.font.bodySemibold, color: t.color.accent },
  catBtn: {
    width: 56,
    height: 56,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 2,
    borderColor: t.color.border,
  },
  catBtnSelected: { borderColor: t.color.accent, backgroundColor: t.color.accentSoft },
  nameInput: {
    width: '100%',
    height: 52,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.color.border,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    backgroundColor: t.color.surfaceAlt,
  },
});

const BADGE_SIZE = (SCREEN_WIDTH - 48 - 24) / 4; // 4 cols, 24px side padding, 3×8px gaps

const makeAchStyles = (t: Theme) => StyleSheet.create({
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerArrow: { fontSize: 20, color: t.color.accent, fontFamily: t.font.bodyBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: t.radius.md,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
  },
  badgeLocked: { opacity: 0.38 },
  badgeEarned: {
    borderColor: t.color.success,
    borderWidth: 2,
    backgroundColor: t.isDark ? 'rgba(95,184,95,0.12)' : 'rgba(95,184,95,0.10)',
  },
  badgeEmoji: { fontSize: 24 },
  badgeTitle: { fontSize: 10, fontFamily: t.font.bodyBold, color: t.color.amber, textAlign: 'center', lineHeight: 13 },
  // liquid glass modal
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glassCard: {
    width: SCREEN_WIDTH - 64,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.color.border,
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
    backgroundColor: t.isDark ? 'rgba(26,19,48,0.55)' : 'rgba(255,255,255,0.35)',
  },
  glassEmoji: { fontSize: 56, lineHeight: 68 },
  glassTitle: { fontSize: 22, fontFamily: t.font.display, color: t.color.textPrimary, textAlign: 'center' },
  glassDesc: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary, textAlign: 'center', lineHeight: 22 },
  glassPill: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.accentSoft,
    borderWidth: 1,
    borderColor: t.color.accent,
  },
  glassPillText: { fontSize: 12, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  glassPillLocked: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  glassPillLockedText: { fontSize: 12, fontFamily: t.font.bodyBold, color: t.color.textTertiary },
  sheetContainer: { flex: 1, backgroundColor: t.color.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
  sheetTitle: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  sheetClose: { fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.accent },
  sheetScroll: { padding: 24 },
});
