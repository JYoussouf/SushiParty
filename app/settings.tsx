import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../src/components';
import { useTheme } from '../src/contexts/ThemeContext';
import type { Theme } from '../src/theme/themes';
import { useAuth } from '../src/contexts/AuthContext';
import { buildSessionExportCsv } from '../src/lib/exportSessions';
import { getAllSessions } from '../src/lib/cloudflare/sessions';

type Styles = ReturnType<typeof makeStyles>;

const SOUND_VOL_KEY = '@sushi_sound_volume';
const MUSIC_VOL_KEY = '@sushi_music_volume';
const SOUND_MUTE_KEY = '@sushi_sound_muted';
const MUSIC_MUTE_KEY = '@sushi_music_muted';

function VolumeRow({ label, icon, volume, muted, onVolumeChange, onToggleMute, t, styles }: {
  label: string;
  icon: string;
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  t: Theme;
  styles: Styles;
}) {
  const muteScale = useRef(new Animated.Value(1)).current;

  const handleMutePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(muteScale, { toValue: 0.82, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(muteScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
    ]).start();
    onToggleMute();
  };

  const sliderColor = muted ? t.color.textTertiary : t.color.accent;

  return (
    <View style={styles.volumeCard}>
      <View style={styles.volumeHeader}>
        <Text style={styles.volumeIcon}>{icon}</Text>
        <Text style={styles.volumeLabel}>{label}</Text>
        <View style={styles.volumePercent}>
          <Text style={[styles.volumeValue, muted && styles.volumeValueMuted]}>
            {muted ? 'Off' : `${Math.round(volume * 100)}%`}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ scale: muteScale }] }}>
          <Pressable style={[styles.muteBtn, muted && styles.muteBtnActive]} onPress={handleMutePress}>
            <Text style={[styles.muteIcon, { opacity: muted ? 1 : 0.5 }]}>
              {muted ? '🔇' : '🔊'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={muted ? 0 : volume}
        onValueChange={(v) => {
          if (muted && v > 0) onToggleMute();
          onVolumeChange(v);
        }}
        minimumTrackTintColor={sliderColor}
        maximumTrackTintColor={t.color.border}
        thumbTintColor={sliderColor}
        disabled={false}
      />
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelText}>Silent</Text>
        <Text style={styles.sliderLabelText}>Full</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile, accountBacked, signOut } = useAuth();

  const [soundVolume, setSoundVolume] = useState(0.8);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [soundMuted, setSoundMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);

  useEffect(() => {
    void (async () => {
      const [sv, mv, sm, mm] = await Promise.all([
        AsyncStorage.getItem(SOUND_VOL_KEY),
        AsyncStorage.getItem(MUSIC_VOL_KEY),
        AsyncStorage.getItem(SOUND_MUTE_KEY),
        AsyncStorage.getItem(MUSIC_MUTE_KEY),
      ]);
      if (sv !== null) setSoundVolume(parseFloat(sv));
      if (mv !== null) setMusicVolume(parseFloat(mv));
      if (sm !== null) setSoundMuted(sm === 'true');
      if (mm !== null) setMusicMuted(mm === 'true');
    })();
  }, []);

  const handleSoundVolume = (v: number) => {
    setSoundVolume(v);
    void AsyncStorage.setItem(SOUND_VOL_KEY, String(v));
  };

  const handleMusicVolume = (v: number) => {
    setMusicVolume(v);
    void AsyncStorage.setItem(MUSIC_VOL_KEY, String(v));
  };

  const handleSoundMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    void AsyncStorage.setItem(SOUND_MUTE_KEY, String(next));
  };

  const handleMusicMute = () => {
    const next = !musicMuted;
    setMusicMuted(next);
    void AsyncStorage.setItem(MUSIC_MUTE_KEY, String(next));
  };

  const handleExportHistory = async () => {
    if (!userProfile) return;
    const sessions = await getAllSessions();
    await Share.share({
      title: 'Sushi Party History Export',
      message: buildSessionExportCsv(sessions, userProfile.uid),
    });
  };

  const handleReset = () => {
    Alert.alert('Delete my Account', 'Clear this device profile and all local party history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <BackButton onPress={() => router.back()} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume</Text>
          <View style={styles.soundCard}>
            <VolumeRow
              label="Party Sounds"
              icon="🎵"
              volume={soundVolume}
              muted={soundMuted}
              onVolumeChange={handleSoundVolume}
              onToggleMute={handleSoundMute}
              t={t}
              styles={styles}
            />
            <View style={styles.soundDivider} />
            <VolumeRow
              label="Music"
              icon="🎶"
              volume={musicVolume}
              muted={musicMuted}
              onVolumeChange={handleMusicVolume}
              onToggleMute={handleMusicMute}
              t={t}
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Account</Text>


          {accountBacked && (
            <TouchableOpacity
              style={[styles.row, styles.destructiveRow]}
              onPress={() =>
                Alert.alert('Sign out', 'You will be signed out of your account.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                ])
              }
            >
              <View>
                <Text style={styles.destructiveTitle}>Sign out</Text>
                <Text style={styles.rowNote}>Sign out of your account on this device.</Text>
              </View>
              <Text style={styles.destructiveAction}>Sign out</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.row, styles.destructiveRow]} onPress={handleReset}>
            <View>
              <Text style={styles.destructiveTitle}>Delete my Account</Text>
              <Text style={styles.rowNote}>Clear this device profile and all local party history?</Text>
            </View>
            <Text style={styles.destructiveAction}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => void handleExportHistory()}>
            <View>
              <Text style={styles.rowTitle}>Export my Party Data</Text>
              <Text style={styles.rowNote}>Download a readable CSV summary of saved parties.</Text>
            </View>
            <Text style={styles.rowAction}>Export</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 18, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  hero: {
    borderRadius: t.radius.lg,
    padding: 22,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 8,
    ...t.shadow.card,
  },
  eyebrow: { fontSize: 12, fontFamily: t.font.bodyBold, letterSpacing: 1, textTransform: 'uppercase', color: t.color.accent },
  title: { fontSize: 30, lineHeight: 34, fontFamily: t.font.display, color: t.color.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: t.font.body, color: t.color.textSecondary },
  section: { gap: 10 },
  sectionTitle: { fontSize: 21, fontFamily: t.font.display, color: t.color.textPrimary },

  // ── Appearance ─────────────────────────────────────────────
  appearanceCard: {
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 16,
    gap: 12,
  },
  appearanceLabel: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  themeOptions: { flexDirection: 'row', gap: 10 },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: t.radius.button,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1.5,
    borderColor: t.color.border,
  },
  themeOptionActive: {
    borderColor: t.color.accent,
    backgroundColor: t.color.accentSoft,
    ...t.shadow.glow(t.color.accent),
  },
  themeOptionEmoji: { fontSize: 18, lineHeight: 22 },
  themeOptionLabel: { fontSize: 14, fontFamily: t.font.bodySemibold, color: t.color.textSecondary },
  themeOptionLabelActive: { color: t.isDark ? t.color.onAccent : t.color.accent },
  themeOptionCheck: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.isDark ? t.color.onAccent : t.color.accent },

  soundCard: {
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: 'hidden',
  },
  soundDivider: {
    height: 1,
    backgroundColor: t.color.border,
    marginHorizontal: 16,
  },
  volumeCard: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  volumeIcon: { fontSize: 18 },
  volumeLabel: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary, flex: 1 },
  volumePercent: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
  volumeValue: { fontSize: 13, fontFamily: t.font.bodySemibold, color: t.color.accent },
  volumeValueMuted: { color: t.color.textTertiary },
  muteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: t.color.border,
  },
  muteBtnActive: {
    backgroundColor: t.color.accentSoft,
    borderColor: t.color.accent,
  },
  muteIcon: { fontSize: 16 },
  slider: { width: '100%', height: 36, marginHorizontal: -4 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    paddingHorizontal: 2,
  },
  sliderLabelText: { fontSize: 10, color: t.color.textTertiary, fontFamily: t.font.bodySemibold, letterSpacing: 0.3 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: t.radius.lg,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  rowTitle: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  rowNote: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: t.font.body, color: t.color.textSecondary, maxWidth: 240 },
  rowAction: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.accent },
  destructiveRow: { borderColor: t.color.danger, backgroundColor: t.color.surface },
  destructiveTitle: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.danger },
  destructiveAction: { fontSize: 13, fontFamily: t.font.bodyBold, color: t.color.danger },
});
