import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SushiPartyLogo } from '../../src/components';

interface HomeButton {
  label: string;
  emoji: string;
  accent: string;
  onPress: () => void;
}

export default function HomeScreen() {
  const router = useRouter();

  const buttons: HomeButton[] = [
    {
      label: "Let's Eat!",
      emoji: '🍣',
      accent: '#e53935',
      onPress: () => router.push('/session/mode-select'),
    },
    {
      label: 'History',
      emoji: '📋',
      accent: '#1565c0',
      onPress: () => router.push('/(tabs)/history'),
    },
    {
      label: 'Profile',
      emoji: '👤',
      accent: '#43a047',
      onPress: () => router.push('/(tabs)/profile'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.hero}>
          <SushiPartyLogo size="lg" />
          <View style={styles.decorRow}>
            <Text style={styles.decorEmoji}>🐟</Text>
            <Text style={styles.decorEmoji}>🍣</Text>
            <Text style={styles.decorEmoji}>🌀</Text>
            <Text style={styles.decorEmoji}>🍱</Text>
          </View>
          <View style={styles.buttons}>
            {buttons.map((btn) => (
              <TouchableOpacity
                key={btn.label}
                style={[styles.button, { borderColor: btn.accent }]}
                onPress={btn.onPress}
                activeOpacity={0.82}
              >
                <Text style={styles.buttonEmoji}>{btn.emoji}</Text>
                <Text style={[styles.buttonLabel, { color: btn.accent }]}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf2',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 2,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ead7ca',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  settingsIcon: {
    fontSize: 22,
    lineHeight: 24,
  },
  hero: {
    alignItems: 'center',
    gap: 28,
  },
  decorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },
  decorEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
