import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';

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
      />
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelText}>Silent</Text>
        <Text style={styles.sliderLabelText}>Full</Text>
      </View>
    </View>
  );
}

export default function VolumeScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

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

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Sound & Music</Text>
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
    scroll: { padding: 20, gap: 16 },
    title: { fontSize: 28, fontFamily: t.font.display, color: t.color.textPrimary },
    soundCard: {
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      overflow: 'hidden',
    },
    soundDivider: { height: 1, backgroundColor: t.color.border, marginHorizontal: 16 },
    volumeCard: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    volumeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    volumeIcon: { fontSize: 18 },
    volumeLabel: { fontSize: 15, fontFamily: t.font.bodyBold, color: t.color.textPrimary, flex: 1 },
    volumePercent: { minWidth: 36, alignItems: 'flex-end' },
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
    muteBtnActive: { backgroundColor: t.color.accentSoft, borderColor: t.color.accent },
    muteIcon: { fontSize: 16 },
    slider: { width: '100%', height: 36, marginHorizontal: -4 },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4, paddingHorizontal: 2 },
    sliderLabelText: { fontSize: 10, color: t.color.textTertiary, fontFamily: t.font.bodySemibold, letterSpacing: 0.3 },
  });
