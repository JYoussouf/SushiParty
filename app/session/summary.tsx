import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components/BackButton';
import { ItemSprite } from '../../src/components/ItemSprite';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFriends } from '../../src/hooks/useFriends';
import { getNewlyEarnedAchievements, getAchievements } from '../../src/lib/achievements';
import { showInterstitialIfDue } from '../../src/lib/ads';
import { getCategoryLabel } from '../../src/lib/categoryLabels';
import { getMenu } from '../../src/lib/cloudflare/menus';
import { getItemEmoji } from '../../src/lib/itemEmoji';
import {
  getAllSessions,
  getSessionById,
  tagFriendsOnSession,
  updateSessionNote,
} from '../../src/lib/cloudflare/sessions';
import {
  getParticipantSummaries,
  getSessionSuperlatives,
  getSessionTotalPieces,
} from '../../src/lib/sessionSummary';
import type { Achievement, Menu, SushiSession } from '../../src/types';

const MAX_PLATE_PIECES = 48;

function getModeLabel(mode: SushiSession['mode']): string {
  if (mode === 'single') return 'Solo feast';
  if (mode === 'individual') return 'Side-by-side';
  return 'Group chaos';
}

function isUnknownRestaurant(session: SushiSession): boolean {
  return session.restaurantId === 'unknown' || session.restaurantName === 'Unknown Restaurant';
}

function getFunHeadline(totalPieces: number): string {
  if (totalPieces >= 80) return 'Absolute sushi destruction';
  if (totalPieces >= 40) return 'A very respectable feast';
  if (totalPieces >= 15) return 'Plates cleared. Mission complete.';
  return 'Tiny feast. Strong effort.';
}

function getBaseItemId(itemId: string): string {
  return itemId.split(':')[0] ?? itemId;
}

function buildPlatePieces(
  counts: Record<string, number>,
  menuItems: Menu['items'],
): { pieces: string[]; hiddenCount: number } {
  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  const pieces: string[] = [];

  for (const [itemKey, count] of Object.entries(counts)) {
    const item = menuById.get(getBaseItemId(itemKey));
    const emoji = getItemEmoji(item?.imageKey, item?.category ?? 'other');
    for (let index = 0; index < count; index += 1) {
      pieces.push(emoji);
    }
  }

  const hiddenCount = Math.max(0, pieces.length - MAX_PLATE_PIECES);
  return {
    pieces: pieces.slice(0, MAX_PLATE_PIECES),
    hiddenCount,
  };
}

