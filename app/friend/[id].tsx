import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { getFriendById, getFriendSessions } from '../../src/lib/local/friends';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import { getSessionTotalPieces } from '../../src/lib/sessionSummary';
import { calculateUserProfileStats } from '../../src/lib/profileStats';
import { buildFriendComparison, type FriendComparison } from '../../src/lib/friendCompare';
import type { SushiSession, User } from '../../src/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function FriendProfileScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const params = useLocalSearchParams<{ id?: string }>();
  const { userProfile } = useAuth();
  const [friend, setFriend] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SushiSession[]>([]);
  const [comparison, setComparison] = useState<FriendComparison | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const id = typeof params.id === 'string' ? params.id : '';
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [friendProfile, friendSessions, mySessions] = await Promise.all([
        getFriendById(id),
        getFriendSessions(id),
        getAllSessions(),
      ]);
      setFriend(friendProfile);
      setSessions(friendSessions);

      if (userProfile) {
        const myStats = calculateUserProfileStats(mySessions, userProfile.uid);
        const friendStats = calculateUserProfileStats(friendSessions, id);
        setComparison(
          buildFriendComparison(myStats, friendStats, friendProfile?.displayName ?? 'Them'),
        );
      } else {
        setComparison(null);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id, userProfile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <StatusBar style={t.isDark ? 'light' : 'dark'} />
          <View style={styles.header}>
            <BackButton onPress={() => router.back()} />
          </View>
          <View style={styles.stateCenter}>
            <ActivityIndicator size="large" color={t.color.accent} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!friend) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <StatusBar style={t.isDark ? 'light' : 'dark'} />
          <View style={styles.header}>
            <BackButton onPress={() => router.back()} />
          </View>
          <View style={styles.stateCenter}>
            <Text style={styles.emptyTitle}>This friend isn&apos;t available</Text>
            <Text style={styles.emptyText}>They may have been removed from your local friends.</Text>
            <TouchableOpacity style={styles.stateButton} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={styles.stateButtonText}>Back to Friends</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(friend.displayName)}</Text>
          </View>
          <Text style={styles.name}>{friend.displayName}</Text>
          <Text style={styles.username}>@{friend.username}</Text>
          <Text style={styles.heroMeta}>{sessions.length} recent parties in local social mode</Text>
        </View>

        {comparison && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>You vs {friend.displayName.split(' ')[0]}</Text>
            <View style={styles.compareCard}>
              <Text style={styles.compareHeadline}>{comparison.headline}</Text>
              <View style={styles.compareLegendRow}>
                <Text style={[styles.compareLegend, styles.compareLegendYou]}>You</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.compareLegend, styles.compareLegendFriend]}>
                  {friend.displayName.split(' ')[0]}
                </Text>
              </View>
              {comparison.rows.map((row) => (
                <View key={row.label} style={styles.compareRow}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    style={[
                      styles.compareValue,
                      styles.compareValueLeft,
                      row.leader === 'you' && styles.compareValueLead,
                    ]}
                  >
                    {row.youValue.toLocaleString()}
                  </Text>
                  <Text style={styles.compareLabel}>{row.label}</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    style={[
                      styles.compareValue,
                      styles.compareValueRight,
                      row.leader === 'friend' && styles.compareValueLead,
                    ]}
                  >
                    {row.friendValue.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Parties</Text>
          {sessions.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                No shared parties with {friend.displayName.split(' ')[0]} yet - parties you both log
                will show up here.
              </Text>
            </View>
          )}
          {sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.restaurantName}>{session.restaurantName}</Text>
                <Text style={styles.totalPieces}>{getSessionTotalPieces(session)} pcs</Text>
              </View>
              <Text style={styles.sessionMeta}>
                {new Date(session.submittedAt ?? session.startedAt).toLocaleDateString()} •{' '}
                {session.mode}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  loadingState: {
    flex: 1,
    backgroundColor: t.color.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    borderRadius: t.radius.lg,
    padding: 24,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 6,
    ...t.shadow.card,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.accent,
    marginBottom: 6,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  name: {
    fontSize: 24,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
  },
  username: {
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  heroMeta: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textTertiary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  sessionCard: {
    borderRadius: t.radius.md,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  restaurantName: {
    flex: 1,
    fontSize: 16,
    fontFamily: t.font.bodySemibold,
    color: t.color.textPrimary,
  },
  totalPieces: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.accent,
  },
  sessionMeta: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textTertiary,
  },
  compareCard: {
    borderRadius: t.radius.lg,
    padding: 18,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 6,
    ...t.shadow.card,
  },
  compareHeadline: {
    fontSize: 16,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
    marginBottom: 4,
  },
  compareLegendRow: { flexDirection: 'row', alignItems: 'center' },
  compareLegend: { fontSize: 12, fontFamily: t.font.bodyBold, letterSpacing: 0.5, textTransform: 'uppercase' },
  compareLegendYou: { color: t.color.accent },
  compareLegendFriend: { color: t.color.cyan },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.color.border,
  },
  compareValue: {
    flex: 1,
    minWidth: 56,
    fontSize: 20,
    fontFamily: t.font.bodySemibold,
    color: t.color.textTertiary,
  },
  compareValueLeft: { textAlign: 'left' },
  compareValueRight: { textAlign: 'right' },
  compareValueLead: { color: t.color.textPrimary, fontFamily: t.font.bodyBold },
  compareLabel: {
    flexShrink: 0,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    textAlign: 'center',
  },
  stateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
    textAlign: 'center',
  },
  stateButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: t.radius.button,
    backgroundColor: t.color.accentSoft,
  },
  stateButtonText: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  emptyCard: {
    borderRadius: t.radius.md,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  emptyCardText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
});
