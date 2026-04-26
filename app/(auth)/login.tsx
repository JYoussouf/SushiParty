import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../src/contexts/AuthContext';
import { SushiPartyLogo } from '../../src/components';

type CredentialMode = 'sign-in' | 'create';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithAppleOAuth, signInWithGoogleOAuth, signInWithFacebookOAuth } = useAuth();
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
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Apple sign in failed.';
      if (message !== 'Sign in cancelled') {
        Alert.alert('Apple Sign In Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // You'll need to provide your actual Google Client ID here
      const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        Alert.alert('Configuration Error', 'Google Client ID is not configured.');
        return;
      }
      await signInWithGoogleOAuth(googleClientId);
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google sign in failed.';
      if (message !== 'Sign in cancelled') {
        Alert.alert('Google Sign In Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setLoading(true);
    try {
      // You'll need to provide your actual Facebook App ID here
      const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
      if (!facebookAppId) {
        Alert.alert('Configuration Error', 'Facebook App ID is not configured.');
        return;
      }
      await signInWithFacebookOAuth(facebookAppId);
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Facebook sign in failed.';
      if (message !== 'Sign in cancelled') {
        Alert.alert('Facebook Sign In Error', message);
      }
    } finally {
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <View style={styles.hero}>
          <SushiPartyLogo size="lg" />
        </View>

        <View style={styles.buttons}>
          <AuthButton
            label="Continue with Apple"
            icon=""
            backgroundColor="#000"
            textColor="#fff"
            onPress={handleAppleSignIn}
            disabled={loading}
          />
          <AuthButton
            label="Continue with Google"
            icon="G"
            backgroundColor="#fff"
            textColor="#222"
            borderColor="#e0e0e0"
            onPress={handleGoogleSignIn}
            disabled={loading}
          />
          <AuthButton
            label="Continue with Facebook"
            icon="f"
            backgroundColor="#1877f2"
            textColor="#fff"
            onPress={handleFacebookSignIn}
            disabled={loading}
          />

          <View style={styles.emailGap} />

          <AuthButton
            label="Sign In with Email"
            icon="@"
            backgroundColor="#e53935"
            textColor="#fff"
            onPress={() => openCredentials('sign-in')}
            disabled={loading}
          />
          <AuthButton
            label="Create an Account"
            icon="+"
            backgroundColor="#fff"
            textColor="#e53935"
            borderColor="#e53935"
            onPress={() => openCredentials('create')}
            disabled={loading}
          />
        </View>
      </View>

      {/* Bottom sheet */}
      {credentialsOpen && (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Pressable style={styles.backdrop} onPress={closeCredentials} />
          <View style={styles.sheet}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {credentialMode === 'create' ? 'Create account' : 'Sign in'}
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
                    placeholderTextColor="#bbb"
                    autoCapitalize="words"
                    textContentType="name"
                    maxLength={32}
                  />
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={(v) => setUsername(v.toLowerCase())}
                    placeholder="username"
                    placeholderTextColor="#bbb"
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
                placeholderTextColor="#bbb"
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
                placeholderTextColor="#bbb"
                secureTextEntry
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
                  placeholderTextColor="#bbb"
                  secureTextEntry
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleCredentialSubmit()}
                />
              )}

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={() => void handleCredentialSubmit()}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {credentialMode === 'create' ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
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
      )}
    </SafeAreaView>
  );
}

function AuthButton({
  label,
  icon,
  backgroundColor,
  textColor,
  borderColor,
  iconSize,
  onPress,
  disabled,
}: {
  label: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  iconSize?: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.authBtn,
        { backgroundColor },
        borderColor ? { borderWidth: 1.5, borderColor } : undefined,
        disabled && styles.authBtnDisabled,
      ]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.82}
      disabled={disabled}
    >
      {icon ? (
        <Text style={[styles.authBtnIcon, { color: textColor, fontSize: iconSize ?? 16 }]}>{icon}</Text>
      ) : (
        <View style={styles.authBtnIconSlot} />
      )}
      <Text style={[styles.authBtnLabel, { color: textColor }]}>{label}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
    gap: 36,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
  },

  // ── Auth buttons ────────────────────────────────────────────────────────
  buttons: {
    gap: 10,
  },
  emailGap: {
    height: 8,
  },
  authBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  authBtnIcon: {
    width: 28,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  authBtnIconSlot: {
    width: 28,
  },
  authBtnLabel: {
    flex: 1,
    textAlign: 'center',
    marginRight: 28,
    fontSize: 15,
    fontWeight: '700',
  },
  authBtnDisabled: {
    opacity: 0.6,
  },

  // ── Bottom sheet ────────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
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
    fontWeight: '800',
    color: '#1a1a1a',
  },
  sheetClose: {
    fontSize: 15,
    fontWeight: '600',
    color: '#aaa',
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
  },
  submitBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#f4a09e',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  modeSwitch: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeSwitchText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '600',
  },
});
