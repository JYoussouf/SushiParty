import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';
import type { WrappedStats } from '../lib/wrappedStats';

interface WrappedCardProps {
  stats: WrappedStats;
  displayName: string;
  avatar?: string | undefined;
  /** Card width in px. Height derives from a 9:16-ish story ratio. */
  width: number;
}

// A self-contained, high-contrast "year in review" card designed to rasterize
// cleanly for sharing to stories. Deliberately simple — one hero number and a
// few supporting chips, Spotify-Wrapped style.
export const WrappedCard = forwardRef<View, WrappedCardProps>(function WrappedCard(
  { stats, displayName, avatar, width },
  ref,
) {
  const t = useTheme();
  const height = Math.round(width * 1.7);
  const styles = React.useMemo(() => makeStyles(t, width, height), [t, width, height]);

  return (
    <View ref={ref} collapsable={false} style={styles.canvas}>
      <LinearGradient
        colors={['#3A1078', '#B0228C', '#E53935']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>SUSHI PARTY</Text>
            <Text style={styles.wrapped}>Wrapped</Text>
          </View>
          <View style={styles.avatarWrap}>
            <Avatar value={avatar} size={48} />
          </View>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {stats.totalPieces.toLocaleString()}
          </Text>
          <Text style={styles.heroLabel}>pieces of sushi</Text>
          <Text style={styles.heroSub}>
            across {stats.totalParties} part{stats.totalParties === 1 ? 'y' : 'ies'}, {displayName}
          </Text>
        </View>

        <View style={styles.chipRow}>
          <Chip styles={styles} value={String(stats.distinctRestaurants)} label="spots" />
          <Chip styles={styles} value={String(stats.biggestParty)} label="biggest party" />
          <Chip styles={styles} value={`Lv ${stats.level}`} label={stats.levelTitle} />
        </View>

        <View style={styles.factList}>
          {stats.favoriteRestaurant ? (
            <Fact styles={styles} label="Favourite spot" value={stats.favoriteRestaurant} />
          ) : null}
          {stats.topDish ? (
            <Fact styles={styles} label="Top dish" value={stats.topDish} />
          ) : null}
          {stats.topCategory ? (
            <Fact styles={styles} label="Go-to style" value={stats.topCategory} />
          ) : null}
        </View>

        <Text style={styles.footer}>🍣 sushi party</Text>
      </View>
    </View>
  );
});

function Chip({ styles, value, label }: { styles: Styles; value: string; label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Fact({ styles, label, value }: { styles: Styles; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (t: Theme, width: number, height: number) =>
  StyleSheet.create({
    canvas: {
      width,
      height,
      borderRadius: 28,
      overflow: 'hidden',
    },
    inner: { flex: 1, padding: 28, justifyContent: 'space-between' },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    kicker: {
      fontSize: 13,
      fontFamily: t.font.bodyBold,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 2,
    },
    wrapped: { fontSize: 40, fontFamily: t.font.display, color: '#FFFFFF', marginTop: 2 },
    avatarWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    heroBlock: { alignSelf: 'stretch', alignItems: 'flex-start', gap: 2 },
    heroNumber: {
      alignSelf: 'stretch',
      fontSize: Math.min(88, width * 0.24),
      lineHeight: Math.min(92, width * 0.25),
      fontFamily: t.font.display,
      color: '#FFFFFF',
    },
    heroLabel: { fontSize: 22, fontFamily: t.font.bodyBold, color: '#FFFFFF' },
    heroSub: { fontSize: 15, fontFamily: t.font.body, color: 'rgba(255,255,255,0.82)', marginTop: 6 },
    chipRow: { flexDirection: 'row', gap: 10 },
    chip: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 3,
    },
    chipValue: { fontSize: 20, fontFamily: t.font.bodyBold, color: '#FFFFFF' },
    chipLabel: {
      fontSize: 11,
      fontFamily: t.font.bodySemibold,
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'center',
    },
    factList: { gap: 10 },
    fact: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.25)',
      paddingBottom: 8,
      gap: 12,
    },
    factLabel: { fontSize: 14, fontFamily: t.font.bodySemibold, color: 'rgba(255,255,255,0.78)' },
    factValue: { flex: 1, fontSize: 15, fontFamily: t.font.bodyBold, color: '#FFFFFF', textAlign: 'right' },
    footer: {
      fontSize: 15,
      fontFamily: t.font.bodyBold,
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 0.5,
    },
  });
