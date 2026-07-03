import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { calculateUserProfileStats, type UserProfileStats } from '../../src/lib/profileStats';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';

// The catch-all tally items are named "Any Roll", "Any Nigiri", etc. Drop the
// leading "Any" so the most-ordered item reads as a real category ("Roll").
function stripAny(name: string): string {
  return name.replace(/^any\s+/i, '').trim();
}

export default function SushiStatsScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<UserProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!userProfile) {
        setStats(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sessions = await getAllSessions();
        setStats(calculateUserProfileStats(sessions, userProfile.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  const mostOrdered = stats?.mostOrderedItem ? stripAny(stats.mostOrderedItem) : null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={t.color.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Sushi Stats</Text>
            <Text style={styles.subtitle}>Your lifetime sushi totals.</Text>
            {!stats || stats.totalSessions === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Finish a party and your lifetime stats will show up here.</Text>
              </View>
            ) : (
              <>
                <StatBlock label="Lifetime pieces" value={stats.totalPieces.toLocaleString()} styles={styles} />
                <StatBlock
                  label="Most ordered item"
                  value={mostOrdered ?? '-'}
                  note={mostOrdered ? `${stats.mostOrderedItemCount.toLocaleString()} pieces` : undefined}
                  styles={styles}
                />
                <StatBlock
                  label="Most visited restaurant"
                  value={stats.favoriteRestaurant ?? '-'}
                  note={
                    stats.favoriteRestaurant
                      ? `${stats.favoriteRestaurantVisits} visit${stats.favoriteRestaurantVisits === 1 ? '' : 's'}`
                      : undefined
                  }
                  styles={styles}
                />
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function StatBlock({
  label,
  value,
  note,
  styles,
}: {
  label: string;
  value: string;
  note?: string | undefined;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue} numberOfLines={2}>
        {value}
      </Text>
      {note ? <Text style={styles.cardNote}>{note}</Text> : null}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, gap: 14 },
    title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
    subtitle: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary, marginBottom: 6 },
    emptyCard: {
      borderRadius: t.radius.md,
      padding: 18,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
    },
    emptyText: { fontSize: 14, lineHeight: 21, fontFamily: t.font.body, color: t.color.textSecondary },
    card: {
      borderRadius: t.radius.lg,
      padding: 18,
      gap: 4,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      ...t.shadow.card,
    },
    cardLabel: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase' },
    cardValue: { fontSize: 30, lineHeight: 36, fontFamily: t.font.display, color: t.color.textPrimary },
    cardNote: { fontSize: 14, fontFamily: t.font.bodySemibold, color: t.color.textSecondary },
  });
