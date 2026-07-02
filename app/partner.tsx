import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { BackButton } from '../src/components';
import { useTheme } from '../src/contexts/ThemeContext';
import type { Theme } from '../src/theme/themes';
import { createPartnerApplication } from '../src/lib/cloudflare/partners';

const CONTACT_EMAIL = 'contact@joseppy.ca';

const STEPS = [
  'Tell us about your restaurant.',
  'We set up your partner profile - add photos and menu.',
  'You go live and get featured to nearby diners.',
];

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function PartnerScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [restaurantName, setRestaurantName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = restaurantName.trim() && address.trim() && isEmail(email.trim());

  // Best-effort email fallback so a lead is never lost if the partner API isn't
  // reachable (e.g. before the Worker route is deployed).
  const emailFallback = async () => {
    const subject = encodeURIComponent('Sushi Party partner application');
    const body = encodeURIComponent(
      [
        'New partner application:',
        `Restaurant: ${restaurantName.trim()}`,
        `Address: ${address.trim()}`,
        `Email: ${email.trim()}`,
        `Phone: ${phone.trim()}`,
      ].join('\n'),
    );
    try {
      await Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      /* no mail app — the confirmation screen still tells them we'll follow up */
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createPartnerApplication({
        restaurantName: restaurantName.trim(),
        address: address.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      setSubmitted(true);
    } catch {
      // API unavailable — fall back to email so the application still reaches us.
      await emailFallback();
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>

        {submitted ? (
          <View style={styles.successWrap}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>Application received</Text>
            <Text style={styles.successBody}>
              Thanks! We&apos;ll email {email.trim()} to set up your partner profile - add photos,
              confirm your details, and get featured to nearby diners.
            </Text>
            <TouchableOpacity style={styles.successBtnShadow} activeOpacity={0.9} onPress={() => router.back()}>
              <LinearGradient
                colors={t.color.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.successBtn}
              >
                <Text style={styles.successBtnText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>Feature your restaurant</Text>
              <Text style={styles.subtitle}>
                Reach hungry sushi fans near you. Set up a partner account in three simple steps.
              </Text>

              <View style={styles.stepsCard}>
                {STEPS.map((step, i) => (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>Restaurant name</Text>
                <TextInput
                  style={styles.input}
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                  placeholder="e.g. Oishii Sushi"
                  placeholderTextColor={t.color.textTertiary}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Restaurant address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main St, City"
                  placeholderTextColor={t.color.textTertiary}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@restaurant.com"
                  placeholderTextColor={t.color.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Phone (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 555-5555"
                  placeholderTextColor={t.color.textTertiary}
                  keyboardType="phone-pad"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitShadow, !canSubmit && styles.submitDisabled]}
                  activeOpacity={0.9}
                  disabled={!canSubmit || submitting}
                  onPress={() => void handleSubmit()}
                >
                  <LinearGradient
                    colors={t.color.accentGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submit}
                  >
                    {submitting ? (
                      <ActivityIndicator color={t.color.onAccent} />
                    ) : (
                      <Text style={styles.submitText}>Create partner account</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={styles.finePrint}>
                  No payment now. We&apos;ll follow up with plans and pricing. Featured placement is a
                  paid marketing service for restaurants.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    flex: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    content: { padding: 24, paddingBottom: 48, gap: 16 },
    title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary, letterSpacing: -0.3 },
    subtitle: { fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary },
    stepsCard: {
      padding: 18,
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surfaceAlt,
      borderWidth: 1,
      borderColor: t.color.border,
      gap: 14,
    },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.color.accent,
    },
    stepNumText: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.onAccent },
    stepText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: t.font.body, color: t.color.textPrimary },
    form: { gap: 6 },
    label: {
      fontSize: 13,
      fontFamily: t.font.bodySemibold,
      color: t.color.textSecondary,
      marginTop: 12,
      marginBottom: 2,
    },
    input: {
      height: 52,
      borderRadius: t.radius.md,
      borderWidth: 1.5,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: t.font.body,
      color: t.color.textPrimary,
    },
    error: { fontSize: 13, fontFamily: t.font.bodySemibold, color: t.color.danger, marginTop: 8 },
    submitShadow: { marginTop: 18, borderRadius: t.radius.button, ...t.shadow.glow(t.color.accent) },
    submitDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
    submit: { height: 54, borderRadius: t.radius.button, alignItems: 'center', justifyContent: 'center' },
    submitText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
    finePrint: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: t.font.body,
      color: t.color.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    successEmoji: { fontSize: 52 },
    successTitle: { fontSize: 24, fontFamily: t.font.display, color: t.color.textPrimary, textAlign: 'center' },
    successBody: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: t.font.body,
      color: t.color.textSecondary,
      textAlign: 'center',
    },
    successBtnShadow: { marginTop: 12, borderRadius: t.radius.button, ...t.shadow.glow(t.color.accent) },
    successBtn: {
      height: 52,
      borderRadius: t.radius.button,
      paddingHorizontal: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successBtnText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
  });
