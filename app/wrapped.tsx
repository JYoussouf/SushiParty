import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackButton, WrappedCard } from '../src/components';
import { useTheme } from '../src/contexts/ThemeContext';
import type { Theme } from '../src/theme/themes';
import { useAuth } from '../src/contexts/AuthContext';
import { getAllSessions } from '../src/lib/cloudflare/sessions';
import { buildWrappedStats, buildWrappedShareText, EMPTY_WRAPPED_STATS, type WrappedStats } from '../src/lib/wrappedStats';
import { shareCardImage, copyCardImage, copyCardText } from '../src/lib/shareCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);

export default function WrappedScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile } = useAuth();
  const cardRef = useRef<View>(null);
  const [stats, setStats] = useState<WrappedStats>(EMPTY_WRAPPED_STATS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'share' | 'copy'>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userProfile) {
      setStats(EMPTY_WRAPPED_STATS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sessions = await getAllSessions();
      setStats(buildWrappedStats(sessions, userProfile.uid));
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleShare = async () => {
    setBusy('share');
    try {
      const result = await shareCardImage(cardRef);
      if (result === 'unavailable') {
        // No share sheet (rare) — copy the text summary instead.
        await copyCardText(buildWrappedShareText(stats, userProfile?.displayName ?? 'I'));
        flash('Sharing unavailable — summary copied');
      } else if (result === 'error') {
        flash("Couldn't share — try again");
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    setBusy('copy');
    try {
      const ok = await copyCardImage(cardRef);
      if (ok) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        flash('Card copied to clipboard');
      } else {
        const textOk = await copyCardText(buildWrappedShareText(stats, userProfile?.displayName ?? 'I'));
        flash(textOk ? 'Summary copied to clipboard' : "Couldn't copy");
      }
    } finally {
      setBusy(null);
    }
  };

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
        ) : !stats.hasData ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No Wrapped yet</Text>
            <Text style={styles.emptyText}>
              Log a few parties and your shareable Sushi Wrapped will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Your Sushi Wrapped</Text>
            <Text style={styles.subtitle}>Share it to your story or copy the card.</Text>

            <View style={styles.cardShadow}>
              <WrappedCard
                ref={cardRef}
                stats={stats}
                displayName={userProfile?.displayName ?? 'You'}
                avatar={userProfile?.avatar}
                width={CARD_WIDTH}
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.shareBtnShadow}
                activeOpacity={0.85}
                disabled={busy !== null}
                onPress={() => void handleShare()}
              >
                <LinearGradient
                  colors={t.color.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shareBtn}
                >
                  {busy === 'share' ? (
                    <ActivityIndicator color={t.color.onAccent} />
                  ) : (
                    <Text style={styles.shareBtnText}>Share to Instagram, Snapchat & more</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.copyBtn}
                activeOpacity={0.85}
                disabled={busy !== null}
                onPress={() => void handleCopy()}
              >
                {busy === 'copy' ? (
                  <ActivityIndicator color={t.color.accent} />
                ) : (
                  <Text style={styles.copyBtnText}>Copy card</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle: { fontSize: 22, fontFamily: t.font.display, color: t.color.textPrimary },
    emptyText: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: t.font.body,
      color: t.color.textSecondary,
      textAlign: 'center',
    },
    scroll: { padding: 24, alignItems: 'center', gap: 8, paddingBottom: 48 },
    title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary, textAlign: 'center' },
    subtitle: {
      fontSize: 15,
      fontFamily: t.font.body,
      color: t.color.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    cardShadow: { borderRadius: 28, ...t.shadow.card },
    actions: { width: '100%', marginTop: 24, gap: 12 },
    shareBtnShadow: { borderRadius: t.radius.button, ...t.shadow.glow(t.color.accent) },
    shareBtn: {
      height: 54,
      borderRadius: t.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    shareBtnText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
    copyBtn: {
      height: 52,
      borderRadius: t.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.color.surface,
      borderWidth: 1.5,
      borderColor: t.color.border,
    },
    copyBtnText: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.accent },
    toast: {
      position: 'absolute',
      bottom: 40,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: t.radius.pill,
      backgroundColor: t.color.surfaceAlt,
      borderWidth: 1,
      borderColor: t.color.border,
    },
    toastText: { fontSize: 14, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
  });
