import React, { useMemo } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AccountScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile, accountBacked, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You will be signed out of your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete my account', 'Clear this device profile and all local party history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: signOut },
    ]);
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
          <Text style={styles.title}>Manage account</Text>

          <View style={styles.card}>
            <Detail label="Name" value={userProfile?.displayName ?? '-'} styles={styles} />
            <View style={styles.cardDivider} />
            <Detail
              label="Username"
              value={userProfile?.username ? `@${userProfile.username}` : '-'}
              styles={styles}
            />
            <View style={styles.cardDivider} />
            <Detail
              label="Account"
              value={accountBacked ? userProfile?.email || 'Signed in' : 'Guest — no account'}
              styles={styles}
            />
          </View>

          {!accountBacked ? (
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.rowTitle}>Create a free account</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : null}

          {accountBacked ? (
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleSignOut}>
              <Text style={styles.rowTitle}>Sign out</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleDelete}>
            <Text style={[styles.rowTitle, styles.danger]}>Delete my account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Detail({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    scroll: { paddingTop: 4, paddingBottom: 40 },
    title: { fontSize: 30, fontFamily: t.font.display, color: t.color.textPrimary, paddingHorizontal: 20, marginBottom: 16 },
    card: {
      marginHorizontal: 20,
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.color.border },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingVertical: 14,
    },
    detailLabel: { fontSize: 15, fontFamily: t.font.bodySemibold, color: t.color.textSecondary },
    detailValue: { flexShrink: 1, fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
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
    danger: { color: t.color.danger, fontFamily: t.font.bodyBold },
    chevron: { fontSize: 24, color: t.color.textTertiary },
  });
