import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useSession } from '../../src/hooks/useSession';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

export default function SessionModeScreen() {
  const router = useRouter();
  const { setMode, createGroup } = useSession();
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff5ec' },
  navBar: { paddingHorizontal: 16, paddingVertical: 8 },
  scroll: { padding: 20, gap: 18, paddingBottom: 30 },
  hero: {
    borderRadius: 28,
    padding: 22,
    gap: 8,
    backgroundColor: '#ffe4d1',
    borderWidth: 1,
    borderColor: '#f5c6aa',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#c46738',
  },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: '#2d2019' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6f594d' },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  choiceCardSolo: {
    backgroundColor: '#fff7f0',
  },
  choiceEmoji: { fontSize: 34 },
  choiceBody: { flex: 1, gap: 4 },
  choiceTitle: { fontSize: 18, fontWeight: '900', color: '#2d2019' },
  choiceText: { fontSize: 14, lineHeight: 20, color: '#7f695d' },
  errorText: { fontSize: 14, color: '#c0392b', textAlign: 'center' },
});