function PlateCard({
  title,
  subtitle,
  pieces,
  hiddenCount,
}: {
  title: string;
  subtitle: string;
  pieces: string[];
  hiddenCount: number;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.plateCard}>
      <View style={styles.plateHeader}>
        <View>
          <Text style={styles.plateTitle}>{title}</Text>
          <Text style={styles.plateSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.plateSurface}>
        <View style={styles.plateInner}>
          {pieces.length === 0 ? (
            <Text style={styles.emptyPlateText}>A suspiciously clean plate.</Text>
          ) : (
            <View style={styles.piecesWrap}>
              {pieces.map((piece, index) => (
                <View key={`${piece}-${index}`} style={styles.pieceBubble}>
                  <Text style={styles.pieceEmoji}>{piece}</Text>
                </View>
              ))}
              {hiddenCount > 0 && (
                <View style={[styles.pieceBubble, styles.moreBubble]}>
                  <Text style={styles.moreText}>+{hiddenCount}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function SessionSummaryScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile } = useAuth();
  const params = useLocalSearchParams<{ id?: string; origin?: string; allowUnknown?: string }>();
  const [session, setSession] = useState<SushiSession | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [draftNote, setDraftNote] = useState('');
  const [newlyEarnedAchievementIds, setNewlyEarnedAchievementIds] = useState<string[]>([]);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [expandedBreakdownCats, setExpandedBreakdownCats] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState(false);

  const toggleBreakdownCat = (userId: string, cat: string) => {
    const key = `${userId}:${cat}`;
    setExpandedBreakdownCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const { friends, refresh: refreshFriends } = useFriends();

  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const origin = Array.isArray(params.origin) ? params.origin[0] : params.origin;
  const allowUnknown = Array.isArray(params.allowUnknown) ? params.allowUnknown[0] : params.allowUnknown;

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      Alert.alert('Party unavailable', 'No party id was provided.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    setLoading(true);
    try {
      const foundSession = await getSessionById(sessionId);
      if (!foundSession) {
        Alert.alert('Party unavailable', 'That party could not be found on this device.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      if (isUnknownRestaurant(foundSession) && allowUnknown !== '1') {
        router.replace({
          pathname: '/session/restaurant-confirm',
          params: {
            id: foundSession.id,
            ...(origin ? { origin } : {}),
          },
        });
        return;
      }

      const sessionMenu = await getMenu(foundSession.menuId);
      setSession(foundSession);
      setMenu(sessionMenu);
      setDraftNote(foundSession.note ?? '');

      if (userProfile) {
        const allSessions = await getAllSessions();
        setAllAchievements(getAchievements(allSessions, userProfile.uid));

        if (origin === 'submit') {
          const previousSessions = allSessions.filter((session) => session.id !== foundSession.id);
          const achievements = getNewlyEarnedAchievements(allSessions, previousSessions, userProfile.uid)
            .slice(0, 3)
            .map((achievement) => achievement.id);
          setNewlyEarnedAchievementIds(achievements);
        } else {
          setNewlyEarnedAchievementIds([]);
        }
      } else {
        setAllAchievements([]);
        setNewlyEarnedAchievementIds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [allowUnknown, origin, router, sessionId, userProfile]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const participants = useMemo(() => (session ? getParticipantSummaries(session) : []), [session]);
  const totalPieces = session ? getSessionTotalPieces(session) : 0;
  const submittedAt = session ? new Date(session.submittedAt ?? session.startedAt) : null;
  const participantIds = new Set(session?.participants.map((participant) => participant.userId) ?? []);
  const availableFriends = friends.filter((friend) => !participantIds.has(friend.user.uid));

  const totalPlate = useMemo(() => {
    if (!session || !menu) return { pieces: [], hiddenCount: 0 };

    const mergedCounts = session.participants.reduce<Record<string, number>>((acc, participant) => {
      for (const [itemId, count] of Object.entries(participant.counts)) {
        acc[itemId] = (acc[itemId] ?? 0) + count;
      }
      return acc;
    }, {});

    return buildPlatePieces(mergedCounts, menu.items);
  }, [menu, session]);

  const participantPlates = useMemo(() => {
    if (!session || !menu || session.participants.length <= 1) return [];

    return session.participants.map((participant) => ({
      participant,
      ...buildPlatePieces(participant.counts, menu.items),
    }));
  }, [menu, session]);

  const superlatives = useMemo(
    () => (session && menu ? getSessionSuperlatives(session, menu.items) : []),
    [session, menu],
  );

  const newlyEarnedAchievementCount = newlyEarnedAchievementIds.length;

  const displayAchievements = useMemo(() => {
    if (newlyEarnedAchievementIds.length > 0) {
      return allAchievements.filter((achievement) => newlyEarnedAchievementIds.includes(achievement.id));
    }
    return allAchievements.filter((achievement) => !achievement.hidden).slice(0, 6);
  }, [newlyEarnedAchievementIds, allAchievements]);

  const openAchievements = () => {
    router.push({ pathname: '/(tabs)/profile', params: { achievements: '1' } });
  };

  const handleDone = async () => {
    // Guard against re-entry: a double-tap (or header + bottom button) must not
    // double-fire navigation or the interstitial.
    if (leaving) return;
    setLeaving(true);
    if (origin === 'history') {
      router.back();
      return;
    }
    // Occasional interstitial at the natural break — after the user has enjoyed
    // their results and is heading home (no-op unless ads are enabled / due).
    await showInterstitialIfDue();
    // Head straight home — the celebratory splash belongs before a party starts,
    // not on the way out, where it would just be dead delay.
    router.replace('/(tabs)/home');
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId],
    );
  };

  const handleSaveTags = async () => {
    if (!session) return;

    const friendsToTag = friends
      .filter((friend) => selectedFriendIds.includes(friend.user.uid))
      .map((friend) => ({
        uid: friend.user.uid,
        displayName: friend.user.displayName,
      }));

    if (friendsToTag.length === 0) {
      setShowTagModal(false);
      return;
    }

    setSavingTags(true);
    try {
      const updated = await tagFriendsOnSession(session.id, friendsToTag);
      if (!updated) {
        Alert.alert('Tagging failed', 'The session could not be updated.');
        return;
      }
      setSession(updated);
      setSelectedFriendIds([]);
      setShowTagModal(false);
      await refreshFriends();
    } finally {
      setSavingTags(false);
    }
  };

  const handleSaveNote = async () => {
    if (!session) return;
    setSavingNote(true);
    try {
      const updated = await updateSessionNote(session.id, draftNote);
      if (!updated) {
        Alert.alert('Note failed', 'The session note could not be updated.');
        return;
      }
      setSession(updated);
      setShowNoteModal(false);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={t.color.accent} />
      </View>
    );
  }

  if (!session || !menu || !submittedAt) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <BackButton
          onPress={() => void handleDone()}
          disabled={leaving}
          label={origin === 'history' ? 'History' : 'Home'}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={t.color.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.eyebrow}>Feast recap</Text>
          <Text style={styles.heroTitle}>{getFunHeadline(totalPieces)}</Text>
          <Text style={styles.heroText}>
            {submittedAt.toLocaleDateString()} at{' '}
            {submittedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} •{' '}
            {session.restaurantName}
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>{getModeLabel(session.mode)}</Text>
            </View>
            <View style={[styles.statPill, styles.statPillHot]}>
              <Text style={styles.statPillHotText}>{totalPieces} pieces down</Text>
            </View>
          </View>
        </LinearGradient>

        <PlateCard
          title="Party platter"
          subtitle={`${totalPieces} pieces disappeared in total`}
          pieces={totalPlate.pieces}
          hiddenCount={totalPlate.hiddenCount}
        />

        {participantPlates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Player plates</Text>
            <View style={styles.playerPlateGrid}>
              {participantPlates.map(({ participant, pieces, hiddenCount }) => {
                const summary = participants.find((entry) => entry.userId === participant.userId);
                return (
                  <PlateCard
                    key={participant.userId}
                    title={participant.displayName}
                    subtitle={`${summary?.totalPieces ?? 0} pieces`}
                    pieces={pieces}
                    hiddenCount={hiddenCount}
                  />
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Who showed up hungry?</Text>
            {availableFriends.length > 0 && (
              <TouchableOpacity style={styles.actionChip} onPress={() => setShowTagModal(true)}>
                <Text style={styles.actionChipText}>Tag Friends</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.listCard}>
            {participants.map((participant) => {
              const isExpanded = expandedParticipants.has(participant.userId);
              const sessionParticipant = session.participants.find((p) => p.userId === participant.userId);
              const itemsByCategory = menu.items.reduce<Record<string, { id: string; name: string; imageKey: string | undefined; category: string; count: number }[]>>(
                (acc, menuItem) => {
                  const count = sessionParticipant?.counts[menuItem.id] ?? 0;
                  if (count === 0) return acc;
                  if (!acc[menuItem.category]) acc[menuItem.category] = [];
                  const isAny = menuItem.id.endsWith('-any');
                  const name = isAny ? getCategoryLabel(menuItem.category) : menuItem.name;
                  acc[menuItem.category]!.push({ id: menuItem.id, name, imageKey: menuItem.imageKey, category: menuItem.category, count });
                  return acc;
                },
                {},
              );
              const hasItems = Object.keys(itemsByCategory).length > 0;

              return (
                <View key={participant.userId}>
                  <TouchableOpacity
                    style={styles.rowCard}
                    onPress={() => {
                      if (!hasItems) return;
                      setExpandedParticipants((prev) => {
                        const next = new Set(prev);
                        if (next.has(participant.userId)) next.delete(participant.userId);
                        else next.add(participant.userId);
                        return next;
                      });
                    }}
                    activeOpacity={hasItems ? 0.7 : 1}
                  >
                    <Text style={styles.rowTitle}>{participant.displayName}</Text>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowValue}>{participant.totalPieces} pcs</Text>
                      {hasItems && (
                        <Text style={styles.rowChevron}>{isExpanded ? '▲' : '▼'}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.participantBreakdown}>
                      {Object.entries(itemsByCategory).map(([cat, catItems]) => {
                        const catKey = `${participant.userId}:${cat}`;
                        const catExpanded = expandedBreakdownCats.has(catKey);
                        const catTotal = catItems.reduce((s, it) => s + it.count, 0);
                        return (
                          <View key={cat} style={styles.breakdownCatGroup}>
                            <TouchableOpacity
                              style={styles.breakdownCatRow}
                              onPress={() => toggleBreakdownCat(participant.userId, cat)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.breakdownCatLabel}>{getCategoryLabel(cat)}</Text>
                              <View style={styles.breakdownCatRight}>
                                <Text style={styles.breakdownCatCount}>{catTotal}</Text>
                                <Text style={styles.breakdownCatChevron}>{catExpanded ? '▲' : '▼'}</Text>
                              </View>
                            </TouchableOpacity>
                            {catExpanded && catItems.map((item) => (
                              <View key={item.id} style={styles.itemRow}>
                                <View style={styles.itemLabelRow}>
                                  <ItemSprite imageKey={item.imageKey} category={item.category} size={24} />
                                  <Text style={styles.itemName}>{item.name}</Text>
                                </View>
                                <Text style={styles.itemCount}>{item.count}</Text>
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {superlatives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Party Awards</Text>
            <View style={styles.superlativesGrid}>
              {superlatives.map((s) => (
                <View key={s.label} style={styles.superlativeCard}>
                  <Text style={styles.superlativeEmoji}>{s.emoji}</Text>
                  <Text style={styles.superlativeLabel}>{s.label}</Text>
                  <Text style={styles.superlativeWinner}>{s.winners.join(' & ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {session.note?.trim() && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <TouchableOpacity style={styles.actionChip} onPress={() => setShowNoteModal(true)}>
                <Text style={styles.actionChipText}>Edit Note</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.listCard}>
              <Text style={styles.noteDisplay}>{session.note}</Text>
            </View>
          </View>
        )}

        {!session.note?.trim() && (
          <TouchableOpacity style={styles.addNoteButton} onPress={() => setShowNoteModal(true)}>
            <Text style={styles.addNoteButtonText}>+ Add Note</Text>
          </TouchableOpacity>
        )}

        {displayAchievements.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionTitleRow}
              onPress={openAchievements}
              activeOpacity={0.75}
            >
              <Text style={styles.sectionTitle}>
                {newlyEarnedAchievementCount > 0
                  ? `${newlyEarnedAchievementCount} achievement${newlyEarnedAchievementCount === 1 ? '' : 's'} unlocked`
                  : 'Achievements'}
              </Text>
              <Text style={styles.sectionTitleLink}>Open</Text>
            </TouchableOpacity>
            <View style={styles.achievementList}>
              {displayAchievements.map((achievement) => {
                const isEarned = achievement.earned;
                const isHiddenLocked = !isEarned && achievement.hidden;
                return (
                  <TouchableOpacity
                    key={achievement.id}
                    style={[styles.achievementCard, !isEarned && styles.achievementCardLocked]}
                    onPress={openAchievements}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.achievementEmoji, !isEarned && styles.achievementEmojiLocked]}>
                      {isHiddenLocked ? '🔒' : achievement.emoji}
                    </Text>
                    <View style={styles.achievementCardContent}>
                      <Text style={[styles.achievementTitle, !isEarned && styles.achievementTitleLocked]}>
                        {isHiddenLocked ? '???' : achievement.title}
                      </Text>
                      <Text style={[styles.achievementDescription, !isEarned && styles.achievementDescriptionLocked]}>
                        {isHiddenLocked ? 'Keep logging parties to discover this badge.' : achievement.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.doneButton, leaving && styles.doneButtonDisabled]}
          onPress={() => void handleDone()}
          activeOpacity={0.85}
          disabled={leaving}
        >
          <LinearGradient
            colors={t.color.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneButtonInner}
          >
            <Text style={styles.doneButtonText}>
              {origin === 'history' ? 'Back to History' : "Let's Go Home!"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showTagModal} animationType="slide" onRequestClose={() => setShowTagModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar style={t.isDark ? 'light' : 'dark'} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tag Friends</Text>
            <TouchableOpacity onPress={() => setShowTagModal(false)} disabled={savingTags}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            Add friends who were at this session. Tagged attendees show up across history and social views.
          </Text>
          <View style={styles.modalList}>
            {availableFriends.length === 0 ? (
              <Text style={styles.modalEmpty}>No additional friends available to tag.</Text>
            ) : (
              availableFriends.map((friend) => {
                const selected = selectedFriendIds.includes(friend.user.uid);
                return (
                  <TouchableOpacity
                    key={friend.user.uid}
                    style={[styles.friendOption, selected && styles.friendOptionSelected]}
                    onPress={() => toggleFriendSelection(friend.user.uid)}
                    disabled={savingTags}
                  >
                    <View>
                      <Text style={styles.friendOptionName}>{friend.user.displayName}</Text>
                      <Text style={styles.friendOptionUsername}>@{friend.user.username}</Text>
                    </View>
                    <Text style={[styles.friendOptionCheck, selected && styles.friendOptionCheckSelected]}>
                      {selected ? 'Selected' : 'Select'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          <TouchableOpacity
            style={[styles.saveButton, savingTags && styles.saveButtonDisabled]}
            onPress={() => void handleSaveTags()}
            disabled={savingTags}
          >
            {savingTags ? <ActivityIndicator color={t.color.onAccent} /> : <Text style={styles.saveButtonText}>Save Tags</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <Modal visible={showNoteModal} animationType="slide" onRequestClose={() => setShowNoteModal(false)}>
        <SafeAreaView style={styles.noteModalContainer}>
          <StatusBar style={t.isDark ? 'light' : 'dark'} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Note</Text>
            <TouchableOpacity onPress={() => setShowNoteModal(false)} disabled={savingNote}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.noteModalContent}>
            <TextInput
              style={styles.noteInput}
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder="Was it everything you ever hoped for?"
              placeholderTextColor={t.color.textTertiary}
              autoCorrect={false}
              spellCheck={false}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, savingNote && styles.saveButtonDisabled]}
              onPress={() => void handleSaveNote()}
              disabled={savingNote}
            >
              {savingNote ? <ActivityIndicator color={t.color.onAccent} /> : <Text style={styles.saveButtonText}>Save Note</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  loadingContainer: { flex: 1, backgroundColor: t.color.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 28, gap: 18 },
  heroCard: {
    borderRadius: t.radius.lg,
    padding: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.glow(t.color.accent),
  },
  eyebrow: { fontSize: 12, fontFamily: t.font.bodyBold, letterSpacing: 1, textTransform: 'uppercase', color: t.color.onAccent },
  heroTitle: { fontSize: 32, lineHeight: 36, fontFamily: t.font.display, color: t.color.onAccent },
  heroText: { fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.onAccent },
  heroStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  statPill: {
    borderRadius: t.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statPillHot: { backgroundColor: t.color.surface },
  statPillLabel: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  statPillHotText: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.accent },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 21, fontFamily: t.font.display, color: t.color.textPrimary },
  actionChip: {
    borderRadius: t.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: t.color.accentSoft,
  },
  actionChipText: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  plateCard: {
    borderRadius: t.radius.lg,
    padding: 18,
    gap: 14,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  plateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  plateTitle: { fontSize: 22, fontFamily: t.font.display, color: t.color.textPrimary },
  plateSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 20, fontFamily: t.font.body, color: t.color.textSecondary },
  plateSurface: {
    borderRadius: 999,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 10,
    borderColor: t.color.surface,
    padding: 14,
    minHeight: 210,
    justifyContent: 'center',
    ...t.shadow.card,
  },
  plateInner: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: t.color.border,
    padding: 18,
    minHeight: 170,
    justifyContent: 'center',
  },
  piecesWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pieceBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surface,
  },
  moreBubble: { backgroundColor: t.color.accentSoft },
  pieceEmoji: { fontSize: 18 },
  moreText: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.accent },
  emptyPlateText: { textAlign: 'center', fontSize: 15, lineHeight: 21, fontFamily: t.font.body, color: t.color.textSecondary },
  playerPlateGrid: { gap: 14 },
  listCard: {
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: 'hidden',
  },
  rowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
  rowValue: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.accent },
  rowChevron: { fontSize: 11, color: t.color.textTertiary },
  participantBreakdown: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 4,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
  breakdownCatGroup: { gap: 2 },
  breakdownCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownCatLabel: { fontSize: 13, fontFamily: t.font.bodySemibold, color: t.color.textSecondary },
  breakdownCatRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownCatCount: { fontSize: 13, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
  breakdownCatChevron: { fontSize: 10, color: t.color.textTertiary },
  superlativesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  superlativeCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: t.radius.md,
    padding: 14,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 4,
  },
  superlativeEmoji: { fontSize: 28, lineHeight: 34 },
  superlativeLabel: { fontSize: 12, fontFamily: t.font.bodySemibold, color: t.color.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  superlativeWinner: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  noteCard: {
    borderRadius: t.radius.lg,
    padding: 18,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  noteBody: { fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitleLink: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.accent },
  achievementList: { gap: 10 },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: t.radius.md,
    padding: 14,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  achievementEmoji: { fontSize: 20 },
  achievementTitle: { flex: 1, fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.amber },
  achievementCardLocked: {
    backgroundColor: t.color.surface,
    borderColor: t.color.border,
  },
  achievementEmojiLocked: { opacity: 0.5 },
  achievementCardContent: { flex: 1 },
  achievementTitleLocked: { color: t.color.textTertiary },
  achievementDescription: { fontSize: 12, lineHeight: 16, fontFamily: t.font.body, color: t.color.textSecondary, marginTop: 2 },
  achievementDescriptionLocked: { color: t.color.textTertiary },
  breakdownCard: {
    gap: 10,
    borderRadius: t.radius.lg,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownTitle: { fontSize: 17, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  breakdownTotal: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.accent },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemEmoji: { fontSize: 18 },
  itemName: { flex: 1, fontSize: 14, fontFamily: t.font.body, color: t.color.textSecondary },
  itemCount: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  doneButton: {
    marginTop: 4,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  doneButtonDisabled: { opacity: 0.6 },
  doneButtonInner: {
    borderRadius: t.radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  modalContainer: { flex: 1, backgroundColor: t.color.bg, padding: 20 },
  noteModalContainer: { flex: 1, backgroundColor: t.color.bg, paddingHorizontal: 20, paddingTop: 16 },
  noteModalContent: { paddingHorizontal: 6, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 20 },
  modalTitle: { fontSize: 24, fontFamily: t.font.display, color: t.color.textPrimary },
  modalClose: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.accent },
  modalText: { fontSize: 14, lineHeight: 21, fontFamily: t.font.body, color: t.color.textSecondary },
  modalList: { flex: 1, paddingTop: 18, gap: 12 },
  modalEmpty: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary },
  friendOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: t.radius.md,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  friendOptionSelected: { backgroundColor: t.color.accentSoft, borderColor: t.color.accent },
  friendOptionName: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  friendOptionUsername: { marginTop: 2, fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  friendOptionCheck: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.textTertiary },
  friendOptionCheckSelected: { color: t.color.accent },
  saveButton: {
    borderRadius: t.radius.button,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: t.color.accent,
    marginBottom: 8,
  },
  saveButtonDisabled: { backgroundColor: t.color.surfaceAlt },
  saveButtonText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  noteInput: {
    height: 80,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    padding: 16,
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    marginBottom: 16,
  },
  noteDisplay: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    padding: 18,
  },
  addNoteButton: {
    borderRadius: t.radius.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: t.color.accentSoft,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  addNoteButtonText: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
});
