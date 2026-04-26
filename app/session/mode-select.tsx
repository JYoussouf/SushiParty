import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import {
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
import { CAT_AVATARS } from '../../src/lib/catAvatars';
import { useSession } from '../../src/hooks/useSession';
import { useAuth } from '../../src/contexts/AuthContext';

const EMOTES = ['👋', '🎉', '🍣', '🔥', '😂'] as const;

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
      <TouchableOpacity onPress={onPress} style={styles.emoteButton} activeOpacity={0.7}>
        <Text style={styles.emoteButtonText}>{emoji}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const SPRING_CFG = { damping: 32, stiffness: 260, mass: 1 };

function ReactionToggle({ onEmote }: { onEmote: (emoji: string) => void }) {
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

export default function SessionModeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { userProfile } = useAuth();
  const {
    participants,
    groupCode,
    groupOwnerUid,
    currentUserParticipantIndex,
    setParticipantAvatar,
    createGroup,
    setMode,
  } = useSession();
  const isHost = !!userProfile && userProfile.uid === groupOwnerUid;
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [emoteBursts, setEmoteBursts] = useState<
    Array<{
      id: string;
      emoji: string;
      originX: number;
      originY: number;
      drift: number;
    }>
  >([]);

  const myAvatar = participants[currentUserParticipantIndex]?.avatar ?? '🐱';
  const reactionTravel = Math.max(320, height * 0.72);
  const joinLink = useMemo(
    () =>
      groupCode
        ? Linking.createURL('/session/group-join', { queryParams: { code: groupCode } })
        : null,
    [groupCode],
  );
  const removeEmote = useCallback((id: string) => {
    setEmoteBursts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const sendEmote = (emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const originX = 8 + Math.random() * 84;
    const originY = 58 + Math.random() * 32;
    const drift = Math.floor(Math.random() * 121) - 60;
    setEmoteBursts((prev) => [...prev, { id, emoji, originX, originY, drift }]);
  };

  if (!groupCode) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Start a Sushi Party</Text>
            <Text style={styles.title}>Pick the vibe</Text>
            <Text style={styles.subtitle}>
              Go solo if it’s just you, or open a lobby so friends can pile in with a code.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.choiceCard, creatingGroup && { opacity: 0.6 }]}
            disabled={creatingGroup}
            onPress={() => {
              setCreatingGroup(true);
              setCreateGroupError(null);
              createGroup()
                .catch((err: unknown) => {
                  setCreateGroupError(err instanceof Error ? err.message : 'Failed to create group.');
                })
                .finally(() => setCreatingGroup(false));
            }}
          >
            <Text style={styles.choiceEmoji}>🎉</Text>
            <View style={styles.choiceBody}>
              <Text style={styles.choiceTitle}>
                {creatingGroup ? 'Creating…' : 'Party with Friends'}
              </Text>
              <Text style={styles.choiceText}>
                Open the lobby, share the code, swap cat avatars, and head to the scoreboard
                together.
              </Text>
            </View>
          </TouchableOpacity>

          {createGroupError ? (
            <Text style={styles.errorText}>{createGroupError}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.choiceCard, styles.choiceCardSolo]}
            onPress={() => {
              void setMode('single').then(() => {
                router.replace('/(tabs)/scoreboard');
              });
            }}
          >
            <Text style={styles.choiceEmoji}>🍣</Text>
            <View style={styles.choiceBody}>
              <Text style={styles.choiceTitle}>Solo Party</Text>
              <Text style={styles.choiceText}>
                Skip the lobby and jump straight into counting for a one-person sushi run.
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Party Lobby</Text>
          <Text style={styles.title}>Assemble your sushi crew</Text>
          {/* <Text style={styles.subtitle}>
            Share the code or flash the QR so friends can hop in. Start the Party when you’re ready!
          </Text> */}
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
          onPress={() => router.replace('/(tabs)/scoreboard')}
        >
          <Text style={styles.startButtonText}>
            {isHost ? 'Start the Party 🍣' : 'Join the Scoreboard 🍣'}
          </Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff5ec' },
  scroll: { padding: 20, gap: 18, paddingBottom: 30 },
  hero: {
    borderRadius: 28,
    padding: 22,
    gap: 8,
    backgroundColor: '#ffe4d1',
    borderWidth: 1,
    borderColor: '#f5c6aa',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#c46738',
  },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: '#2d2019' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6f594d' },
  codeCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#efd8ca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#aa6a49',
  },
  codeValue: { marginTop: 6, fontSize: 28, fontWeight: '900', letterSpacing: 3, color: '#df5a31' },
  qrFrame: {
    borderRadius: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ead5ca',
  },
  qrHint: { marginTop: -6, fontSize: 13, color: '#7f695d' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 21, fontWeight: '900', color: '#2d2019' },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  choiceCardSolo: {
    backgroundColor: '#fff7f0',
  },
  choiceEmoji: { fontSize: 34 },
  choiceBody: { flex: 1, gap: 4 },
  choiceTitle: { fontSize: 18, fontWeight: '900', color: '#2d2019' },
  choiceText: { fontSize: 14, lineHeight: 20, color: '#7f695d' },
  participantList: { gap: 10 },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#fffdf9',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  participantCardMe: { borderColor: '#f0a57f', backgroundColor: '#fff6ef' },
  participantAvatar: { fontSize: 30 },
  participantBody: { flex: 1, gap: 2 },
  participantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantName: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: '#2d2019' },
  participantMeta: { fontSize: 13, color: '#7f695d' },
  reactionPill: {
    height: 34,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    gap: 1,
    backgroundColor: 'rgba(255, 253, 249, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(239, 216, 202, 0.95)',
    shadowColor: '#c46738',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#efd8ca',
  },
  avatarButtonSelected: { borderColor: '#df5a31', backgroundColor: '#fff0e6' },
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
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    backgroundColor: '#2d2019',
  },
  startButtonText: { fontSize: 16, fontWeight: '900', color: '#fff7f1' },
  errorText: { fontSize: 14, color: '#c0392b', textAlign: 'center' },
});
