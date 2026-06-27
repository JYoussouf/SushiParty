import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useSession } from '../../src/hooks/useSession';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

export default function SessionModeScreen() {
  const router = useRouter();
  const { setMode, createGroup } = useSession();
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <View style={styles.navBar}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Start a Sushi Party</Text>
          <Text style={styles.title}>Pick the vibe</Text>
          <Text style={styles.subtitle}>
            Go solo if it's just you, or open a lobby so friends can pile in with a code.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.choiceCard, creatingGroup && { opacity: 0.6 }]}
          disabled={creatingGroup}
          onPress={() => {
            setCreatingGroup(true);
            setCreateGroupError(null);
            createGroup()
              .then(() => {
                router.push('/session/lobby');
              })
              .catch((err: unknown) => {
                setCreateGroupError(err instanceof Error ? err.message : 'Failed to create group.');
              })
              .finally(() => setCreatingGroup(false));
          }}
        >
          <Text style={styles.choiceEmoji}>🎉</Text>
          <View style={styles.choiceBody}>
            <Text style={styles.choiceTitle}>
              {creatingGroup ? 'Creating…' : 'Party with Friends'}
            </Text>
            <Text style={styles.choiceText}>
              Open the lobby, share the code, swap cat avatars, and head to the scoreboard together.
            </Text>
          </View>
        </TouchableOpacity>

        {createGroupError ? (
          <Text style={styles.errorText}>{createGroupError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.choiceCard, styles.choiceCardSolo]}
          onPress={() => {
            logPartyFlow('solo start pressed');
            void setMode('single').then(() => {
              logPartyFlow('solo setMode complete, replace party-intro');
              router.replace('/session/party-intro');
            });
          }}
        >
          <Text style={styles.choiceEmoji}>🍣</Text>
          <View style={styles.choiceBody}>
            <Text style={styles.choiceTitle}>Solo Party</Text>
            <Text style={styles.choiceText}>
              Skip the lobby and jump straight into counting for a one-person sushi run.
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  navBar: { paddingHorizontal: 16, paddingVertical: 8 },
  scroll: { padding: 20, gap: 18, paddingBottom: 30 },
  hero: {
    borderRadius: t.radius.lg,
    padding: 22,
    gap: 8,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: t.font.bodyBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: t.color.accent,
  },
  title: { fontSize: 30, lineHeight: 34, fontFamily: t.font.display, color: t.color.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: t.radius.lg,
    padding: 18,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  choiceCardSolo: {
    backgroundColor: t.color.surfaceAlt,
  },
  choiceEmoji: { fontSize: 34 },
  choiceBody: { flex: 1, gap: 4 },
  choiceTitle: { fontSize: 18, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  choiceText: { fontSize: 14, lineHeight: 20, fontFamily: t.font.body, color: t.color.textSecondary },
  errorText: { fontSize: 14, fontFamily: t.font.bodyMedium, color: t.color.danger, textAlign: 'center' },
});
