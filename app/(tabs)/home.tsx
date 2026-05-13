import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SushiPartyLogo } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSession } from '../../src/hooks/useSession';
import { useMenu } from '../../src/hooks/useMenu';
import { getAllSessions } from '../../src/lib/local/sessions';
import { getItemEmoji } from '../../src/lib/itemEmoji';
import type { Menu, SushiSession } from '../../src/types';

interface HomeButton {
  label: string;
  emoji: string;
  onPress: () => void;
}

const SUBTITLES = [
  "Tonight's lineup is waiting.",
  'Hands washed. Bellies empty. Let’s go.',
  'The fish know you’re coming.',
  'Soy sauce armed. Wasabi engaged.',
  'Some legends are written one piece at a time.',
  'Rice loaded. Friends synced.',
  'It’s roll call.',
  'Conveyor belt loading…',
  'Make tonight a feast worth retelling.',
  'Chopsticks up. Phones down. Mostly.',
];

type Card =
  | { kind: 'wisdom';    ribbon: string; quote: string; author: string; emoji: string; tag: string }
  | { kind: 'trivia';    ribbon: string; headline: string; detail: string; emoji: string; tag: string }
  | { kind: 'history';   ribbon: string; headline: string; detail: string; emoji: string; tag: string }
  | { kind: 'vibe';      ribbon: string; mood: string; sub: string; emoji: string; tag: string }
  | { kind: 'stat';      ribbon: string; title: string; sub: string; emoji: string; tag: string };

