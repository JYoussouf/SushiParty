import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { SushiPartyLogo } from '../../src/components';

type CredentialMode = 'sign-in' | 'create';
type Styles = ReturnType<typeof makeStyles>;

// iOS OAuth client ID from Google Cloud Console (Application type: iOS, Bundle ID: com.joseppy.sushiparty)
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const googleConfigured = !!GOOGLE_IOS_CLIENT_ID;


const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
const facebookConfigured = !!FACEBOOK_APP_ID && !FACEBOOK_APP_ID.startsWith('your-');

export default function LoginScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { signIn, signUp, signInWithAppleOAuth, signInWithGoogleCode, signInWithFacebookOAuth } = useAuth();
  const [credentialMode, setCredentialMode] = useState<CredentialMode>('sign-in');
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);


  const openCredentials = (mode: CredentialMode) => {
    setCredentialMode(mode);
    setCredentialsOpen(true);
  };

  const closeCredentials = () => {
    if (!loading) setCredentialsOpen(false);
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithAppleOAuth();
      // Layout gate handles routing: onboarding if new user, home if returning
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Apple sign in failed.';
      if (message !== 'Sign in cancelled') Alert.alert('Apple Sign In Error', message);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleConfigured) return;
    setLoading(true);
    try {
      const prefix = GOOGLE_IOS_CLIENT_ID!.replace('.apps.googleusercontent.com', '');
      const redirectUri = `com.googleusercontent.apps.${prefix}:/oauth2redirect/google`;
      const params = new URLSearchParams({
        client_id: GOOGLE_IOS_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email profile',
      });
      const result = await WebBrowser.openAuthSessionAsync(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        redirectUri,
      );
      if (result.type === 'success') {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (!code) throw new Error('No authorization code received from Google.');
        await signInWithGoogleCode(code, redirectUri);
        // Layout gate handles routing: onboarding if new user, home if returning
      } else {
        setLoading(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google sign in failed.';
      if (message !== 'Sign in cancelled') Alert.alert('Google Sign In Error', message);
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    if (!facebookConfigured) return;
    setLoading(true);
    try {
      await signInWithFacebookOAuth(FACEBOOK_APP_ID!);
      // Layout gate handles routing: onboarding if new user, home if returning
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Facebook sign in failed.';
      if (message !== 'Sign in cancelled') Alert.alert('Facebook Sign In Error', message);
      setLoading(false);
    }
  };

  const handleCredentialSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }
    if (credentialMode === 'create') {
      if (!trimmedName || !trimmedUsername) {
        Alert.alert('Missing fields', 'Enter a display name and username.');
        return;
      }
      if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
        Alert.alert('Invalid username', 'Username must be 3–20 characters: letters, numbers, and underscores only.');
        return;
      }
      if (password.length < 8) {
        Alert.alert('Weak password', 'Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password mismatch', 'Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (credentialMode === 'create') {
        await signUp(trimmedEmail, password, trimmedName, trimmedUsername);
      } else {
        await signIn(trimmedEmail, password);
      }
      setCredentialsOpen(false);
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      Alert.alert('Error', friendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />

      <View style={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <SushiPartyLogo size="lg" />
          <Text style={styles.tagline}>Track every piece. Every party.</Text>
        </View>

        {/* Social sign-in */}
        <View style={styles.socialGroup}>
          <SocialButton
            label="Continue with Apple"
            icon=""
            backgroundColor="#1a1a1a"
            textColor="#fff"
            onPress={handleAppleSignIn}
            disabled={loading}
            styles={styles}
          />
          {googleConfigured && (
            <SocialButton
              label="Continue with Google"
              icon="G"
              iconStyle={styles.googleIcon}
              backgroundColor="#fff"
              textColor="#3c3c3c"
              borderColor="#e0e0e0"
              onPress={handleGoogleSignIn}
              disabled={loading}
              styles={styles}
            />
          )}
          {facebookConfigured && (
            <SocialButton
              label="Continue with Facebook"
              icon="f"
              iconStyle={styles.facebookIcon}
              backgroundColor="#1877f2"
              textColor="#fff"
              onPress={handleFacebookSignIn}
              disabled={loading}
              styles={styles}
            />
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email options */}
        <View style={styles.emailGroup}>
          <TouchableOpacity
            style={styles.emailBtnPrimaryShadow}
            onPress={() => openCredentials('sign-in')}
            disabled={loading}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={t.color.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.emailBtn, styles.emailBtnPrimary]}
            >
              <Text style={styles.emailBtnTextPrimary}>Sign in with email</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emailBtn, styles.emailBtnSecondary]}
            onPress={() => openCredentials('create')}
            disabled={loading}
            activeOpacity={0.82}
          >
            <Text style={styles.emailBtnTextSecondary}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom sheet */}
      {credentialsOpen && (
        <>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={closeCredentials} />
          <KeyboardAvoidingView
            style={styles.sheetWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
          <View style={styles.sheet}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {credentialMode === 'create' ? 'Create account' : 'Welcome back'}
                </Text>
                <TouchableOpacity onPress={closeCredentials} disabled={loading}>
                  <Text style={styles.sheetClose}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {credentialMode === 'create' && (
                <>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Display name"
                    placeholderTextColor={t.color.textTertiary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    spellCheck={false}
                    textContentType="name"
                    maxLength={32}
                  />
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={(v) => setUsername(v.toLowerCase())}
                    placeholder="username"
                    placeholderTextColor={t.color.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                </>
              )}

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={t.color.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={t.color.textTertiary}
                secureTextEntry
                autoCorrect={false}
                spellCheck={false}
                textContentType={credentialMode === 'create' ? 'newPassword' : 'password'}
                returnKeyType={credentialMode === 'create' ? 'next' : 'done'}
                onSubmitEditing={credentialMode === 'sign-in' ? () => void handleCredentialSubmit() : undefined}
              />
              {credentialMode === 'create' && (
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor={t.color.textTertiary}
                  secureTextEntry
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleCredentialSubmit()}
                />
              )}

              <TouchableOpacity
                style={[styles.submitBtnShadow, loading && styles.submitBtnDisabled]}
                onPress={() => void handleCredentialSubmit()}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={t.color.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  {loading ? (
                    <ActivityIndicator color={t.color.onAccent} />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {credentialMode === 'create' ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modeSwitch}
                onPress={() => setCredentialMode(credentialMode === 'create' ? 'sign-in' : 'create')}
                disabled={loading}
              >
                <Text style={styles.modeSwitchText}>
                  {credentialMode === 'create'
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Create one"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </>
      )}
      </SafeAreaView>
    </View>
  );
}

function SocialButton({
  label,
  icon,
  iconStyle,
  backgroundColor,
  textColor,
  borderColor,
  onPress,
  disabled,
  styles,
}: {
  label: string;
  icon: string;
  iconStyle?: object;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  onPress: () => void;
  disabled?: boolean;
  styles: Styles;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.socialBtn,
        { backgroundColor },
        borderColor ? { borderWidth: 1.5, borderColor } : undefined,
        disabled && styles.socialBtnDisabled,
      ]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      <View style={styles.socialBtnIconWrap}>
        <Text style={[styles.socialBtnIcon, { color: textColor }, iconStyle]}>{icon}</Text>
      </View>
      <Text style={[styles.socialBtnLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('incorrect email or password')) return 'Incorrect email or password.';
  if (lower.includes('already exists')) return 'An account with that email already exists.';
  if (lower.includes('username')) return message;
  if (lower.includes('api_base_url')) return 'Set EXPO_PUBLIC_API_BASE_URL before using account login.';
  return message;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
    justifyContent: 'center',
    gap: 28,
  },

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    gap: 14,
    paddingBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: t.color.textSecondary,
    fontFamily: t.font.bodyMedium,
    letterSpacing: 0.2,
  },

  // ── Social buttons ────────────────────────────────────────
  socialGroup: {
    gap: 10,
  },
  socialBtn: {
    height: 54,
    borderRadius: t.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    ...t.shadow.card,
  },
  socialBtnIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  socialBtnIcon: {
    fontSize: 17,
    fontFamily: t.font.bodyBold,
    lineHeight: 20,
  },
  socialBtnLabel: {
    flex: 1,
    textAlign: 'center',
    marginRight: 28,
    fontSize: 15,
    fontFamily: t.font.bodySemibold,
    letterSpacing: 0.1,
  },
  socialBtnDisabled: {
    opacity: 0.55,
  },
  googleIcon: {
    fontFamily: 'serif',
    fontWeight: '700',
    color: '#4285F4',
  },
  facebookIcon: {
    fontWeight: '900',
    fontSize: 19,
  },

  // ── Divider ───────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.color.border,
  },
  dividerText: {
    fontSize: 13,
    color: t.color.textTertiary,
    fontFamily: t.font.bodyMedium,
  },

  // ── Email buttons ─────────────────────────────────────────
  emailGroup: {
    gap: 10,
  },
  emailBtn: {
    height: 52,
    borderRadius: t.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBtnPrimaryShadow: {
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  emailBtnPrimary: {
    width: '100%',
  },
  emailBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: t.color.accent,
  },
  emailBtnTextPrimary: {
    color: t.color.onAccent,
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    letterSpacing: 0.1,
  },
  emailBtnTextSecondary: {
    color: t.color.accent,
    fontSize: 15,
    fontFamily: t.font.bodySemibold,
  },

  // ── Bottom sheet ──────────────────────────────────────────
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '92%',
  },
  sheet: {
    maxHeight: '100%',
    backgroundColor: t.color.surface,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.color.border,
  },
  sheetContent: {
    padding: 24,
    gap: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
  },
  sheetClose: {
    fontSize: 15,
    fontFamily: t.font.bodySemibold,
    color: t.color.textTertiary,
  },
  input: {
    height: 52,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceAlt,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
  },
  submitBtnShadow: {
    marginTop: 4,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  submitBtn: {
    height: 52,
    borderRadius: t.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: t.color.onAccent,
    fontSize: 16,
    fontFamily: t.font.bodyBold,
  },
  modeSwitch: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeSwitchText: {
    color: t.color.accent,
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
  },
});
