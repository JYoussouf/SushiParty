import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { SessionMode } from '../../src/types';
import { useSession } from '../../src/hooks/useSession';

interface ModeCard {
  mode: SessionMode;
  emoji: string;
  title: string;
  description: string;
  note?: string;
}

const MODES: ModeCard[] = [
  {
    mode: 'single',
    emoji: '👤',
    title: 'Single Phone',
    description: 'Multiple people take turns entering their own counts on one shared device.',
    note: 'Available now',
  },
  {
    mode: 'individual',
    emoji: '📱',
    title: 'Individual',
    description: 'Each friend uses their own phone to track independently. Parties are tagged to the same meal afterward.',
    note: 'Available now',
  },
  {
    mode: 'group',
    emoji: '🔗',
    title: 'Group Linked',
    description: "Multiple phones linked in real time — everyone sees everyone's counts update live.",
    note: 'Link phones',
  },
];

export default function SessionModeScreen() {
  const router = useRouter();
  const { mode, setMode } = useSession();

  const handleSelect = async (selectedMode: SessionMode) => {
    if (selectedMode === 'group') {
      router.push('/session/group-join');
      return;
    }

    await setMode(selectedMode);
    router.replace('/(tabs)/scoreboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>How are you playing?</Text>
        <Text style={styles.subheading}>Choose how to track counts for this party.</Text>

        {MODES.map((card) => (
          <TouchableOpacity
            key={card.mode}
            style={[
              styles.card,
              mode === card.mode && styles.cardActive,
              (card.mode === 'single' || card.mode === 'individual') && styles.cardEnabled,
            ]}
            onPress={() => void handleSelect(card.mode)}
            activeOpacity={0.75}
          >
            <Text style={styles.cardEmoji}>{card.emoji}</Text>
            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <View
                  style={[
                    styles.noteBadge,
                    card.mode === 'single' || card.mode === 'individual' || card.mode === 'group'
                      ? styles.noteBadgeActive
                      : styles.noteBadgeComingSoon,
                  ]}
                >
                  <Text
                    style={[
                      styles.noteText,
                      card.mode === 'single' || card.mode === 'individual' || card.mode === 'group'
                        ? styles.noteTextActive
                        : styles.noteTextComingSoon,
                    ]}
                  >
                    {card.mode === 'group'
                      ? 'Link phones'
                      : card.mode === 'individual'
                        ? 'Available now'
                        : card.note}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    padding: 24,
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 15,
    color: '#888',
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    gap: 14,
    alignItems: 'flex-start',
  },
  cardActive: {
    borderColor: '#e53935',
    backgroundColor: '#fff9f9',
  },
  cardEnabled: {
    borderColor: '#f0d0cf',
  },
  cardEmoji: {
    fontSize: 36,
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  noteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  noteBadgeActive: {
    backgroundColor: '#e8f5e9',
  },
  noteBadgeComingSoon: {
    backgroundColor: '#f5f5f5',
  },
  noteText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noteTextActive: {
    color: '#2e7d32',
  },
  noteTextComingSoon: {
    color: '#aaa',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
