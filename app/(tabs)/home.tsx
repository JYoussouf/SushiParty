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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SushiPartyLogo } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSession } from '../../src/hooks/useSession';

interface HomeButton {
  label: string;
  emoji: string;
  accent: string;
  onPress: () => void;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const { participants, currentUserParticipantIndex, groupCode, hasActiveSession } = useSession();
  const avatar = participants[currentUserParticipantIndex]?.avatar ?? '🐱';

  const buttons: HomeButton[] = hasActiveSession
    ? [
        {
          label: groupCode ? 'Resume Lobby' : 'Resume Scoreboard',
          emoji: groupCode ? '🎉' : '🍣',
          accent: '#e53935',
          onPress: () => router.push(groupCode ? '/session/lobby' : '/session/scoreboard'),
        },
      ]
    : [
        {
          label: 'Start a Sushi Party',
          emoji: '🎉',
          accent: '#e53935',
          onPress: () => router.push('/session/mode-select'),
        },
        {
          label: 'Join a Sushi Party',
          emoji: '🔗',
          accent: '#1565c0',
          onPress: () => router.push('/session/group-join'),
        },
      ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.profileAvatar}>{avatar}</Text>
          {userProfile?.displayName ? (
            <Text style={styles.profileName} numberOfLines={1}>{userProfile.displayName}</Text>
          ) : null}
        </TouchableOpacity>
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
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={btn.label}
                style={i === 0 ? styles.buttonPrimary : styles.buttonSecondary}
                onPress={btn.onPress}
                activeOpacity={0.82}
              >
                <Text style={styles.buttonEmoji}>{btn.emoji}</Text>
                <Text style={i === 0 ? styles.buttonLabelPrimary : styles.buttonLabelSecondary}>{btn.label}</Text>
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
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.08)',
    shadowColor: '#28160c',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    maxWidth: 180,
  },
  profileAvatar: {
    fontSize: 20,
    lineHeight: 24,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a3624',
    flexShrink: 1,
    letterSpacing: -0.1,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.08)',
    shadowColor: '#28160c',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  settingsIcon: {
    fontSize: 20,
    lineHeight: 22,
  },
  hero: {
    alignItems: 'center',
    gap: 24,
  },
  decorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  decorEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  buttons: {
    width: '100%',
    gap: 10,
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#ee5d52',
    shadowColor: '#ee5d52',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.12)',
    shadowColor: '#28160c',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  buttonLabelPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fffaf2',
    letterSpacing: -0.2,
  },
  buttonLabelSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#21160d',
    letterSpacing: -0.2,
  },
});
