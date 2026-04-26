import React, { useEffect, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SushiTile } from '../../src/components';
import { getItemEmoji } from '../../src/lib/itemEmoji';
import { getCategoryTheme } from '../../src/lib/categoryTheme';
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
  const eatenScrollRef = useRef<ScrollView>(null);
  const activeParticipant = participants[activeParticipantIndex];
  const activeParticipantTotal = Object.values(activeParticipant?.counts ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );
  const sessionTotalPieces = participants.reduce(
    (sum, participant) =>
      sum + Object.values(participant.counts).reduce((participantSum, count) => participantSum + count, 0),
    0,
  );

  useEffect(() => {
    if (activeParticipantTotal > 0) {
      eatenScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [activeParticipantTotal]);

  useEffect(() => {
    void getSessionTemplates().then(setTemplates);
  }, []);


  // Group items by category for section display
  const categorized = activeMenu.items.reduce<Record<string, typeof activeMenu.items>>(
    (acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(item);
      return acc;
    },
    {},
  );

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
      router.push({
        pathname: '/session/summary',
        params: { id: sessionId, origin: 'submit' },
      });
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
      'Nothing will be saved.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Cancel party',
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

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Sushi Party!</Text>
          <TouchableOpacity
            style={styles.restaurantBadge}
            onPress={() => router.push('/restaurant/picker')}
          >
            <Text style={styles.restaurantBadgeText} numberOfLines={1}>
              📍 {restaurant?.name ?? 'Choose restaurant'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={submitting}>
          <Text style={styles.cancelBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeBtn, scoreboardMode === 'simple' && styles.modeBtnActive]}
          onPress={() => setScoreboardMode('simple')}
          accessibilityRole="button"
          accessibilityState={{ selected: scoreboardMode === 'simple' }}
        >
          <Text style={[styles.modeBtnText, scoreboardMode === 'simple' && styles.modeBtnTextActive]}>Simple</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, scoreboardMode === 'detailed' && styles.modeBtnActive]}
          onPress={() => setScoreboardMode('detailed')}
          accessibilityRole="button"
          accessibilityState={{ selected: scoreboardMode === 'detailed' }}
        >
          <Text style={[styles.modeBtnText, scoreboardMode === 'detailed' && styles.modeBtnTextActive]}>Detailed</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalBar}>
        {activeParticipantTotal === 0 ? (
          <Text style={styles.totalBarEmpty}>Tap a sushi to begin</Text>
        ) : (
          <ScrollView
            ref={eatenScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eatenStrip}
          >
            {activeMenu.items.flatMap((item) => {
              const count = getCount(item.id);
              if (count === 0) return [];
              const emoji = getItemEmoji(item.imageKey, item.category);
              return Array.from({ length: count }).map((_, i) => (
                <TouchableOpacity
                  key={`${item.id}-${i}`}
                  style={styles.eatenChip}
                  onPress={() => void decrement(item.id)}
                  disabled={!currentUserCanEditActive}
                >
                  <Text style={styles.eatenEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ));
            })}
          </ScrollView>
        )}
        {((mode === 'group' && groupCode) || canToggle) && (
          <View style={styles.totalBarMeta}>
            {mode === 'group' && groupCode && (
              <Text style={styles.groupCodeText}>Code {groupCode}</Text>
            )}
            {canToggle && (
              <TouchableOpacity
                style={styles.menuToggle}
                onPress={() => setUseGlobalMenu(!useGlobalMenu)}
              >
                <Text style={styles.menuToggleText}>
                  {useGlobalMenu ? 'Restaurant' : 'Global'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      {templates.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateStrip}>
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

      {mode === 'group' && !currentUserCanEditActive && (
        <View style={styles.viewOnlyBanner}>
          <Text style={styles.viewOnlyText}>
            You can view teammates live, but only edit your own counts.
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {scoreboardMode === 'simple' ? (() => {
          const visible = Object.values(categorized).flatMap((items) => {
            const anyItem = items.find((item) => item.id.endsWith('-any'));
            const collapsible = !!anyItem && items.length > 1;
            return collapsible && anyItem ? [anyItem] : items;
          });
          const cols = 3;
          const rows: typeof visible[] = [];
          for (let i = 0; i < visible.length; i += cols) {
            rows.push(visible.slice(i, i + cols));
          }
          return rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.gridRow}>
              {row.map((item) => {
                const theme = getCategoryTheme(item.category);
                const isAny = item.id.endsWith('-any');
                const catItems = categorized[item.category] ?? [];
                const catTotal = catItems.reduce((s, it) => s + getCount(it.id), 0);
                const displayCount = isAny ? catTotal : getCount(item.id);
                const displayName = isAny ? getCategoryLabel(item.category) : item.name;
                const decrementTarget =
                  isAny && getCount(item.id) === 0
                    ? catItems.find((catItem) => getCount(catItem.id) > 0)
                    : item;
                return (
                  <SushiTile
                    key={item.id}
                    name={displayName}
                    emoji={getItemEmoji(item.imageKey, item.category)}
                    count={displayCount}
                    tint={theme}
                    onIncrement={() => void increment(item.id)}
                    onDecrement={() => {
                      if (decrementTarget) void decrement(decrementTarget.id);
                    }}
                    disabled={!currentUserCanEditActive}
                  />
                );
              })}
              {row.length < cols &&
                Array.from({ length: cols - row.length }).map((_, idx) => (
                  <View key={`spacer-${idx}`} style={styles.gridSpacer} />
                ))}
            </View>
          ));
        })() : Object.entries(categorized).map(([cat, catItems]) => {
          const detailItems = catItems.filter((item) => !item.id.endsWith('-any'));
          const items = detailItems.length > 0 ? detailItems : catItems;
          const cols = 3;
          const rows: typeof items[] = [];
          for (let i = 0; i < items.length; i += cols) {
            rows.push(items.slice(i, i + cols));
          }
          return (
            <View key={cat}>
              <Text style={styles.categoryHeader}>{getCategoryLabel(cat)}</Text>
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.gridRow}>
                  {row.map((item) => {
                    const theme = getCategoryTheme(item.category);
                    return (
                      <SushiTile
                        key={item.id}
                        name={item.name}
                        emoji={getItemEmoji(item.imageKey, item.category)}
                        count={getCount(item.id)}
                        tint={theme}
                        onIncrement={() => void increment(item.id)}
                        onDecrement={() => void decrement(item.id)}
                        disabled={!currentUserCanEditActive}
                      />
                    );
                  })}
                  {row.length < cols &&
                    Array.from({ length: cols - row.length }).map((_, idx) => (
                      <View key={`spacer-${idx}`} style={styles.gridSpacer} />
                    ))}
                </View>
              ))}
            </View>
          );
        })}
        <View style={styles.listPadding} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetBtn} onPress={() => void reset()} disabled={submitting}>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Finished!</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showAnomalyModal} transparent animationType="fade" onRequestClose={() => setShowAnomalyModal(false)}>
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
                  <ActivityIndicator color="#fff" />
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#e53935',
    letterSpacing: 0.5,
  },
  headerTitleAccent: {
    fontSize: 26,
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantBadgeText: {
    fontSize: 13,
    color: '#888',
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
    lineHeight: 20,
  },
  totalBar: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    gap: 4,
  },
  totalBarEmpty: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    fontStyle: 'italic',
    lineHeight: 32,
  },
  totalBarMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eatenStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  eatenChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eatenEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  groupCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b75c57',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    padding: 6,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  modeBtnTextActive: {
    color: '#e53935',
    fontWeight: '700',
  },
  categoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#bbb',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 2,
  },
  menuToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ffeaea',
  },
  menuToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e53935',
  },
  quickStartHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  quickStartTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#aaa',
  },
  templateStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  templateChip: {
    minWidth: 156,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 4,
  },
  templateChipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },
  templateChipMeta: {
    fontSize: 12,
    color: '#777',
  },
  list: {
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridSpacer: {
    flex: 1,
  },
  participantStrip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  participantChip: {
    minWidth: 108,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 2,
  },
  participantChipActive: {
    backgroundColor: '#fff3f2',
    borderColor: '#f2b9b3',
  },
  participantName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  participantNameActive: {
    color: '#e53935',
  },
  participantTotal: {
    fontSize: 12,
    color: '#777',
  },
  participantTotalActive: {
    color: '#b75c57',
  },
  viewOnlyBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff6e7',
    borderWidth: 1,
    borderColor: '#f0d7a0',
  },
  viewOnlyText: {
    fontSize: 13,
    color: '#8b6a1d',
  },
  listPadding: {
    height: 120,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  resetBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#ffcdd2',
    shadowOpacity: 0,
  },
  submitBtnText: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  anomalyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  anomalyCard: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    gap: 10,
    backgroundColor: '#fff',
  },
  anomalyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#222',
  },
  anomalyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#666',
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
    backgroundColor: '#f5f5f5',
  },
  anomalySecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
  },
  anomalyPrimary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#e53935',
  },
  anomalyPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
