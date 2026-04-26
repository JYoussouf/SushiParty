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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFriends } from '../../src/hooks/useFriends';
import { getNewlyEarnedAchievements } from '../../src/lib/achievements';
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
import type { Menu, SushiSession } from '../../src/types';

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
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [expandedBreakdownCats, setExpandedBreakdownCats] = useState<Set<string>>(new Set());

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

      if (origin === 'submit' && userProfile) {
        const allSessions = await getAllSessions();
        const previousSessions = allSessions.filter((session) => session.id !== foundSession.id);
        const achievements = getNewlyEarnedAchievements(allSessions, previousSessions, userProfile.uid)
          .slice(0, 3)
          .map((achievement) => achievement.title);
        setEarnedAchievements(achievements);
      } else {
        setEarnedAchievements([]);
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

  const handleDone = () => {
    if (origin === 'history') {
      router.back();
      return;
    }
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
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#ff6f3c" />
      </SafeAreaView>
    );
  }

  if (!session || !menu || !submittedAt) {
    return <SafeAreaView style={styles.loadingContainer} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
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
        </View>

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
                                  <Text style={styles.itemEmoji}>{getItemEmoji(item.imageKey, item.category)}</Text>
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

        {earnedAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiny trophies</Text>
            <View style={styles.achievementList}>
              {earnedAchievements.map((title) => (
                <View key={title} style={styles.achievementCard}>
                  <Text style={styles.achievementEmoji}>🏆</Text>
                  <Text style={styles.achievementTitle}>{title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showTagModal} animationType="slide" onRequestClose={() => setShowTagModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar style="dark" />
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
            {savingTags ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Tags</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <Modal visible={showNoteModal} animationType="slide" onRequestClose={() => setShowNoteModal(false)}>
        <SafeAreaView style={styles.noteModalContainer}>
          <StatusBar style="dark" />
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
              placeholderTextColor="#9f8f86"
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, savingNote && styles.saveButtonDisabled]}
              onPress={() => void handleSaveNote()}
              disabled={savingNote}
            >
              {savingNote ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Note</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff1e6' },
  loadingContainer: { flex: 1, backgroundColor: '#fff1e6', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 28, gap: 18 },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    gap: 10,
    backgroundColor: '#ff7a59',
    borderWidth: 1,
    borderColor: '#ff946f',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#fff3e8' },
  heroTitle: { fontSize: 32, lineHeight: 36, fontWeight: '900', color: '#fffdf8' },
  heroText: { fontSize: 15, lineHeight: 22, color: '#fff3e8' },
  heroStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  statPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statPillHot: { backgroundColor: '#fff4cf' },
  statPillLabel: { fontSize: 13, fontWeight: '800', color: '#fffdf8' },
  statPillHotText: { fontSize: 13, fontWeight: '800', color: '#8c4d00' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 21, fontWeight: '900', color: '#2c211c' },
  actionChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffe1d2',
  },
  actionChipText: { fontSize: 13, fontWeight: '800', color: '#d7522e' },
  plateCard: {
    borderRadius: 28,
    padding: 18,
    gap: 14,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f2d6c8',
  },
  plateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  plateTitle: { fontSize: 22, fontWeight: '900', color: '#2c211c' },
  plateSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 20, color: '#7d6558' },
  plateSurface: {
    borderRadius: 999,
    backgroundColor: '#f9f4ef',
    borderWidth: 10,
    borderColor: '#ffffff',
    padding: 14,
    minHeight: 210,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  plateInner: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#f1ddd0',
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
    backgroundColor: '#fff',
  },
  moreBubble: { backgroundColor: '#ffe3cb' },
  pieceEmoji: { fontSize: 18 },
  moreText: { fontSize: 13, fontWeight: '800', color: '#b35b19' },
  emptyPlateText: { textAlign: 'center', fontSize: 15, lineHeight: 21, color: '#8f7869' },
  playerPlateGrid: { gap: 14 },
  listCard: {
    borderRadius: 24,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f2d6c8',
    overflow: 'hidden',
  },
  rowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ecd8cb',
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#2c211c' },
  rowValue: { fontSize: 15, fontWeight: '900', color: '#d7522e' },
  rowChevron: { fontSize: 11, color: '#b09080' },
  participantBreakdown: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 4,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ecd8cb',
  },
  breakdownCatGroup: { gap: 2 },
  breakdownCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownCatLabel: { fontSize: 13, fontWeight: '700', color: '#9a7a6e' },
  breakdownCatRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownCatCount: { fontSize: 13, fontWeight: '700', color: '#5e4a3f' },
  breakdownCatChevron: { fontSize: 10, color: '#bbb' },
  superlativesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  superlativeCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f2d6c8',
    gap: 4,
  },
  superlativeEmoji: { fontSize: 28, lineHeight: 34 },
  superlativeLabel: { fontSize: 12, fontWeight: '700', color: '#b07050', textTransform: 'uppercase', letterSpacing: 0.6 },
  superlativeWinner: { fontSize: 15, fontWeight: '800', color: '#2c211c' },
  noteCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f2d6c8',
  },
  noteBody: { fontSize: 15, lineHeight: 22, color: '#5e4a3f' },
  achievementList: { gap: 10 },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#fff4cf',
    borderWidth: 1,
    borderColor: '#f2d68a',
  },
  achievementEmoji: { fontSize: 20 },
  achievementTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#725000' },
  breakdownCard: {
    gap: 10,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f2d6c8',
  },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownTitle: { fontSize: 17, fontWeight: '800', color: '#2c211c' },
  breakdownTotal: { fontSize: 15, fontWeight: '900', color: '#d7522e' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemEmoji: { fontSize: 18 },
  itemName: { flex: 1, fontSize: 14, color: '#5e4a3f' },
  itemCount: { fontSize: 14, fontWeight: '800', color: '#2c211c' },
  doneButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2c211c',
  },
  doneButtonText: { fontSize: 16, fontWeight: '800', color: '#fff7f1' },
  modalContainer: { flex: 1, backgroundColor: '#fff8f2', padding: 20 },
  noteModalContainer: { flex: 1, backgroundColor: '#fff8f2', paddingHorizontal: 20, paddingTop: 16 },
  noteModalContent: { paddingHorizontal: 6, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#2c211c' },
  modalClose: { fontSize: 16, fontWeight: '800', color: '#d7522e' },
  modalText: { fontSize: 14, lineHeight: 21, color: '#6e5a4f' },
  modalList: { flex: 1, paddingTop: 18, gap: 12 },
  modalEmpty: { fontSize: 15, color: '#7d6558' },
  friendOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eed8cb',
  },
  friendOptionSelected: { backgroundColor: '#fff0e8', borderColor: '#f6c8b5' },
  friendOptionName: { fontSize: 16, fontWeight: '800', color: '#2c211c' },
  friendOptionUsername: { marginTop: 2, fontSize: 13, color: '#8a7467' },
  friendOptionCheck: { fontSize: 13, fontWeight: '800', color: '#9b8b81' },
  friendOptionCheckSelected: { color: '#d7522e' },
  saveButton: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#d7522e',
    marginBottom: 8,
  },
  saveButtonDisabled: { backgroundColor: '#f5b6a1' },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  noteInput: {
    height: 80,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eed8cb',
    backgroundColor: '#fff',
    padding: 16,
    fontSize: 15,
    color: '#2c211c',
    marginBottom: 16,
  },
  noteDisplay: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5e4a3f',
    padding: 18,
  },
  addNoteButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#ffe1d2',
    borderWidth: 1,
    borderColor: '#f2d6c8',
  },
  addNoteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#d7522e',
  },
});
