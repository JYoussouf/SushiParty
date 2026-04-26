import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CAT_AVATARS } from '../src/lib/catAvatars';
import { useAuth } from '../src/contexts/AuthContext';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🐱');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const canContinue = name.trim().length > 0;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    try {
      await completeOnboarding(name.trim(), selectedAvatar);
      router.replace('/(tabs)/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🍣</Text>
            <Text style={styles.title}>Welcome to{'\n'}Sushi Party!</Text>
            <Text style={styles.subtitle}>
              Pick your look and tell us what to call you — nothing else needed.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Pick your avatar</Text>
          <Text style={styles.avatarHint}>No stress, you can change your look anytime.</Text>
            <View style={styles.avatarGrid}>
              {CAT_AVATARS.map((avatar) => {
                const selected = avatar === selectedAvatar;
                return (
                  <TouchableOpacity
                    key={avatar}
                    style={[styles.avatarBtn, selected && styles.avatarBtnSelected]}
                    onPress={() => setSelectedAvatar(avatar)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.avatarEmoji}>{avatar}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>What do people call you?</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Just a nickname is fine"
              placeholderTextColor="#c4a898"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void handleContinue()}
              maxLength={32}
            />
            <Text style={styles.hint}>No email. No account. Just a name for the scoreboard.</Text>
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            onPress={() => void handleContinue()}
            disabled={!canContinue || saving}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {saving ? 'Saving…' : `Let's eat! ${selectedAvatar}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff5ec' },
  kb: { flex: 1 },
  scroll: { padding: 28, gap: 32, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 14, paddingTop: 12 },
  heroEmoji: { fontSize: 64, lineHeight: 72 },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#2d1a0e',
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7a5540',
    textAlign: 'center',
  },
  section: { gap: 12 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#b06040',
  },
  avatarHint: { fontSize: 13, color: '#b08070', lineHeight: 18, marginTop: -4 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarBtn: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#efd8ca',
  },
  avatarBtnSelected: {
    borderColor: '#df5a31',
    backgroundColor: '#fff0e6',
    shadowColor: '#df5a31',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarEmoji: { fontSize: 30 },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#efd8ca',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '600',
    color: '#2d1a0e',
  },
  hint: { fontSize: 12, color: '#b08070', lineHeight: 17 },
  continueBtn: {
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#df5a31',
    shadowColor: '#df5a31',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueBtnDisabled: {
    backgroundColor: '#e8bfb0',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
