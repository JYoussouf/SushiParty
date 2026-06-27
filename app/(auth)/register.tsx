import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';

export default function RegisterScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedName || !trimmedUsername || !trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
      Alert.alert(
        'Invalid username',
        'Username must be 3–20 characters and contain only letters, numbers, and underscores.',
      );
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

    setLoading(true);
    try {
      await signUp(trimmedEmail, password, trimmedName, trimmedUsername);
      // Redirect handled by _layout.tsx auth listener
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Registration failed.';
      Alert.alert('Registration Failed', friendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? undefined : 'height'}
      >
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          <Text style={styles.logo}>👤</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the party</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Sushi Master"
            placeholderTextColor={t.color.textTertiary}
            autoCapitalize="words"
            textContentType="name"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            placeholder="sushi_master"
            placeholderTextColor={t.color.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>3–20 chars, letters / numbers / underscores only</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={t.color.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={t.color.textTertiary}
            secureTextEntry
            textContentType="newPassword"
          />
          <Text style={styles.hint}>At least 8 characters</Text>

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={t.color.textTertiary}
            secureTextEntry
            textContentType="newPassword"
            onSubmitEditing={handleSignUp}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.primaryBtnShadow, loading && styles.primaryBtnDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={t.color.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              {loading ? (
                <ActivityIndicator color={t.color.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.backLink}>
              <Text style={styles.backLinkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function friendlyAuthError(message: string): string {
  if (message.includes('email-already-in-use')) {
    return 'An account already exists with that email.';
  }
  if (message.includes('Username is already taken')) {
    return 'That username is taken. Please choose another.';
  }
  if (message.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  return message;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  kb: { flex: 1 },
  scroll: {
    padding: 24,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    marginTop: 4,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    marginBottom: 2,
    marginTop: 12,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: t.color.border,
    borderRadius: t.radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    backgroundColor: t.color.surface,
  },
  hint: {
    fontSize: 12,
    fontFamily: t.font.body,
    color: t.color.textTertiary,
    marginTop: 2,
  },
  primaryBtnShadow: {
    marginTop: 20,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  primaryBtn: {
    height: 52,
    borderRadius: t.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backLinkText: {
    fontSize: 15,
    color: t.color.accent,
    fontFamily: t.font.bodySemibold,
  },
});
