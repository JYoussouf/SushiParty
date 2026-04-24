import React, { useState } from 'react';
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
} from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
      // Redirect handled by _layout.tsx auth listener
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign in failed.';
      Alert.alert('Sign In Failed', friendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.logo}>🍣</Text>
        <Text style={styles.title}>Sushi Party</Text>
        <Text style={styles.subtitle}>Sign in to track your meals</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#bbb"
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
          placeholderTextColor="#bbb"
          secureTextEntry
          textContentType="password"
          onSubmitEditing={handleSignIn}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Create an account</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

function friendlyAuthError(message: string): string {
  if (message.includes('invalid-credential') || message.includes('wrong-password')) {
    return 'Incorrect email or password.';
  }
  if (message.includes('user-not-found')) {
    return 'No account found with that email.';
  }
  if (message.includes('too-many-requests')) {
    return 'Too many failed attempts. Please try again later.';
  }
  return message;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 72,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e53935',
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginTop: 4,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 2,
    marginTop: 8,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnDisabled: {
    backgroundColor: '#ffcdd2',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    fontSize: 13,
    color: '#aaa',
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e53935',
  },
});
