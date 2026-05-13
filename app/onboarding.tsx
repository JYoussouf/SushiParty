import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CAT_AVATARS } from '../src/lib/catAvatars';
import { useAuth } from '../src/contexts/AuthContext';
import { isUsernameTaken } from '../src/lib/cloudflare/users';

function AvatarButton({ avatar, selected, onSelect }: { avatar: string; selected: boolean; onSelect: (a: string) => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(1.3, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    onSelect(avatar);
  };

  return (
    <TouchableOpacity
      style={[styles.avatarBtn, selected && styles.avatarBtnSelected]}
      onPress={handlePress}
      activeOpacity={1}
    >
      <Animated.Text style={[styles.avatarEmoji, animStyle]}>{avatar}</Animated.Text>
    </TouchableOpacity>
  );
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding, userProfile } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<string>(userProfile?.avatar ?? '🐱');
  const genericNames = ['Google User', 'Apple User', 'Facebook User'];
  const initialName =
    userProfile?.displayName && !genericNames.includes(userProfile.displayName)
      ? userProfile.displayName
      : '';
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewScale = useSharedValue(1);
  const previewStyle = useAnimatedStyle(() => ({ transform: [{ scale: previewScale.value }] }));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) { setUsernameStatus('idle'); return; }
    if (!USERNAME_RE.test(trimmed)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(trimmed);
        setUsernameStatus(taken ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const canContinue =
    name.trim().length > 0 &&
    usernameStatus === 'available';

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    try {
      await completeOnboarding(name.trim(), selectedAvatar, username.trim().toLowerCase());
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
        behavior={Platform.OS === 'ios' ? undefined : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.hero}>
            <Text style={styles.title}>Welcome to{'\n'}Sushi Party!</Text>
            <Text style={styles.subtitle}>
              Set up your profile and you'll be ready to roll.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>What should we call you?</Text>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              value={name}
              onChangeText={setName}
              placeholder="Just a nickname is fine"
              placeholderTextColor="#c4a898"
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="next"
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              maxLength={32}
            />
          </View>
          <View style={styles.avatarCard}>
            <Text style={styles.label}>Pick your avatar</Text>
            <Text style={styles.avatarHint}>No stress, you can change your look anytime.</Text>
            <Animated.View style={[styles.avatarPreview, previewStyle]}>
              <Text style={styles.avatarPreviewEmoji}>{selectedAvatar}</Text>
            </Animated.View>
            <View style={styles.avatarGrid}>
              {CAT_AVATARS.map((avatar) => (
                <AvatarButton
                  key={avatar}
                  avatar={avatar}
                  selected={avatar === selectedAvatar}
                  onSelect={(a) => {
                    setSelectedAvatar(a);
                    previewScale.value = withSequence(
                      withSpring(1.18, { damping: 6, stiffness: 300 }),
                      withSpring(1, { damping: 12, stiffness: 200 }),
                    );
                  }}
                />
              ))}
            </View>
          </View>


          <View style={styles.section}>
            <Text style={styles.label}>Pick a unique handle</Text>
            <Text style={styles.avatarHint}>One of a kind, just like you!</Text>
            <View>
              <TextInput
                style={[styles.input, usernameFocused && styles.inputFocused, usernameStatus === 'taken' && styles.inputError]}
                value={username}
                onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="letters, numbers, underscores"
                placeholderTextColor="#c4a898"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void handleContinue()}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                maxLength={20}
              />
              {usernameStatus === 'checking' && (
                <ActivityIndicator size="small" color="#b08070" style={styles.usernameIndicator} />
              )}
            </View>
            <Text style={[
              styles.hint,
              usernameStatus === 'available' && styles.hintSuccess,
              usernameStatus === 'taken' && styles.hintError,
              usernameStatus === 'invalid' && styles.hintError,
            ]}>
              {usernameStatus === 'available' && '✓ Username is available'}
              {usernameStatus === 'taken' && 'That username is taken'}
              {usernameStatus === 'invalid' && '3–20 characters: letters, numbers, underscores'}
            </Text>
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
  avatarPreview: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#df5a31',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#df5a31',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarPreviewEmoji: { fontSize: 62, lineHeight: 72 },
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
  avatarCard: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderRadius: 32,
    backgroundColor: '#fff8e9',
    borderWidth: 1,
    borderColor: '#f4e4ca',
    shadowColor: '#28160c',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#b06040',
  },
  avatarHint: { fontSize: 13, color: '#b08070', lineHeight: 18, marginTop: -4 },
  avatarGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
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
  inputFocused: {
    borderColor: '#df5a31',
  },
  hint: { fontSize: 12, color: '#b08070', lineHeight: 17 },
  hintSuccess: { color: '#4caf50' },
  hintError: { color: '#df5a31' },
  inputError: { borderColor: '#df5a31' },
  usernameIndicator: { position: 'absolute', right: 16, top: 17 },
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
