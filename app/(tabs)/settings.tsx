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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const insets = useSafeAreaInsets();
  const { userProfile, accountBacked, signOut, changeUsername } = useAuth();

  const [usernameInput, setUsernameInput] = useState(userProfile?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameSaving, setUsernameSaving] = useState(false);

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

  useEffect(() => {
    setUsernameInput(userProfile?.username ?? '');
  }, [userProfile?.username]);

  const currentUsername = userProfile?.username ?? '';
  const trimmedUsername = usernameInput.trim().toLowerCase();
  const usernameDirty = trimmedUsername !== currentUsername;

  const handleChangeUsername = async () => {
    setUsernameError(null);
    setUsernameSaved(false);
    if (!usernameDirty) return;
    if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
      setUsernameError('Username must be 3-20 characters: letters, numbers, and underscores only.');
      return;
    }
    setUsernameSaving(true);
    try {
      await changeUsername(trimmedUsername);
      setUsernameSaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : 'Could not change username.');
    } finally {
      setUsernameSaving(false);
    }
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
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: SCROLL_PADDING_BOTTOM + insets.bottom }]}
      >
        <Text style={styles.title}>Settings</Text>

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
          <Text style={styles.sectionTitle}>Username</Text>
          <View style={styles.usernameCard}>
            <View style={styles.usernameInputRow}>
              <View style={styles.usernameInputWrap}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={usernameInput}
                  onChangeText={(text) => {
                    setUsernameInput(text);
                    setUsernameError(null);
                    setUsernameSaved(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={20}
                  placeholder="username"
                  placeholderTextColor={t.color.textTertiary}
                  editable={!usernameSaving}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleChangeUsername()}
                />
              </View>
              <TouchableOpacity
                style={[styles.rowActionBtn, (!usernameDirty || usernameSaving) && styles.rowActionBtnDisabled]}
                activeOpacity={0.85}
                disabled={!usernameDirty || usernameSaving}
                onPress={() => void handleChangeUsername()}
              >
                <Text style={styles.rowActionBtnText}>{usernameSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
            {usernameError ? (
              <Text style={styles.usernameError}>{usernameError}</Text>
            ) : usernameSaved ? (
              <Text style={styles.usernameSuccess}>Username updated.</Text>
            ) : (
              <Text style={styles.rowNote}>You can change your username once every 7 days.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Places</Text>
          <TouchableOpacity style={styles.navRow} activeOpacity={0.8} onPress={() => router.push('/profile/places')}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Favourite sushi spot</Text>
              <Text style={styles.rowNote}>See the places you&apos;ve partied at and browsed, and pin your favourite.</Text>
            </View>
            <Text style={styles.navChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For restaurants</Text>
          <TouchableOpacity style={styles.navRow} activeOpacity={0.8} onPress={() => router.push('/partner')}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Feature your restaurant</Text>
              <Text style={styles.rowNote}>Reach nearby diners in the Explore feed - set up a partner account.</Text>
            </View>
            <Text style={styles.navChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Account</Text>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Export my Party Data</Text>
              <Text style={styles.rowNote}>Download a readable CSV summary of saved parties.</Text>
            </View>
            <TouchableOpacity
              style={styles.rowActionBtn}
              activeOpacity={0.85}
              onPress={() => void handleExportHistory()}
            >
              <Text style={styles.rowActionBtnText}>Export</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dangerZone}>
            {accountBacked && (
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert('Sign out', 'You will be signed out of your account.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                  ])
                }
              >
                <Text style={styles.actionBtnText}>Sign out</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.dangerBtn]}
              activeOpacity={0.85}
              onPress={handleReset}
            >
              <Text style={[styles.actionBtnText, styles.dangerBtnText]}>Delete my account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 18, paddingBottom: SCROLL_PADDING_BOTTOM },
  title: { fontSize: 30, fontFamily: t.font.display, color: t.color.textPrimary },
  section: { gap: 10 },
  sectionTitle: { fontSize: 21, fontFamily: t.font.display, color: t.color.textPrimary },

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
  navRow: {
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
  navChevron: { fontSize: 26, color: t.color.textTertiary, marginTop: -2 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  rowNote: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: t.font.body, color: t.color.textSecondary },

  usernameCard: {
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 16,
    gap: 10,
  },
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usernameInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: t.radius.button,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1.5,
    borderColor: t.color.border,
  },
  usernameAt: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.textTertiary,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: t.font.bodySemibold,
    color: t.color.textPrimary,
    padding: 0,
    includeFontPadding: false,
  },
  usernameError: { fontSize: 13, lineHeight: 19, fontFamily: t.font.bodySemibold, color: t.color.danger },
  usernameSuccess: { fontSize: 13, lineHeight: 19, fontFamily: t.font.bodySemibold, color: t.color.accent },

  rowActionBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: t.radius.button,
    backgroundColor: t.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: t.color.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  rowActionBtnDisabled: {
    opacity: 0.5,
  },
  rowActionBtnText: {
    fontSize: 13,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dangerZone: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: t.radius.button,
    backgroundColor: t.color.surface,
    borderWidth: 1.5,
    borderColor: t.color.border,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: t.font.bodySemibold,
    color: t.color.textSecondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dangerBtn: {
    borderColor: t.color.danger,
  },
  dangerBtnText: {
    color: t.color.danger,
    fontFamily: t.font.bodyBold,
  },
});
