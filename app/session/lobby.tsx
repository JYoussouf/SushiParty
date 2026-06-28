import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';
import { BackButton } from '../../src/components';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CAT_AVATARS } from '../../src/lib/catAvatars';
import { useSession } from '../../src/hooks/useSession';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';

const EMOTES = ['👋', '🎉', '🍣', '🔥', '😂'] as const;

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

// toggle(28) + 5×emote(30) + 6×gap(3) + padding(3×2) = 206
const PILL_WIDTH = 206;

function AnimatedEmote({
  emoji,
  index,
  progress,
  onPress,
}: {
  emoji: string;
  index: number;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const style = useAnimatedStyle(() => {
    const start = (index + 1) * 0.1;
    const p = Math.max(0, Math.min(1, (progress.value - start) / (1 - start)));
    return {
      opacity: p,
      transform: [{ scale: interpolate(p, [0, 0.65, 1], [0.2, 1.2, 1]) }],
    };
  });

  return (
    <Animated.View style={style}>
      <TouchableOpacity onPress={onPress} style={styles.emoteButton} activeOpacity={0.7} hitSlop={{ top: 7, bottom: 7 }}>
        <Text style={styles.emoteButtonText}>{emoji}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const SPRING_CFG = { damping: 32, stiffness: 260, mass: 1 };

function ReactionToggle({ onEmote }: { onEmote: (emoji: string) => void }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const progress = useSharedValue(0);
  const openRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    openRef.current = !openRef.current;
    setIsOpen(openRef.current);
    progress.value = withSpring(openRef.current ? 1 : 0, SPRING_CFG);
  };

  const pillStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [34, PILL_WIDTH]),
  }));

  return (
    <Animated.View style={[styles.reactionPill, pillStyle]}>
      <TouchableOpacity onPress={toggle} style={styles.waveButton} activeOpacity={0.75}>
        <Text style={styles.waveButtonText}>{isOpen ? '→' : '👋'}</Text>
      </TouchableOpacity>
      {EMOTES.map((emoji, i) => (
        <AnimatedEmote
          key={emoji}
          emoji={emoji}
          index={i}
          progress={progress}
          onPress={() => onEmote(emoji)}
        />
      ))}
    </Animated.View>
  );
}

