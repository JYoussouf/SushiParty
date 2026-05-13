import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { getItemEmoji } from '../../src/lib/itemEmoji';
import { getCategoryLabel } from '../../src/lib/categoryLabels';
import { useSession } from '../../src/hooks/useSession';
import { useMenu } from '../../src/hooks/useMenu';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRestaurant } from '../../src/contexts/RestaurantContext';
import { submitSession } from '../../src/lib/cloudflare/sessions';
import { getRestaurantStats } from '../../src/lib/local/restaurantStats';
import { getRestaurant } from '../../src/lib/cloudflare/restaurants';
import { getSessionTemplates } from '../../src/lib/local/templates';
import { isAnomaly } from '../../src/lib/stats/anomalyDetection';
import type { SessionTemplate } from '../../src/types';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

function getCategoryChipColors(category: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    nigiri:  { bg: '#ffe5e0', text: '#b3372d' },
    sashimi: { bg: '#fbe0e0', text: '#7a1a1a' },
    maki:    { bg: '#ffeed6', text: '#8a4a14' },
    roll:    { bg: '#dbeaf5', text: '#1d5582' },
    side:    { bg: '#ecf3d4', text: '#4d6b1c' },
    hot:     { bg: '#ffeed6', text: '#8a4a14' },
    soup:    { bg: '#ffeed6', text: '#8a4a14' },
  };
  return map[category.toLowerCase()] ?? { bg: 'rgba(40,22,12,0.07)', text: '#4a3624' };
}