const CARDS: Card[] = [
  // ── Wisdom / mantras ───────────────────────────────────────────────────────
  { kind: 'wisdom', ribbon: 'Wisdom',  quote: 'The first bite knows',                author: 'old sushi proverb',     emoji: '🥢', tag: 'Proverb' },
  { kind: 'wisdom', ribbon: 'Mantra',  quote: 'Eat slowly. Order boldly',            author: 'a wise itamae',         emoji: '🌊', tag: 'Mantra' },
  { kind: 'wisdom', ribbon: 'Wisdom',  quote: 'Rice is the dish. Fish is the guest', author: 'edomae principle',      emoji: '🌾', tag: 'Proverb' },
  { kind: 'wisdom', ribbon: 'Mantra',  quote: 'Ten years to master the rice',        author: 'sushi apprentices',     emoji: '⏳', tag: 'Mantra' },

  // ── Trivia (modern, behind-the-scenes) ─────────────────────────────────────
  { kind: 'trivia', ribbon: 'Did you know', headline: 'It’s rarely real wasabi',     detail: 'About 95% of restaurants serve dyed horseradish.',         emoji: '🌶', tag: 'Trivia' },
  { kind: 'trivia', ribbon: 'Did you know', headline: 'Sushi rice has a temperature', detail: 'Body warmth — about 36°C, by tradition.',                  emoji: '🌾', tag: 'Trivia' },
  { kind: 'trivia', ribbon: 'Did you know', headline: 'Soy sauce is for the fish',    detail: 'Dipping rice-side first makes it fall apart — and salty.', emoji: '🥢', tag: 'Trivia' },
  { kind: 'trivia', ribbon: 'Did you know', headline: 'Ginger is a palate cleanser',  detail: 'Eat it between pieces, never on top of them.',             emoji: '🫚', tag: 'Trivia' },
  { kind: 'trivia', ribbon: 'Did you know', headline: 'Toro is the belly of tuna',    detail: 'Three grades: akami, chū-toro, ō-toro — fattier each time.', emoji: '🐟', tag: 'Trivia' },
  { kind: 'trivia', ribbon: 'Did you know', headline: 'Real chefs don’t wear gloves', detail: 'Bare-hand contact lets them feel rice tension exactly.',   emoji: '🍙', tag: 'Trivia' },
  { kind: 'trivia', ribbon: 'Did you know', headline: 'Nigiri means “two fingers”',   detail: 'Roughly the size you’re meant to shape it into.',          emoji: '✌️', tag: 'Trivia' },

  // ── History (origin stories) ───────────────────────────────────────────────
  { kind: 'history', ribbon: 'Sushi history', headline: 'It started as fish jerky',    detail: 'Narezushi — fermented carp wrapped in rice, ~4th century BC.',   emoji: '📜', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'Edomae was Tokyo street food', detail: 'Fast nigiri served from carts in 1820s Edo, hand-pressed to order.', emoji: '🏮', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'A 1923 quake spread it',       detail: 'After the Kantō earthquake, Tokyo chefs scattered nigiri across Japan.', emoji: '🗾', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'Conveyor belts began in ’58',  detail: 'Yoshiaki Shiraishi opened the first kaiten-zushi in Osaka.',     emoji: '🍱', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'Nori was once handmade paper', detail: 'Workers pressed and dried algae sheets like washi until the 1940s.', emoji: '🟩', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'Salmon was a 1980s import',    detail: 'Norway sold Japan on raw salmon — it wasn’t traditional sushi before.', emoji: '🐟', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'Wasabi grows in cold streams', detail: 'Cultivated in mountain riverbeds since the 1500s in Shizuoka.',   emoji: '🍃', tag: 'Origin' },
  { kind: 'history', ribbon: 'Sushi history', headline: 'Itamae train for a decade',    detail: 'Two years on rice alone before they’re trusted to touch fish.',  emoji: '👨‍🍳', tag: 'Origin' },

  // ── Vibe ───────────────────────────────────────────────────────────────────
  { kind: 'vibe', ribbon: 'Tonight’s mood', mood: 'Main character energy',        sub: 'Order what your soul wants.',  emoji: '🌙', tag: 'Vibe' },
  { kind: 'vibe', ribbon: 'Vibe check',     mood: 'Slow chews. Sharp memory',     sub: 'You’ll remember this one.',    emoji: '✨', tag: 'Vibe' },
  { kind: 'vibe', ribbon: 'Energy reading', mood: 'Salmon-forward. Soy-balanced', sub: 'Your aura, technically.',      emoji: '🔥', tag: 'Energy' },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function computeStatCards(sessions: SushiSession[], uid: string | undefined, menu: Menu): Card[] {
  if (!uid || sessions.length === 0) return [];

  const mine = sessions.filter((s) =>
    s.participants.some((p) => p.userId === uid),
  );
  if (mine.length === 0) return [];

  const cards: Card[] = [];

  // Item totals (strip optional ":size" suffix to get base item id)
  const itemTotals = new Map<string, number>();
  let totalPieces = 0;
  for (const session of mine) {
    for (const participant of session.participants) {
      if (participant.userId !== uid) continue;
      for (const [key, count] of Object.entries(participant.counts)) {
        const id = key.split(':')[0]!;
        itemTotals.set(id, (itemTotals.get(id) ?? 0) + count);
        totalPieces += count;
      }
    }
  }

  // Favorite piece
  let favItemId: string | null = null;
  let favItemCount = 0;
  for (const [id, count] of itemTotals) {
    if (count > favItemCount) {
      favItemId = id;
      favItemCount = count;
    }
  }
  if (favItemId && favItemCount > 0) {
    const item = menu.items.find((it) => it.id === favItemId);
    if (item) {
      cards.push({
        kind: 'stat',
        ribbon: 'Your favorite',
        title: item.name,
        sub: `${favItemCount} ${favItemCount === 1 ? 'piece' : 'pieces'} so far`,
        emoji: getItemEmoji(item.imageKey, item.category),
        tag: 'Top order',
      });
    }
  }

  // Favorite restaurant
  const restaurantCounts = new Map<string, { parties: number; pieces: number }>();
  for (const session of mine) {
    if (!session.restaurantName || session.restaurantName === 'Unknown Restaurant') continue;
    const me = session.participants.find((p) => p.userId === uid);
    if (!me) continue;
    const pieces = Object.values(me.counts).reduce((a, b) => a + b, 0);
    const entry = restaurantCounts.get(session.restaurantName) ?? { parties: 0, pieces: 0 };
    entry.parties += 1;
    entry.pieces += pieces;
    restaurantCounts.set(session.restaurantName, entry);
  }
  let favRestaurant: string | null = null;
  let favRestaurantStats = { parties: 0, pieces: 0 };
  for (const [name, stats] of restaurantCounts) {
    if (stats.parties > favRestaurantStats.parties) {
      favRestaurant = name;
      favRestaurantStats = stats;
    }
  }
  if (favRestaurant && favRestaurantStats.parties >= 2) {
    cards.push({
      kind: 'stat',
      ribbon: 'Your spot',
      title: favRestaurant,
      sub: `${favRestaurantStats.parties} parties · ${favRestaurantStats.pieces} pieces`,
      emoji: '📍',
      tag: 'Favorite',
    });
  }

  // Lifetime tally
  if (mine.length >= 3) {
    cards.push({
      kind: 'stat',
      ribbon: 'Lifetime',
      title: `${totalPieces} pieces`,
      sub: `across ${mine.length} parties`,
      emoji: '🍣',
      tag: 'Total',
    });
  }

  // Last party recap
  const sortedByDate = [...mine].sort((a, b) =>
    (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt),
  );
  const last = sortedByDate[0];
  if (last && last.restaurantName && last.restaurantName !== 'Unknown Restaurant') {
    const me = last.participants.find((p) => p.userId === uid);
    const pieces = me ? Object.values(me.counts).reduce((a, b) => a + b, 0) : 0;
    const days = Math.max(0, Math.floor(
      (Date.now() - new Date(last.submittedAt ?? last.startedAt).getTime()) / 86_400_000,
    ));
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    cards.push({
      kind: 'stat',
      ribbon: 'Last visit',
      title: last.restaurantName,
      sub: `${when} · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`,
      emoji: '🕒',
      tag: 'Recent',
    });
  }

  return cards;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const { participants, currentUserParticipantIndex, groupCode, hasActiveSession } = useSession();
  const { activeMenu } = useMenu();
  const avatar = participants[currentUserParticipantIndex]?.avatar ?? '🐱';

  // Refresh on every mount — gives the app a different feel each open.
  const subtitle = useMemo(() => pickRandom(SUBTITLES), []);
  const [card, setCard] = useState<Card>(() => pickRandom(CARDS));

  useEffect(() => {
    let alive = true;
    void getAllSessions().then((sessions) => {
      if (!alive) return;
      const stats = computeStatCards(sessions, userProfile?.uid, activeMenu);
      // Weight stats slightly so personal data appears more often than static fluff.
      const pool: Card[] = stats.length > 0 ? [...CARDS, ...stats, ...stats] : CARDS;
      setCard(pickRandom(pool));
    });
    return () => { alive = false; };
  }, [userProfile?.uid, activeMenu]);

  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(16);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));
  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    cardY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, []);

  const buttons: HomeButton[] = hasActiveSession
    ? [
        {
          label: groupCode ? 'Resume Lobby' : 'Resume Scoreboard',
          emoji: groupCode ? '🎉' : '🍣',
          onPress: () => router.push(groupCode ? '/session/lobby' : '/session/scoreboard'),
        },
      ]
    : [
        {
          label: 'Start a Sushi Party',
          emoji: '🎉',
          onPress: () => router.push('/session/mode-select'),
        },
        {
          label: 'Join with code',
          emoji: '🔗',
          onPress: () => router.push('/session/group-join'),
        },
      ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile')}>
          <View style={styles.profileAvatarBadge}>
            <Text style={styles.profileAvatar}>{avatar}</Text>
          </View>
          {userProfile?.displayName ? (
            <Text style={styles.profileName} numberOfLines={1}>{userProfile.displayName}</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <SushiPartyLogo size="lg" />
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>

      {/* Rotating "plate" card */}
      <Animated.View style={[styles.plateWrap, cardStyle]}>
        <View style={styles.plate}>
          <View style={styles.plateLeft}>
            <View style={styles.ribbon}>
              <Text style={styles.ribbonText}>{card.ribbon}</Text>
            </View>
            {card.kind === 'wisdom' && (
              <>
                <Text style={styles.plateQuote}>“{card.quote}”</Text>
                <Text style={styles.plateSub}>— {card.author}</Text>
              </>
            )}
            {card.kind === 'trivia' && (
              <>
                <Text style={styles.plateHeadline}>{card.headline}</Text>
                <Text style={styles.plateSub}>{card.detail}</Text>
              </>
            )}
            {card.kind === 'history' && (
              <>
                <Text style={styles.plateHeadline}>{card.headline}</Text>
                <Text style={styles.plateSub}>{card.detail}</Text>
              </>
            )}
            {card.kind === 'vibe' && (
              <>
                <Text style={styles.plateTitle}>{card.mood}</Text>
                <Text style={styles.plateSub}>{card.sub}</Text>
              </>
            )}
            {card.kind === 'stat' && (
              <>
                <Text style={styles.plateTitle} numberOfLines={2}>{card.title}</Text>
                <Text style={styles.plateSub}>{card.sub}</Text>
              </>
            )}
          </View>

          <View style={styles.plateRight}>
            <Text style={styles.plateEmoji}>{card.emoji}</Text>
          </View>
        </View>
      </Animated.View>

      {/* CTAs */}
      <Animated.View style={[styles.buttons, cardStyle]}>
        {buttons.map((btn, i) => (
          <TouchableOpacity
            key={btn.label}
            style={i === 0 ? styles.buttonPrimary : styles.buttonSecondary}
            onPress={btn.onPress}
            activeOpacity={0.82}
          >
            <Text style={styles.buttonEmoji}>{btn.emoji}</Text>
            <Text style={i === 0 ? styles.buttonLabelPrimary : styles.buttonLabelSecondary}>
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf2',
  },

  // ── Top bar ─────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 46,
    paddingLeft: 4,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.07)',
    shadowColor: '#28160c',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    maxWidth: 220,
  },
  profileAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff4d7',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#28160c',
    shadowOpacity: 0.13,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  profileAvatar: {
    fontSize: 18,
    lineHeight: 23,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#21160d',
    flexShrink: 1,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.07)',
    shadowColor: '#28160c',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  settingsIcon: {
    fontSize: 21,
    lineHeight: 25,
  },

  // ── Hero ────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 96,
    paddingHorizontal: 24,
    gap: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#7a6452',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Plate (rotating) card ───────────────────────────────
  plateWrap: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fdf3e3',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.06)',
    shadowColor: '#28160c',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  plateLeft: {
    flex: 1,
    paddingRight: 16,
  },
  plateRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  ribbon: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffe5e0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ribbonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b3372d',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  plateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#21160d',
    letterSpacing: -0.5,
    marginTop: 10,
    lineHeight: 28,
  },
  plateQuote: {
    fontSize: 22,
    fontWeight: '600',
    color: '#21160d',
    fontStyle: 'italic',
    letterSpacing: -0.3,
    marginTop: 10,
    lineHeight: 28,
  },
  plateHeadline: {
    fontSize: 19,
    fontWeight: '700',
    color: '#21160d',
    letterSpacing: -0.3,
    marginTop: 10,
    lineHeight: 24,
  },
  plateSub: {
    fontSize: 13,
    color: '#7a6452',
    marginTop: 6,
    lineHeight: 18,
  },
  plateEmoji: {
    fontSize: 36,
    lineHeight: 42,
  },

  // ── CTAs ────────────────────────────────────────────────
  buttons: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 10,
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#ee5d52',
    shadowColor: '#ee5d52',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(40,22,12,0.12)',
    shadowColor: '#28160c',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  buttonLabelPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fffaf2',
    letterSpacing: -0.2,
  },
  buttonLabelSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#21160d',
    letterSpacing: -0.2,
  },
});
