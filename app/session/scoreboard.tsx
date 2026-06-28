import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
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
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { getItemEmoji } from '../../src/lib/itemEmoji';
import { getCategoryLabel } from '../../src/lib/categoryLabels';
import { useSession } from '../../src/hooks/useSession';
import { useMenu } from '../../src/hooks/useMenu';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRestaurant } from '../../src/contexts/RestaurantContext';
import { submitSession } from '../../src/lib/cloudflare/sessions';
import { prepareInterstitial } from '../../src/lib/ads';
import { getRestaurantStats } from '../../src/lib/local/restaurantStats';
import { getRestaurant } from '../../src/lib/cloudflare/restaurants';
import { getSessionTemplates } from '../../src/lib/local/templates';
import { isAnomaly } from '../../src/lib/stats/anomalyDetection';
import type { SessionTemplate } from '../../src/types';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

export default function ScoreboardScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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

  const sessionTotalPieces = participants.reduce(
    (sum, participant) =>
      sum + Object.values(participant.counts).reduce((participantSum, count) => participantSum + count, 0),
    0,
  );

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
      const cat = t.category(item.category);

      return (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemCardLeft}>
            <View style={styles.itemEmojiBadge}>
              <Text style={styles.itemEmojiText}>{emoji}</Text>
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
  }, [categorized, getCount, increment, decrement, currentUserCanEditActive, styles, t]);

  // Detailed mode: sectioned list with same card+stepper UX
  const detailedList = useMemo(() => {
    return Object.entries(categorized).map(([cat, catItems]) => {
      const items = catItems.filter((item) => !item.id.endsWith('-any'));
      const displayItems = items.length > 0 ? items : catItems;
      const catVisual = t.category(cat);

      return (
        <View key={cat} style={styles.detailedSection}>
          <Text style={styles.categoryHeader}>{getCategoryLabel(cat)}</Text>
          <View style={styles.itemList}>
            {displayItems.map((item) => {
              const count = getCount(item.id);
              const emoji = getItemEmoji(item.imageKey, item.category);
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemCardLeft}>
                    <View style={styles.itemEmojiBadge}>
                      <Text style={styles.itemEmojiText}>{emoji}</Text>
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
  }, [categorized, getCount, increment, decrement, currentUserCanEditActive, styles, t]);

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
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
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
        <View style={styles.modePill}>
          <Pressable
            style={[styles.modeBtn, scoreboardMode === 'simple' && styles.modeBtnActive]}
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
      </SafeAreaView>
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
    paddingTop: 12,
    paddingBottom: 4,
  },
  tallyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.color.surface,
    borderRadius: t.radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 18,
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
  avatarBubbleEmoji: {
    fontSize: 18,
    lineHeight: 22,
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
    paddingVertical: 10,
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
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color.border,
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
  stepperPlus: {
    width: 52,
    alignSelf: 'stretch',
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