export default function ScoreboardScreen() {
  const router = useRouter();
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
    currentUserCanEditActive,
    completeSession,
  } = useSession();
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
  const scrollRef = useRef<ScrollView>(null);
  const tallyScale = useSharedValue(1);
  const tallyStyle = useAnimatedStyle(() => ({ transform: [{ scale: tallyScale.value }] }));
  const tabIndicatorX = useSharedValue(0);
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorX.value }],
  }));

  const sessionTotalPieces = participants.reduce(
    (sum, participant) =>
      sum + Object.values(participant.counts).reduce((participantSum, count) => participantSum + count, 0),
    0,
  );

  useEffect(() => {
    logPartyFlow('scoreboard mounted');
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

  // Simple mode: vertical card list with inline CountStepper
  const simpleList = useMemo(() => {
    const visible = Object.values(categorized).flatMap((items) => {
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
      const emoji = getItemEmoji(item.imageKey, item.category);
      const chip = getCategoryChipColors(item.category);

      return (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemEmojiBadge}>
            <Text style={styles.itemEmojiText}>{emoji}</Text>
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{displayName}</Text>
            <View style={[styles.itemChip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.itemChipText, { color: chip.text }]}>
                {getCategoryLabel(item.category)}
              </Text>
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
              style={styles.stepperPlus}
              onPress={() => void increment(item.id)}
              disabled={!currentUserCanEditActive}
            >
              <Text style={styles.stepperPlusText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  }, [categorized, getCount, increment, decrement, currentUserCanEditActive]);

  // Detailed mode: sectioned list with same card+stepper UX
  const detailedList = useMemo(() => {
    return Object.entries(categorized).map(([cat, catItems]) => {
      const items = catItems.filter((item) => !item.id.endsWith('-any'));
      const displayItems = items.length > 0 ? items : catItems;
      const chip = getCategoryChipColors(cat);

      return (
        <View key={cat} style={styles.detailedSection}>
          <Text style={styles.categoryHeader}>{getCategoryLabel(cat)}</Text>
          <View style={styles.itemList}>
            {displayItems.map((item) => {
              const count = getCount(item.id);
              const emoji = getItemEmoji(item.imageKey, item.category);
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemEmojiBadge}>
                    <Text style={styles.itemEmojiText}>{emoji}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={[styles.itemChip, { backgroundColor: chip.bg }]}>
                      <Text style={[styles.itemChipText, { color: chip.text }]}>
                        {getCategoryLabel(item.category)}
                      </Text>
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
                      style={styles.stepperPlus}
                      onPress={() => void increment(item.id)}
                      disabled={!currentUserCanEditActive}
                    >
                      <Text style={styles.stepperPlusText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    });
  }, [categorized, getCount, increment, decrement, currentUserCanEditActive]);

  const persistSession = async (flagged: boolean) => {
    if (!userProfile) {
      Alert.alert('Profile unavailable', 'Unable to load the local device profile.');
      return;
    }

    setSubmitting(true);
    try {
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header: back | center | menu */}
      <View style={styles.header}>
        <BackButton onPress={handleCancel} disabled={submitting} />
        <TouchableOpacity style={styles.headerCenter} onPress={() => router.push('/restaurant/picker')}>
          <Text style={styles.headerRestaurant} numberOfLines={1}>
            {restaurant?.name ?? 'Choose restaurant'}
          </Text>
          <Text style={styles.headerTitle}>Sushi Party</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={handleCancel} disabled={submitting}>
          <Text style={styles.headerBtnIcon}>···</Text>
        </TouchableOpacity>
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
                <Text style={styles.avatarBubbleEmoji}>{p.avatar ?? '🐱'}</Text>
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
        <View
          style={styles.modePill}
          onLayout={(e) => {
            const w = (e.nativeEvent.layout.width - 8) / 2;
            setTabWidth(w);
            tabIndicatorX.value = scoreboardMode === 'detailed' ? w + 2 : 0;
          }}
        >
          {tabWidth > 0 && (
            <Animated.View style={[styles.modeBtnActive, styles.modeIndicator, { width: tabWidth }, indicatorStyle]} />
          )}
          <TouchableOpacity
            style={[styles.modeBtn, { flex: 1 }]}
            onPress={() => {
              setScoreboardMode('simple');
              tabIndicatorX.value = withSpring(0, { damping: 20, stiffness: 260 });
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: scoreboardMode === 'simple' }}
          >
            <Text style={[styles.modeBtnText, scoreboardMode === 'simple' && styles.modeBtnTextActive]}>
              Simple
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, { flex: 1 }]}
            onPress={() => {
              setScoreboardMode('detailed');
              tabIndicatorX.value = withSpring(tabWidth + 2, { damping: 20, stiffness: 260 });
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: scoreboardMode === 'detailed' }}
          >
            <Text style={[styles.modeBtnText, scoreboardMode === 'detailed' && styles.modeBtnTextActive]}>
              Detailed
            </Text>
          </TouchableOpacity>
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

      {/* Participant switcher (group mode) */}
      {(mode === 'group' || participants.length > 1) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.participantStrip}
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
                  styles.participantChip,
                  index === activeParticipantIndex && styles.participantChipActive,
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
                <Text
                  style={[
                    styles.participantTotal,
                    index === activeParticipantIndex && styles.participantTotalActive,
                  ]}
                >
                  {participantTotal} pcs
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* View-only banner */}
      {mode === 'group' && !currentUserCanEditActive && (
        <View style={styles.viewOnlyBanner}>
          <Text style={styles.viewOnlyText}>
            You can view teammates live, but only edit your own counts.
          </Text>
        </View>
      )}

      {/* Item list / grid */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {scoreboardMode === 'simple' ? (
          <View style={styles.itemList}>{simpleList}</View>
        ) : (
          <View>{detailedList}</View>
        )}
        <View style={styles.listPadding} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {canToggle && (
          <TouchableOpacity
            style={styles.menuToggle}
            onPress={() => setUseGlobalMenu(!useGlobalMenu)}
          >
            <Text style={styles.menuToggleText}>
              {useGlobalMenu ? 'Restaurant menu' : 'Global menu'}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => void reset()}
            disabled={submitting}
          >
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (sessionTotalPieces === 0 || submitting) && styles.submitBtnDisabled,
            ]}
            disabled={sessionTotalPieces === 0 || submitting}
            onPress={() => void handleSubmit()}
          >
            {submitting ? (
              <ActivityIndicator color="#fffaf2" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Party's Over!</Text>
              </>
            )}
          </TouchableOpacity>
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
                  <ActivityIndicator color="#fffaf2" />
                ) : (
                  <Text style={styles.anomalyPrimaryText}>Yes, submit it</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf2',
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(40,22,12,0.07)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28160c',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  headerBtnIcon: {
    fontSize: 20,
    color: '#7a6452',
    fontWeight: '500',
    lineHeight: 22,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerRestaurant: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7a6452',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#21160d',
    marginTop: 2,
    letterSpacing: -0.2,
  },

  // ── Tally card (plate) ──────────────────────────────────
  tallySection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tallyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fdf3e3',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.06)',
    shadowColor: '#28160c',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  tallyEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7a6452',
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
    fontWeight: '700',
    color: '#21160d',
    letterSpacing: -1,
    lineHeight: 48,
    includeFontPadding: false,
  },
  tallyUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7a6452',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f7e9d2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fdf3e3',
  },
  avatarFirst: {
    borderColor: '#ee5d52',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarBubbleEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  avatarExtraBubble: {
    backgroundColor: '#ffffff',
  },
  avatarExtraText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a3624',
  },

  // ── Segmented control ───────────────────────────────────
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(40,22,12,0.06)',
    borderRadius: 999,
    padding: 4,
    gap: 2,
  },
  modeIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 999,
    zIndex: 0,
  },
  modeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  modeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#28160c',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7a6452',
    letterSpacing: -0.1,
  },
  modeBtnTextActive: {
    color: '#21160d',
    fontWeight: '700',
  },

  // ── Templates ───────────────────────────────────────────
  templateStrip: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  templateChip: {
    minWidth: 156,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.08)',
    gap: 2,
  },
  templateChipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#21160d',
  },
  templateChipMeta: {
    fontSize: 12,
    color: '#7a6452',
  },

  // ── Participants ────────────────────────────────────────
  participantStrip: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  participantChip: {
    minWidth: 108,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.10)',
    gap: 2,
    justifyContent: 'center',
    shadowColor: '#28160c',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  participantChipActive: {
    backgroundColor: '#ffe5e0',
    borderColor: '#ee5d52',
  },
  participantName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3624',
    lineHeight: 18,
    includeFontPadding: false,
  },
  participantNameActive: {
    color: '#b3372d',
  },
  participantTotal: {
    fontSize: 12,
    color: '#7a6452',
    lineHeight: 16,
    includeFontPadding: false,
  },
  participantTotalActive: {
    color: '#ee5d52',
  },

  // ── View-only banner ────────────────────────────────────
  viewOnlyBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#ffeed6',
    borderWidth: 1,
    borderColor: 'rgba(243,176,107,0.4)',
  },
  viewOnlyText: {
    fontSize: 13,
    color: '#8a4a14',
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
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.06)',
    shadowColor: '#28160c',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemEmojiBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fdf3e3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.07)',
  },
  itemEmojiText: {
    fontSize: 22,
    lineHeight: 26,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#21160d',
    letterSpacing: -0.1,
  },
  itemChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // ── CountStepper ────────────────────────────────────────
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperMinus: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#fbf6ee',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperMinusDisabled: {
    backgroundColor: 'rgba(40,22,12,0.05)',
    borderColor: 'transparent',
  },
  stepperMinusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4a3624',
    lineHeight: 22,
    includeFontPadding: false,
  },
  stepperMinusTextDisabled: {
    color: '#ad9886',
  },
  stepperCount: {
    minWidth: 36,
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(40,22,12,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCountActive: {
    backgroundColor: '#ee5d52',
    shadowColor: '#ee5d52',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepperCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7a6452',
  },
  stepperCountTextActive: {
    color: '#fffaf2',
  },
  stepperPlus: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#ee5d52',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ee5d52',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepperPlusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fffaf2',
    lineHeight: 22,
    includeFontPadding: false,
  },

  // ── Detailed list ───────────────────────────────────────
  detailedSection: {
    marginBottom: 4,
  },
  categoryHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ad9886',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 2,
  },


  listPadding: {
    height: 130,
  },

  // ── Footer ──────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    backgroundColor: 'rgba(255,250,242,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(40,22,12,0.07)',
    gap: 8,
  },
  menuToggle: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ffe5e0',
  },
  menuToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b3372d',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28160c',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  resetBtnText: {
    fontSize: 15,
    color: '#4a3624',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#2a1a10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#28160c',
    shadowOpacity: 0.40,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(40,22,12,0.20)',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnCheck: {
    fontSize: 16,
    color: '#fffaf2',
    fontWeight: '700',
  },
  submitBtnText: {
    fontSize: 16,
    color: '#fffaf2',
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // ── Anomaly modal ───────────────────────────────────────
  anomalyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(40,22,12,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  anomalyCard: {
    width: '100%',
    borderRadius: 28,
    padding: 22,
    gap: 10,
    backgroundColor: '#fffaf2',
    shadowColor: '#28160c',
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  anomalyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#21160d',
    letterSpacing: -0.3,
  },
  anomalyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#7a6452',
  },
  anomalyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  anomalySecondary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.12)',
  },
  anomalySecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a3624',
  },
  anomalyPrimary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ee5d52',
    shadowColor: '#ee5d52',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  anomalyPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fffaf2',
  },
});
