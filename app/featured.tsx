import React, { useMemo } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { BackButton } from '../src/components';
import { useTheme } from '../src/contexts/ThemeContext';
import type { Theme } from '../src/theme/themes';

// Sales / lead-gen surface for restaurants that want premium placement in the
// near-me feed. Intentionally contact-driven — no in-app payment UI — so it
// stays outside Apple's IAP scope (this is a real-world B2B advertising service
// sold to a business, not a digital good the app's user consumes).

const CONTACT_EMAIL = 'contact@joseppy.ca';

const BENEFITS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: '⭐️',
    title: 'Top of the feed',
    body: 'Your restaurant sits above the fold in "Sushi near you", with a Featured badge.',
  },
  {
    emoji: '📍',
    title: 'Reach nearby diners',
    body: 'Shown to people near you the moment they open the app deciding where to eat.',
  },
  {
    emoji: '🧭',
    title: 'One tap to your door',
    body: 'Diners tap your card and get directions straight to you in Maps.',
  },
];

const STEPS = [
  'Tell us your restaurant name and location.',
  "We'll set up your featured placement and a simple monthly plan.",
  'You go live at the top of the near-me feed for diners around you.',
];

export default function FeaturedScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const handleContact = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const subject = encodeURIComponent('Featuring my sushi restaurant on Sushi Party');
    const body = encodeURIComponent(
      [
        "Hi — I'd like to get my restaurant featured in the Sushi Party near-me feed.",
        '',
        'Restaurant name:',
        'Address / location:',
        'Contact name & phone:',
        '',
        'Please send me plans and pricing. Thanks!',
      ].join('\n'),
    );
    const url = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('no mail app');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Email us', `Reach us at ${CONTACT_EMAIL} to get featured.`);
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>⭐️</Text>
            <Text style={styles.title}>Get your restaurant featured</Text>
            <Text style={styles.subtitle}>
              Reach hungry sushi fans the moment they&apos;re choosing where to eat near you.
            </Text>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitCard}>
                <Text style={styles.benefitEmoji}>{b.emoji}</Text>
                <View style={styles.benefitBody}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitText}>{b.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>How it works</Text>
            {STEPS.map((step, i) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.ctaShadow} activeOpacity={0.9} onPress={() => void handleContact()}>
            <LinearGradient
              colors={t.color.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Contact us to get started</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.finePrint}>
            We&apos;ll reply from {CONTACT_EMAIL} with plans and pricing. Featured placement is a paid
            marketing service for restaurants.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    content: { padding: 24, gap: 22, paddingBottom: 48 },
    hero: { alignItems: 'center', gap: 8 },
    heroEmoji: { fontSize: 44 },
    title: {
      fontSize: 28,
      fontFamily: t.font.display,
      color: t.color.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: t.font.body,
      color: t.color.textSecondary,
      textAlign: 'center',
    },
    benefits: { gap: 12 },
    benefitCard: {
      flexDirection: 'row',
      gap: 14,
      padding: 16,
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      ...t.shadow.card,
    },
    benefitEmoji: { fontSize: 24 },
    benefitBody: { flex: 1, gap: 3 },
    benefitTitle: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
    benefitText: { fontSize: 14, lineHeight: 20, fontFamily: t.font.body, color: t.color.textSecondary },
    stepsCard: {
      padding: 18,
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surfaceAlt,
      borderWidth: 1,
      borderColor: t.color.border,
      gap: 14,
    },
    stepsTitle: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
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
    ctaShadow: { borderRadius: t.radius.button, ...t.shadow.glow(t.color.accent) },
    cta: {
      height: 54,
      borderRadius: t.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
    finePrint: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: t.font.body,
      color: t.color.textTertiary,
      textAlign: 'center',
    },
  });
