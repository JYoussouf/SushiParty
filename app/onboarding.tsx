import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CAT_AVATARS } from '../src/lib/catAvatars';
import { useTheme } from '../src/contexts/ThemeContext';
import type { Theme } from '../src/theme/themes';
import { useAuth } from '../src/contexts/AuthContext';
import { isUsernameTaken } from '../src/lib/cloudflare/users';

type Styles = ReturnType<typeof makeStyles>;

function AvatarButton({ avatar, selected, onSelect, styles }: { avatar: string; selected: boolean; onSelect: (a: string) => void; styles: Styles }) {
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

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

export default function OnboardingScreen() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Shorter viewports (e.g. many Android phones once the nav bar and status bar
  // are accounted for) need tighter spacing so all content fits without scroll.
  const compact = windowHeight < 780;
  const styles = useMemo(() => makeStyles(t, compact), [t, compact]);
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
        setUsernameStatus('error');
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const canContinue =
    name.trim().length > 0 &&
    (usernameStatus === 'available' ||
      // Network check failed (offline/API down): treat as non-blocking so the
      // user isn't dead-ended. The handle is validated server-side at
      // completeOnboarding. Still require a locally well-formed handle.
      (usernameStatus === 'error' && USERNAME_RE.test(username.trim().toLowerCase())));

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
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? undefined : 'height'}
      >
        <ScrollView
          style={styles.kb}
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
              placeholderTextColor={t.color.textTertiary}
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
                  styles={styles}
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
                placeholderTextColor={t.color.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void handleContinue()}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                maxLength={20}
              />
              {usernameStatus === 'checking' && (
                <ActivityIndicator size="small" color={t.color.textSecondary} style={styles.usernameIndicator} />
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
              {usernameStatus === 'error' && "Couldn't check that handle - you can continue and we'll confirm it."}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.continueShadow, !canContinue && styles.continueBtnDisabled]}
            onPress={() => void handleContinue()}
            disabled={!canContinue || saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={t.color.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>
                {saving ? 'Saving…' : `Let's eat! ${selectedAvatar}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme, compact: boolean) => {
  const preview = compact ? 84 : 110;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  kb: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: compact ? 12 : 24,
    paddingBottom: compact ? 16 : 28,
    gap: compact ? 16 : 28,
  },
  hero: { alignItems: 'center', gap: compact ? 8 : 14 },
  avatarPreview: {
    alignSelf: 'center',
    width: preview,
    height: preview,
    borderRadius: preview / 2,
    backgroundColor: t.color.surface,
    borderWidth: 3,
    borderColor: t.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.glow(t.color.accent),
  },
  avatarPreviewEmoji: { fontSize: compact ? 48 : 62, lineHeight: compact ? 56 : 72 },
  title: {
    fontSize: 36,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    textAlign: 'center',
  },
  section: { gap: compact ? 8 : 12 },
  avatarCard: {
    alignItems: 'center',
    gap: compact ? 10 : 14,
    paddingHorizontal: 24,
    paddingVertical: compact ? 20 : 34,
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  label: {
    fontSize: 13,
    fontFamily: t.font.bodyBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: t.color.accent,
  },
  avatarHint: { fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary, lineHeight: 18, marginTop: -4 },
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
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 2,
    borderColor: t.color.border,
  },
  avatarBtnSelected: {
    borderColor: t.color.accent,
    backgroundColor: t.color.accentSoft,
    ...t.shadow.glow(t.color.accent),
  },
  avatarEmoji: { fontSize: 30 },
  input: {
    height: 54,
    borderRadius: t.radius.md,
    borderWidth: 2,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingHorizontal: 18,
    fontSize: 18,
    fontFamily: t.font.bodySemibold,
    color: t.color.textPrimary,
  },
  inputFocused: {
    borderColor: t.color.accent,
  },
  hint: { fontSize: 12, fontFamily: t.font.body, color: t.color.textSecondary, lineHeight: 17 },
  hintSuccess: { color: t.color.success },
  hintError: { color: t.color.danger },
  inputError: { borderColor: t.color.danger },
  usernameIndicator: { position: 'absolute', right: 16, top: 17 },
  continueShadow: {
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  continueBtn: {
    borderRadius: t.radius.button,
    paddingVertical: compact ? 15 : 18,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontSize: 18,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
    letterSpacing: 0.3,
  },
  });
};
