import React, { useMemo } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { buildSessionExportCsv } from '../../src/lib/exportSessions';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';

type Styles = ReturnType<typeof makeStyles>;

const SCROLL_PADDING_BOTTOM = 40;

function ListRow({
  title,
  subtitle,
  danger,
  onPress,
  styles,
}: {
  title: string;
  subtitle?: string | undefined;
  danger?: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <TouchableOpacity style={styles.listRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.listRowBody}>
        <Text style={[styles.listRowTitle, danger && styles.listRowDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSub}>{subtitle}</Text> : null}
      </View>
      {!danger ? <Text style={styles.listChevron}>›</Text> : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { userProfile, accountBacked, signOut } = useAuth();

  const handleExportHistory = async () => {
    if (!userProfile) return;
    const sessions = await getAllSessions();
    await Share.share({
      title: 'Sushi Party History Export',
      message: buildSessionExportCsv(sessions, userProfile.uid),
    });
  };

  const handleReset = () => {
    Alert.alert('Delete my account', 'Clear this device profile and all local party history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You will be signed out of your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: SCROLL_PADDING_BOTTOM + insets.bottom }]}
        >
          <Text style={styles.title}>Settings</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.listGroup}>
              <ListRow title="Sound & Music" onPress={() => router.push('/settings/volume')} styles={styles} />
              <View style={styles.listDivider} />
              <ListRow
                title="Username"
                subtitle={userProfile?.username ? `@${userProfile.username}` : undefined}
                onPress={() => router.push('/settings/username')}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Places</Text>
            <View style={styles.listGroup}>
              <ListRow
                title="Favourite sushi spot"
                subtitle="See where you've partied and browsed, and pin your favourite."
                onPress={() => router.push('/profile/places')}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More</Text>
            <View style={styles.listGroup}>
              <ListRow
                title="Become a Partner Restaurant"
                subtitle="List your restaurant and reach nearby diners in the Explore feed."
                onPress={() => router.push('/partner')}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.listGroup}>
              <ListRow
                title="Export my party data"
                subtitle="Download a CSV summary of saved parties."
                onPress={() => void handleExportHistory()}
                styles={styles}
              />
              {accountBacked ? (
                <>
                  <View style={styles.listDivider} />
                  <ListRow title="Sign out" danger onPress={handleSignOut} styles={styles} />
                </>
              ) : null}
              <View style={styles.listDivider} />
              <ListRow title="Delete my account" danger onPress={handleReset} styles={styles} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    scroll: { padding: 20, gap: 18, paddingBottom: SCROLL_PADDING_BOTTOM },
    title: { fontSize: 30, fontFamily: t.font.display, color: t.color.textPrimary },
    section: { gap: 10 },
    sectionTitle: {
      fontSize: 13,
      fontFamily: t.font.bodyBold,
      color: t.color.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },

    // Grouped list: rows share one surface, separated by hairline lines (no pills).
    listGroup: {
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      overflow: 'hidden',
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    listRowBody: { flex: 1, gap: 2 },
    listRowTitle: { fontSize: 16, fontFamily: t.font.bodySemibold, color: t.color.textPrimary },
    listRowSub: { fontSize: 13, lineHeight: 18, fontFamily: t.font.body, color: t.color.textSecondary },
    listRowDanger: { color: t.color.danger, fontFamily: t.font.bodyBold },
    listChevron: { fontSize: 24, color: t.color.textTertiary },
    listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.color.border, marginLeft: 16 },
  });
