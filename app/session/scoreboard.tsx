import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Avatar, BackButton, ItemSpriteIdle } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { getCategoryLabel } from '../../src/lib/categoryLabels';
import { useSession } from '../../src/hooks/useSession';
import { useMenu } from '../../src/hooks/useMenu';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRestaurant } from '../../src/contexts/RestaurantContext';
import { submitSession } from '../../src/lib/cloudflare/sessions';
import { submitSession as submitLocalSession } from '../../src/lib/local/sessions';
import { globalMenu } from '../../src/lib/menus/globalMenu';
import { prepareInterstitial } from '../../src/lib/ads';
import { getRestaurantStats } from '../../src/lib/local/restaurantStats';
import { getRestaurant } from '../../src/lib/cloudflare/restaurants';
import { getSessionTemplates } from '../../src/lib/local/templates';
import { isAnomaly } from '../../src/lib/stats/anomalyDetection';
import type { SessionTemplate, SushiItem } from '../../src/types';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

// Approx. height of the absolutely-positioned footer (menu toggle + action row +
// vertical padding), before the safe-area inset is added on top. Used to keep the
// last list card clear of the footer while scrolling.
const FOOTER_CLEARANCE = 120;

export default function ScoreboardScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const { restaurant, clearRestaurant, setRestaurant } = useRestaurant();
  const {
    mode,
    increment,
    decrement,
    getCount,
    reset,
    participants,
    setActiveParticipantIndex,
    activeParticipantIndex,
    groupCode,
    groupOwnerUid,
    groupPhase,
    groupContext,
    endVote,
    endParty,
    startEndVote,
    acceptEndVote,
    cancelEndVote,
    currentUserCanEditActive,
    completeSession,
  } = useSession();
  const isHost = !!userProfile && userProfile.uid === groupOwnerUid;

  // End-party vote state derived for the footer UI.
  const voteActive = mode === 'group' && !!endVote?.active;
  const acceptedUserIds = endVote?.acceptedUserIds ?? [];
  const currentUserAccepted = !!userProfile && acceptedUserIds.includes(userProfile.uid);
  // Only count acceptances from participants still in the party.
  const readyCount = participants.filter((p) => acceptedUserIds.includes(p.userId)).length;
  const { activeMenu, useGlobalMenu, setUseGlobalMenu, canToggle } = useMenu();
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{
    totalPieces: number;
    mean: number;
    stdDev: number;
  } | null>(null);
  const [scoreboardMode, setScoreboardMode] = useState<'simple' | 'detailed'>('simple');
  const [query, setQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const tallyScale = useSharedValue(1);
  const tallyStyle = useAnimatedStyle(() => ({ transform: [{ scale: tallyScale.value }] }));

  const sessionTotalPieces = participants.reduce(
    (sum, participant) =>
      sum + Object.values(participant.counts).reduce((participantSum, count) => participantSum + count, 0),
    0,
  );

  // One-shot guard so a guest's end-of-party navigation fires exactly once, even if
  // the 'ended' phase re-broadcasts. Reset on unmount so the next party works.
  const endedNavRef = useRef(false);
  // One-shot guard so the HOST submits + navigates exactly once when the party ends
  // (either the vote passed unanimously and the server flipped phase, or the host
  // used the "End now" override). persistSession sets this too, so an override can't
  // double-fire against the ended-phase effect below.
  const hostSubmitRef = useRef(false);
  // Always-latest pointer to persistSession so the ended-phase effect can call it
  // without listing the (non-memoized) function as a dependency.
  const persistRef = useRef<(flagged: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    return () => {
      endedNavRef.current = false;
      hostSubmitRef.current = false;
    };
  }, []);

  // Guests follow the host to results: when the shared phase flips to 'ended', a
  // non-host builds a SushiSession from the shared draft context + ALL participants,
  // persists it LOCALLY only (never to D1 — that would duplicate the host's global
  // record and double-count restaurant stats), then opens the individualized summary.
  useEffect(() => {
    if (mode !== 'group' || isHost || groupPhase !== 'ended') return;
    if (endedNavRef.current || !userProfile) return;
    endedNavRef.current = true;

    // Snapshot now: the host's DO teardown (draft=null) may reset context shortly after.
    const finalParticipants = participants;
    const ctx = groupContext;
    const code = groupCode;

    void (async () => {
      try {
        const localId = await submitLocalSession({
          ownerUid: userProfile.uid,
          mode: 'group',
          // Missing-context fallback (e.g. host on an older client): still show results
          // built from whatever's available rather than crash. 'unknown'/global menu
          // mirror the existing unknown-restaurant handling.
          restaurantId: ctx?.restaurantId ?? 'unknown',
          restaurantName: ctx?.restaurantName ?? 'Unknown Restaurant',
          menuId: ctx?.menuId ?? globalMenu.id,
          menuVersion: ctx?.menuVersion ?? globalMenu.version,
          location: ctx?.location ?? { latitude: 0, longitude: 0 },
          participants: finalParticipants,
          ...(ctx?.startedAt ? { startedAt: ctx.startedAt } : {}),
          ...(code ? { groupCode: code } : {}),
        });
        logPartyFlow('guest end -> summary (local)', { localId });
        // `local=1` tells summary to load this guest-only session from local storage;
        // `allowUnknown=1` skips restaurant-confirm (guests don't own the restaurant).
        router.replace({
          pathname: '/session/summary',
          params: { id: localId, origin: 'submit', local: '1', allowUnknown: '1' },
        });
      } catch (error) {
        // Allow a retry if a later 'ended' re-broadcast arrives.
        endedNavRef.current = false;
        logPartyFlow('guest end persist failed', error);
      }
    })();
  }, [mode, isHost, groupPhase, userProfile, participants, groupContext, groupCode, router]);

  // Host follows the party to results when the shared phase flips to 'ended' — this
  // fires when the vote passes unanimously (server-driven, even if the host's own
  // "End now" wasn't tapped). persistSession submits the host's session, tears the
  // party down, and navigates. Guarded so the host-override path can't double-submit.
  useEffect(() => {
    if (mode !== 'group' || !isHost || groupPhase !== 'ended') return;
    if (hostSubmitRef.current || !userProfile) return;
    hostSubmitRef.current = true;
    void persistRef.current(false);
  }, [mode, isHost, groupPhase, userProfile]);

  useEffect(() => {
    logPartyFlow('scoreboard mounted');
    // Warm up the post-party ad while the party is happening, so it shows
    // instantly at the summary (no-op unless ads are enabled).
    prepareInterstitial();
    return () => logPartyFlow('scoreboard unmounted');
  }, []);

  useEffect(() => {
    if (sessionTotalPieces > 0) {
      tallyScale.value = withSequence(
        withSpring(1.18, { damping: 6, stiffness: 400 }),
        withSpring(1, { damping: 14, stiffness: 200 }),
      );
    }
  }, [sessionTotalPieces]);

  useEffect(() => {
    logPartyFlow('scoreboard state snapshot', {
      mode,
      groupCode,
      participants: participants.length,
      sessionTotalPieces,
    });
  }, [groupCode, mode, participants.length, sessionTotalPieces]);

  useEffect(() => {
    logPartyFlow('scoreboard templates load start');
    void getSessionTemplates().then((nextTemplates) => {
      logPartyFlow('scoreboard templates load complete', { count: nextTemplates.length });
      setTemplates(nextTemplates);
    });
  }, []);

  const categorized = activeMenu.items.reduce<Record<string, typeof activeMenu.items>>(
    (acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(item);
      return acc;
    },
    {},
  );

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = useCallback(
    (item: SushiItem) =>
      item.name.toLowerCase().includes(normalizedQuery) ||
      getCategoryLabel(item.category).toLowerCase().includes(normalizedQuery),
    [normalizedQuery],
  );

  // Simple mode: vertical card list with inline CountStepper
  const simpleList = useMemo(() => {
    const visible = Object.values(categorized).flatMap((items) => {
      // While searching, expand real items so specific matches surface
      // (collapsed "-any" aggregates would hide them).
      if (normalizedQuery) {
        const real = items.filter((item) => !item.id.endsWith('-any'));
        return (real.length > 0 ? real : items).filter(matchesQuery);
      }
      const anyItem = items.find((item) => item.id.endsWith('-any'));
      const collapsible = !!anyItem && items.length > 1;
      return collapsible && anyItem ? [anyItem] : items;
    });

    return visible.map((item) => {
      const isAny = item.id.endsWith('-any');
      const catItems = categorized[item.category] ?? [];
      const catTotal = catItems.reduce((s, it) => s + getCount(it.id), 0);
      const displayCount = isAny ? catTotal : getCount(item.id);
      const displayName = isAny ? getCategoryLabel(item.category) : item.name;
      const decrementTarget =
        isAny && getCount(item.id) === 0
          ? catItems.find((catItem) => getCount(catItem.id) > 0)
          : item;
      const cat = t.category(item.category);

      return (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemCardLeft}>
            <View style={styles.itemEmojiBadge}>
              <ItemSpriteIdle imageKey={item.imageKey} category={item.category} size={48} active={displayCount > 0} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{displayName}</Text>
              <View style={[styles.itemChip, { backgroundColor: t.color.surfaceAlt }]}>
                <Text style={[styles.itemChipText, { color: cat.accent }]}>
                  {getCategoryLabel(item.category)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperMinus, displayCount === 0 && styles.stepperMinusDisabled]}
              onPress={() => { if (decrementTarget) void decrement(decrementTarget.id); }}
              disabled={displayCount === 0 || !currentUserCanEditActive}
            >
              <Text style={[styles.stepperMinusText, displayCount === 0 && styles.stepperMinusTextDisabled]}>−</Text>
            </TouchableOpacity>
            <View style={[styles.stepperCount, displayCount > 0 && styles.stepperCountActive]}>
              <Text style={[styles.stepperCountText, displayCount > 0 && styles.stepperCountTextActive]}>
                {displayCount}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.stepperPlusTouchable}
              onPress={() => void increment(item.id)}
              disabled={!currentUserCanEditActive}
            >
              <LinearGradient
                colors={cat.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stepperPlus}
              >
                <Text style={styles.stepperPlusText}>+</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  }, [categorized, getCount, increment, decrement, currentUserCanEditActive, normalizedQuery, matchesQuery, styles, t]);

  // Detailed mode: sectioned list with same card+stepper UX
  const detailedList = useMemo(() => {
    return Object.entries(categorized).map(([cat, catItems]) => {
      const items = catItems.filter((item) => !item.id.endsWith('-any'));
      const baseItems = items.length > 0 ? items : catItems;
      const displayItems = normalizedQuery ? baseItems.filter(matchesQuery) : baseItems;
      if (displayItems.length === 0) return null;
      const catVisual = t.category(cat);

      return (
        <View key={cat} style={styles.detailedSection}>
          <Text style={styles.categoryHeader}>{getCategoryLabel(cat)}</Text>
          <View style={styles.itemList}>
            {displayItems.map((item) => {
              const count = getCount(item.id);
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemCardLeft}>
                    <View style={styles.itemEmojiBadge}>
                      <ItemSpriteIdle imageKey={item.imageKey} category={item.category} size={48} active={count > 0} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={[styles.itemChip, { backgroundColor: t.color.surfaceAlt }]}>
                        <Text style={[styles.itemChipText, { color: catVisual.accent }]}>
                          {getCategoryLabel(item.category)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepperMinus, count === 0 && styles.stepperMinusDisabled]}
                      onPress={() => void decrement(item.id)}
                      disabled={count === 0 || !currentUserCanEditActive}
                    >
                      <Text style={[styles.stepperMinusText, count === 0 && styles.stepperMinusTextDisabled]}>−</Text>
                    </TouchableOpacity>
                    <View style={[styles.stepperCount, count > 0 && styles.stepperCountActive]}>
                      <Text style={[styles.stepperCountText, count > 0 && styles.stepperCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.stepperPlusTouchable}
                      onPress={() => void increment(item.id)}
                      disabled={!currentUserCanEditActive}
                    >
                      <LinearGradient
                        colors={catVisual.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.stepperPlus}
                      >
                        <Text style={styles.stepperPlusText}>+</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    });
  }, [categorized, getCount, increment, decrement, currentUserCanEditActive, normalizedQuery, matchesQuery, styles, t]);

  const filteredItemCount = normalizedQuery
    ? activeMenu.items.filter((item) => !item.id.endsWith('-any') && matchesQuery(item)).length
    : activeMenu.items.length;

  const persistSession = async (flagged: boolean) => {
    if (!userProfile) {
      Alert.alert('Profile unavailable', 'Unable to load the local device profile.');
      return;
    }

    // Trip the host-submit guard so the ended-phase effect can't also fire this.
    if (mode === 'group') {
      hostSubmitRef.current = true;
    }

    setSubmitting(true);
    try {
      // Group host: broadcast phase='ended' FIRST so every guest follows into their
      // own results. Awaited before the backend submit/DO-teardown below, and delivered
      // in-order over each guest's socket, so guests reliably process 'ended' (build +
      // persist local + navigate) before the subsequent draft=null teardown resets them.
      // Skipped when the phase is ALREADY 'ended' (unanimous vote): the broadcast has
      // happened and guests are already navigating, so re-ending would be redundant.
      if (mode === 'group' && groupPhase !== 'ended') {
        await endParty();
      }

      const sessionId = await submitSession({
        ownerUid: userProfile.uid,
        mode,
        restaurantId: restaurant?.id ?? 'unknown',
        restaurantName: restaurant?.name ?? 'Unknown Restaurant',
        menuId: activeMenu.id,
        menuVersion: activeMenu.version,
        location: restaurant?.location ?? { latitude: 0, longitude: 0 },
        participants,
        flagged,
        ...(groupCode ? { groupCode } : {}),
      });

      await completeSession();
      clearRestaurant();
      setShowAnomalyModal(false);
      setPendingSubmit(null);

      if (!restaurant?.id) {
        router.replace({
          pathname: '/session/restaurant-confirm',
          params: { id: sessionId, origin: 'submit' },
        });
      } else {
        router.replace({
          pathname: '/session/summary',
          params: { id: sessionId, origin: 'submit' },
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Submit failed', msg);
    } finally {
      setSubmitting(false);
    }
  };
  // Keep the ended-phase effect pointing at the freshest persistSession closure.
  persistRef.current = persistSession;

  const handleSubmit = async () => {
    if (sessionTotalPieces === 0) return;
    if (!userProfile) {
      Alert.alert('Profile unavailable', 'Unable to load the local device profile.');
      return;
    }

    if (restaurant?.id) {
      const stats = await getRestaurantStats(restaurant.id, restaurant.stats);
      if (isAnomaly(sessionTotalPieces, stats)) {
        setPendingSubmit({
          totalPieces: sessionTotalPieces,
          mean: Math.round(stats.meanPiecesPerSession),
          stdDev: Math.round(stats.stdDevPiecesPerSession),
        });
        setShowAnomalyModal(true);
        return;
      }
    }

    await persistSession(false);
  };

  const applyTemplate = async (template: SessionTemplate) => {
    if (template.restaurantId) {
      const fullRestaurant = await getRestaurant(template.restaurantId);
      setRestaurant(fullRestaurant);
    } else {
      clearRestaurant();
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel this party?',
      mode === 'group'
        ? 'This will disband the party for everyone. Nothing will be saved.'
        : 'This will end the party. Nothing will be saved.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: mode === 'group' ? 'Disband party' : 'Cancel party',
          style: 'destructive',
          onPress: () => {
            void completeSession().then(() => {
              clearRestaurant();
              router.replace('/(tabs)/home');
            });
          },
        },
      ],
    );
  };

  const handleReset = () => {
    if (sessionTotalPieces === 0) {
      void reset();
      return;
    }
    Alert.alert(
      'Reset all counts?',
      'This will clear every count for this party. This cannot be undone.',
      [
        { text: 'Keep counts', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => void reset(),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />

      {/* Header: back | center */}
      <View style={styles.header}>
        <BackButton onPress={handleCancel} disabled={submitting} />
        <TouchableOpacity style={styles.headerCenter} onPress={() => router.push('/restaurant/picker')}>
          <Text style={styles.headerRestaurant} numberOfLines={1}>
            {restaurant?.name ?? 'Choose restaurant'}
          </Text>
          <Text style={styles.headerTitle}>Sushi Party</Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      {/* Plate card: running tally + participant avatars */}
      <View style={styles.tallySection}>
        <View style={styles.tallyCard}>
          <View>
            <Text style={styles.tallyEyebrow}>Running tally</Text>
            <View style={styles.tallyNumRow}>
              <Animated.Text style={[styles.tallyNum, tallyStyle]}>{sessionTotalPieces}</Animated.Text>
              <Text style={styles.tallyUnit}>pieces</Text>
            </View>
          </View>
          <View style={styles.avatarStack}>
            {participants.slice(0, 3).map((p, i) => (
              <View
                key={p.userId}
                style={[
                  styles.avatarBubble,
                  i > 0 && styles.avatarOverlap,
                  i === 0 && styles.avatarFirst,
                ]}
              >
                <Avatar value={p.avatar} size={30} />
              </View>
            ))}
            {participants.length > 3 && (
              <View style={[styles.avatarBubble, styles.avatarOverlap, styles.avatarExtraBubble]}>
                <Text style={styles.avatarExtraText}>+{participants.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Segmented control */}
      <View style={styles.modeBar}>
        <View style={styles.modePill}>
          <Pressable
            style={[styles.modeBtn, scoreboardMode === 'simple' && styles.modeBtnActive]}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => {
              if (scoreboardMode !== 'simple') {
                setScoreboardMode('simple');
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: scoreboardMode === 'simple' }}
          >
            <Text style={[styles.modeBtnText, scoreboardMode === 'simple' && styles.modeBtnTextActive]}>
              Simple
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, scoreboardMode === 'detailed' && styles.modeBtnActive]}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => {
              if (scoreboardMode !== 'detailed') {
                setScoreboardMode('detailed');
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: scoreboardMode === 'detailed' }}
          >
            <Text style={[styles.modeBtnText, scoreboardMode === 'detailed' && styles.modeBtnTextActive]}>
              Detailed
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Templates */}
      {templates.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templateStrip}
        >
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={styles.templateChip}
              onPress={() => void applyTemplate(template)}
            >
              <Text style={styles.templateChipTitle}>{template.name}</Text>
              <Text style={styles.templateChipMeta}>
                {template.restaurantName ?? 'Any restaurant'} • {template.mode}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Player bar (group mode) */}
      {(mode === 'group' || participants.length > 1) && (
        <View style={styles.participantBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.participantTrack}
          >
            {participants.map((participant, index) => {
              const participantTotal = Object.values(participant.counts).reduce(
                (sum, count) => sum + count,
                0,
              );
              return (
                <TouchableOpacity
                  key={participant.userId}
                  style={[
                    styles.participantItem,
                    index === activeParticipantIndex && styles.participantItemActive,
                  ]}
                  onPress={() => setActiveParticipantIndex(index)}
                >
                  <Text
                    style={[
                      styles.participantName,
                      index === activeParticipantIndex && styles.participantNameActive,
                    ]}
                  >
                    {participant.displayName}
                  </Text>
                  <View
                    style={[
                      styles.participantScore,
                      index === activeParticipantIndex && styles.participantScoreActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.participantTotal,
                        index === activeParticipantIndex && styles.participantTotalActive,
                      ]}
                    >
                      {participantTotal}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* View-only banner */}
      {mode === 'group' && !currentUserCanEditActive && (
        <View style={styles.viewOnlyBanner}>
          <Text style={styles.viewOnlyText}>
            You can view teammates live, but only edit your own counts.
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Svg width={16} height={16} viewBox="0 0 24 24" style={styles.searchIcon}>
            <Path
              fill={t.color.textTertiary}
              d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
            />
          </Svg>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search what you're eating"
            placeholderTextColor={t.color.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
            underlineColorAndroid="transparent"
            accessibilityLabel="Search menu items"
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.searchClear}
              onPress={() => setQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Svg width={10} height={10} viewBox="0 0 24 24">
                <Path
                  fill={t.color.textSecondary}
                  d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
                />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Item list / grid */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {scoreboardMode === 'simple' ? (
          <View style={styles.itemList}>{simpleList}</View>
        ) : (
          <View>{detailedList}</View>
        )}
        {normalizedQuery.length > 0 && filteredItemCount === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>
              Nothing on this menu matches “{query.trim()}”.
            </Text>
          </View>
        )}
        <View style={{ height: FOOTER_CLEARANCE + insets.bottom }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        {canToggle && !voteActive && (
          <TouchableOpacity
            style={styles.menuToggle}
            onPress={() => setUseGlobalMenu(!useGlobalMenu)}
          >
            <Text style={styles.menuToggleText}>
              {useGlobalMenu ? 'Restaurant menu' : 'Global menu'}
            </Text>
          </TouchableOpacity>
        )}

        {/* End-party vote (group) — host runs the vote; guests accept it. */}
        {voteActive && (
          <View style={styles.voteCard}>
            <Text style={styles.voteTitle}>
              {isHost ? 'Ending the party' : 'Host wants to end the party'}
            </Text>
            <Text style={styles.voteProgress}>{readyCount}/{participants.length} ready</Text>
            <View style={styles.voteChips}>
              {participants.map((p) => {
                const ready = acceptedUserIds.includes(p.userId);
                return (
                  <View
                    key={p.userId}
                    style={[styles.voteChip, ready && styles.voteChipReady]}
                  >
                    <Text style={[styles.voteChipText, ready && styles.voteChipTextReady]}>
                      {ready ? '✓ ' : ''}{p.displayName}
                    </Text>
                  </View>
                );
              })}
            </View>
            {isHost ? (
              <View style={styles.voteActions}>
                <TouchableOpacity
                  style={styles.voteSecondary}
                  onPress={() => void cancelEndVote()}
                  disabled={submitting}
                >
                  <Text style={styles.voteSecondaryText}>Cancel vote</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.votePrimary}
                  onPress={() => void handleSubmit()}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color={t.color.onAccent} />
                  ) : (
                    <Text style={styles.votePrimaryText}>End now</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : currentUserAccepted ? (
              <View style={styles.voteReadyPill}>
                <Text style={styles.voteReadyPillText}>You're ready ✓</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.voteAcceptBtn}
                onPress={() => void acceptEndVote()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={t.color.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.voteAcceptInner}
                >
                  <Text style={styles.voteAcceptText}>I'm ready</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleReset}
            disabled={submitting}
          >
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          {/* Solo: submit directly. Group host (no open vote): start the end vote.
              Group guests / host mid-vote: no primary button — they use the vote card. */}
          {(mode !== 'group' || (isHost && !voteActive)) && (
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (sessionTotalPieces === 0 || submitting) && styles.submitBtnDisabled,
              ]}
              disabled={sessionTotalPieces === 0 || submitting}
              onPress={() => {
                if (mode === 'group' && isHost) {
                  void startEndVote();
                } else {
                  void handleSubmit();
                }
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={(sessionTotalPieces === 0 || submitting) ? [t.color.surfaceAlt, t.color.surfaceAlt] : t.color.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtnInner}
              >
                {submitting ? (
                  <ActivityIndicator color={t.color.onAccent} />
                ) : (
                  <Text style={[styles.submitBtnText, sessionTotalPieces === 0 && styles.submitBtnTextDisabled]}>Party's Over!</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Anomaly modal */}
      <Modal
        visible={showAnomalyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAnomalyModal(false)}
      >
        <View style={styles.anomalyBackdrop}>
          <View style={styles.anomalyCard}>
            <Text style={styles.anomalyTitle}>That count looks unusual</Text>
            <Text style={styles.anomalyText}>
              You logged {pendingSubmit?.totalPieces ?? sessionTotalPieces} pieces at{' '}
              {restaurant?.name ?? 'this restaurant'}.
            </Text>
            <Text style={styles.anomalyText}>
              Current baseline: {pendingSubmit?.mean ?? 0} average pieces with a standard deviation of{' '}
              {pendingSubmit?.stdDev ?? 0}.
            </Text>
            <View style={styles.anomalyActions}>
              <TouchableOpacity
                style={styles.anomalySecondary}
                onPress={() => {
                  setShowAnomalyModal(false);
                  setPendingSubmit(null);
                }}
                disabled={submitting}
              >
                <Text style={styles.anomalySecondaryText}>Let me recheck</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.anomalyPrimary}
                onPress={() => void persistSession(true)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={t.color.onAccent} />
                ) : (
                  <Text style={styles.anomalyPrimaryText}>Yes, submit it</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  safe: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerRestaurant: {
    fontSize: 11,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
    marginTop: 2,
    letterSpacing: -0.2,
  },

  // ── Tally card (plate) ──────────────────────────────────
  tallySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tallyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.color.surface,
    borderRadius: t.radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  tallyEyebrow: {
    fontSize: 11,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tallyNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  tallyNum: {
    fontSize: 44,
    fontFamily: t.font.display,
    color: t.color.accent,
    letterSpacing: -1,
    lineHeight: 48,
    includeFontPadding: false,
  },
  tallyUnit: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: t.color.surface,
  },
  avatarFirst: {
    borderColor: t.color.accent,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarExtraBubble: {
    backgroundColor: t.color.surfaceAlt,
  },
  avatarExtraText: {
    fontSize: 11,
    fontFamily: t.font.bodyBold,
    color: t.color.textSecondary,
  },

  // ── Segmented control ───────────────────────────────────
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modePill: {
    flexDirection: 'row',
    backgroundColor: t.color.surfaceAlt,
    borderRadius: t.radius.pill,
    padding: 4,
    gap: 2,
  },
  modeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  modeBtnActive: {
    backgroundColor: t.color.accent,
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    letterSpacing: -0.1,
  },
  modeBtnTextActive: {
    color: t.color.onAccent,
    fontFamily: t.font.bodyBold,
  },

  // ── Templates ───────────────────────────────────────────
  templateStrip: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  templateChip: {
    minWidth: 156,
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 2,
  },
  templateChipTitle: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  templateChipMeta: {
    fontSize: 12,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },

  // ── Participants ────────────────────────────────────────
  participantBar: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: t.color.border,
  },
  participantTrack: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  participantItemActive: {
    backgroundColor: t.color.accentSoft,
    borderColor: t.color.accent,
  },
  participantScore: {
    minWidth: 30,
    minHeight: 30,
    marginLeft: 10,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor: t.color.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantScoreActive: {
    backgroundColor: t.color.surface,
  },
  participantName: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.textSecondary,
    lineHeight: 20,
  },
  participantNameActive: {
    color: t.color.onAccent,
  },
  participantTotal: {
    fontSize: 12,
    fontFamily: t.font.bodyBold,
    color: t.color.textSecondary,
    lineHeight: 16,
  },
  participantTotalActive: {
    color: t.color.accent,
  },

  // ── View-only banner ────────────────────────────────────
  viewOnlyBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: t.radius.md,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  viewOnlyText: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.amber,
  },

  // ── Search ──────────────────────────────────────────────
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  searchIcon: {
    opacity: 0.7,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    padding: 0,
    // Height + centering keeps the caret/text vertically centered on Android,
    // where TextInput otherwise adds asymmetric font padding.
    height: '100%',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surfaceAlt,
  },

  // ── Empty state ─────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    textAlign: 'center',
  },

  // ── Item list (simple mode) ─────────────────────────────
  list: {
    paddingTop: 2,
    paddingHorizontal: 16,
  },
  itemList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: t.color.surface,
    borderRadius: t.radius.md,
    paddingLeft: 14,
    paddingRight: 0,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
    overflow: 'hidden',
    minHeight: 68,
  },
  itemCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minWidth: 0,
  },
  itemEmojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: t.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color.border,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  itemName: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textPrimary,
    letterSpacing: -0.1,
  },
  itemChip: {
    alignSelf: 'flex-start',
    borderRadius: t.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemChipText: {
    fontSize: 11,
    fontFamily: t.font.bodyBold,
    letterSpacing: 0.1,
  },

  // ── CountStepper ────────────────────────────────────────
  stepper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginLeft: 'auto',
  },
  stepperMinus: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surfaceAlt,
  },
  stepperMinusDisabled: {
    backgroundColor: t.color.surfaceAlt,
    opacity: 0.5,
  },
  stepperMinusText: {
    fontSize: 22,
    fontFamily: t.font.bodyMedium,
    color: t.color.textPrimary,
    lineHeight: 24,
    includeFontPadding: false,
  },
  stepperMinusTextDisabled: {
    color: t.color.textTertiary,
  },
  stepperCount: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: t.color.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.color.border,
  },
  stepperCountActive: {
    backgroundColor: t.color.surface,
  },
  stepperCountText: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.textTertiary,
  },
  stepperCountTextActive: {
    color: t.color.textPrimary,
  },
  stepperPlusTouchable: {
    width: 52,
    alignSelf: 'stretch',
  },
  stepperPlus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPlusText: {
    fontSize: 24,
    fontFamily: t.font.bodyMedium,
    color: t.color.onAccent,
    lineHeight: 26,
    includeFontPadding: false,
  },

  // ── Detailed list ───────────────────────────────────────
  detailedSection: {
    marginBottom: 4,
  },
  categoryHeader: {
    fontSize: 11,
    fontFamily: t.font.bodyBold,
    color: t.color.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 2,
  },


  // ── Footer ──────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: t.color.surface,
    borderTopWidth: 1,
    borderTopColor: t.color.border,
    gap: 8,
  },
  menuToggle: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.accentSoft,
  },
  menuToggleText: {
    fontSize: 12,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    height: 54,
    borderRadius: t.radius.button,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.card,
  },
  resetBtnText: {
    fontSize: 15,
    color: t.color.textSecondary,
    fontFamily: t.font.bodySemibold,
  },
  submitBtn: {
    flex: 2,
    height: 54,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  submitBtnInner: {
    flex: 1,
    borderRadius: t.radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 16,
    color: t.color.onAccent,
    fontFamily: t.font.bodyBold,
    letterSpacing: -0.2,
  },
  submitBtnTextDisabled: {
    color: t.color.textTertiary,
  },

  // ── End-party vote ──────────────────────────────────────
  voteCard: {
    borderRadius: t.radius.md,
    padding: 14,
    gap: 10,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.accent,
    ...t.shadow.card,
  },
  voteTitle: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
    letterSpacing: -0.2,
  },
  voteProgress: {
    fontSize: 12,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: -4,
  },
  voteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  voteChip: {
    borderRadius: t.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  voteChipReady: {
    backgroundColor: t.color.accentSoft,
    borderColor: t.color.accent,
  },
  voteChipText: {
    fontSize: 12,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
  },
  voteChipTextReady: {
    color: t.color.accent,
  },
  voteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  voteSecondary: {
    flex: 1,
    height: 46,
    borderRadius: t.radius.button,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteSecondaryText: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
  },
  votePrimary: {
    flex: 1,
    height: 46,
    borderRadius: t.radius.button,
    backgroundColor: t.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.glow(t.color.accent),
  },
  votePrimaryText: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
    letterSpacing: -0.2,
  },
  voteAcceptBtn: {
    height: 46,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  voteAcceptInner: {
    flex: 1,
    borderRadius: t.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteAcceptText: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
    letterSpacing: -0.2,
  },
  voteReadyPill: {
    height: 46,
    borderRadius: t.radius.button,
    backgroundColor: t.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteReadyPillText: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.accent,
  },

  // ── Anomaly modal ───────────────────────────────────────
  anomalyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  anomalyCard: {
    width: '100%',
    borderRadius: t.radius.lg,
    padding: 22,
    gap: 10,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  anomalyTitle: {
    fontSize: 20,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
    letterSpacing: -0.3,
  },
  anomalyText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  anomalyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  anomalySecondary: {
    flex: 1,
    borderRadius: t.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  anomalySecondaryText: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
  },
  anomalyPrimary: {
    flex: 1,
    borderRadius: t.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: t.color.accent,
    ...t.shadow.glow(t.color.accent),
  },
  anomalyPrimaryText: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
});
