import React, { useMemo } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const LINKS: { title: string; path: string }[] = [
  { title: 'Terms of Service', path: '/terms' },
  { title: 'Privacy Policy', path: '/privacy' },
  { title: 'Support', path: '/support' },
];

export default function LegalScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const open = async (path: string) => {
    const url = `${API_BASE}${path}`;
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert('Unavailable', "This page isn't available right now.");
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Unavailable', "Couldn't open the page.");
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
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Legal</Text>
          {LINKS.map((link) => (
            <TouchableOpacity
              key={link.path}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => void open(link.path)}
            >
              <Text style={styles.rowTitle}>{link.title}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
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
    scroll: { paddingTop: 4, paddingBottom: 40 },
    title: { fontSize: 30, fontFamily: t.font.display, color: t.color.textPrimary, paddingHorizontal: 20, marginBottom: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.color.border,
    },
    rowTitle: { flex: 1, fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
    chevron: { fontSize: 24, color: t.color.textTertiary },
  });