function FloatingEmote({
  id,
  emoji,
  originX,
  originY,
  drift,
  travel,
  onDone,
}: {
  id: string;
  emoji: string;
  originX: number;
  originY: number;
  drift: number;
  travel: number;
  onDone: (id: string) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: 1700, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onDone)(id);
        }
      },
    );
  }, [id, onDone, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: -progress.value * travel },
      { translateX: drift * progress.value },
      { scale: 0.85 + progress.value * 0.55 },
      { rotate: `${drift * progress.value * 0.12}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.floatingEmote, { left: `${originX}%`, top: `${originY}%` }, style]}
    >
      <Text style={styles.floatingEmoteText}>{emoji}</Text>
    </Animated.View>
  );
}

export default function LobbyScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { userProfile } = useAuth();
  const {
    participants,
    groupCode,
    groupSessionId,
    groupOwnerUid,
    currentUserParticipantIndex,
    setParticipantAvatar,
    setMode,
  } = useSession();
  const isHost = !!userProfile && userProfile.uid === groupOwnerUid;
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [emoteBursts, setEmoteBursts] = useState<
    Array<{ id: string; emoji: string; originX: number; originY: number; drift: number }>
  >([]);

  const myAvatar = participants[currentUserParticipantIndex]?.avatar ?? '🐱';
  const reactionTravel = Math.max(320, height * 0.72);

  useEffect(() => {
    if (!groupSessionId || !groupCode) {
      router.replace('/(tabs)/home');
    }
  }, [groupCode, groupSessionId, router]);

  const joinLink = useMemo(
    () =>
      groupCode
        ? Linking.createURL('/session/group-join', { queryParams: { code: groupCode } })
        : null,
    [groupCode],
  );

  const confirmLeave = useCallback(() => {
    Alert.alert(
      'Leave lobby?',
      isHost
        ? 'Closing the lobby will cancel the party for everyone.'
        : 'You will be removed from this party.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            void setMode('single').then(() => router.replace('/(tabs)/home'));
          },
        },
      ],
    );
  }, [isHost, router, setMode]);

  const removeEmote = useCallback((id: string) => {
    setEmoteBursts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const sendEmote = (emoji: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const originX = 8 + Math.random() * 84;
    const originY = 58 + Math.random() * 32;
    const drift = Math.floor(Math.random() * 121) - 60;
    setEmoteBursts((prev) => [...prev, { id, emoji, originX, originY, drift }]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <View style={styles.navBar}>
        <BackButton onPress={confirmLeave} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Party Lobby</Text>
          <Text style={styles.title}>Assemble your sushi crew</Text>
        </View>

        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeLabel}>Join code</Text>
            <Text style={styles.codeValue}>{groupCode ?? '------'}</Text>
          </View>
          <View style={styles.qrFrame}>
            {joinLink ? <QRCode value={joinLink} size={126} /> : null}
          </View>
        </View>
        <Text style={styles.qrHint}>Scan with your phone camera to open this party directly.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Party</Text>
          <View style={styles.participantList}>
            {participants.map((participant, index) => {
              const isMe = index === currentUserParticipantIndex;
              return (
                <View
                  key={participant.userId}
                  style={[styles.participantCard, isMe && styles.participantCardMe]}
                >
                  <Text style={styles.participantAvatar}>{participant.avatar ?? '🐱'}</Text>
                  <View style={styles.participantBody}>
                    <View style={styles.participantNameRow}>
                      <Text style={styles.participantName} numberOfLines={1}>
                        {participant.displayName}
                        {isMe ? ' (You)' : ''}
                      </Text>
                      <ReactionToggle onEmote={sendEmote} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.avatarRow}>
            {CAT_AVATARS.map((avatar) => {
              const selected = avatar === myAvatar;
              return (
                <TouchableOpacity
                  key={avatar}
                  style={[styles.avatarButton, selected && styles.avatarButtonSelected]}
                  onPress={() => void setParticipantAvatar(avatar)}
                >
                  <Text style={styles.avatarButtonText}>{avatar}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.85}
          onPress={() => {
            logPartyFlow('lobby start pressed, replace party-intro', { groupCode, groupSessionId });
            router.replace('/session/party-intro');
          }}
        >
          <LinearGradient
            colors={t.color.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startButtonInner}
          >
            <Text style={styles.startButtonText}>
              {isHost ? 'Start the Party 🍣' : 'Join the Scoreboard 🍣'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
      <View pointerEvents="none" style={styles.reactionOverlay}>
        {emoteBursts.map((burst) => (
          <FloatingEmote
            key={burst.id}
            id={burst.id}
            emoji={burst.emoji}
            originX={burst.originX}
            originY={burst.originY}
            drift={burst.drift}
            travel={reactionTravel}
            onDone={removeEmote}
          />
        ))}
      </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  safe: { flex: 1 },
  navBar: { paddingHorizontal: 16, paddingVertical: 8 },
  scroll: { padding: 20, gap: 18, paddingBottom: 30 },
  hero: {
    borderRadius: t.radius.lg,
    padding: 22,
    gap: 8,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: t.font.bodyBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: t.color.accent,
  },
  title: { fontSize: 30, lineHeight: 34, fontFamily: t.font.display, color: t.color.textPrimary },
  codeCard: {
    borderRadius: t.radius.lg,
    padding: 18,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: t.font.bodyBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: t.color.textSecondary,
  },
  codeValue: { marginTop: 6, fontSize: 28, fontFamily: t.font.display, letterSpacing: 3, color: t.color.accent },
  qrFrame: {
    borderRadius: t.radius.md,
    padding: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: t.color.border,
  },
  qrHint: { marginTop: -6, fontSize: 13, fontFamily: t.font.body, color: t.color.textSecondary },
  section: { gap: 10 },
  sectionTitle: { fontSize: 21, fontFamily: t.font.display, color: t.color.textPrimary },
  participantList: { gap: 10 },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: t.radius.md,
    padding: 14,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  participantCardMe: { borderColor: t.color.accent, backgroundColor: t.color.accentSoft },
  participantAvatar: { fontSize: 30 },
  participantBody: { flex: 1, gap: 2 },
  participantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantName: { flexShrink: 1, fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.textPrimary },
  reactionPill: {
    height: 34,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    gap: 1,
    backgroundColor: t.color.surfaceAlt,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  waveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveButtonText: { fontSize: 16 },
  emoteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoteButtonText: { fontSize: 18 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  avatarButtonSelected: { borderColor: t.color.accent, backgroundColor: t.color.accentSoft },
  avatarButtonText: { fontSize: 24 },
  reactionOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  floatingEmote: {
    position: 'absolute',
    marginLeft: -18,
  },
  floatingEmoteText: { fontSize: 36 },
  startButton: {
    marginTop: 8,
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  startButtonInner: {
    borderRadius: t.radius.button,
    paddingVertical: 17,
    alignItems: 'center',
  },
  startButtonText: { fontSize: 16, fontFamily: t.font.bodyBold, color: t.color.onAccent },
});
