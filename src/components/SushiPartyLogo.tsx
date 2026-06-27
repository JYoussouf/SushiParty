import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface SushiPartyLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function SushiPartyLogo({ size = 'lg' }: SushiPartyLogoProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const scale = size === 'lg' ? 1 : size === 'md' ? 0.75 : 0.55;

  if (t.name === 'tokyo') {
    // Elegant serif wordmark — "sushi party", party in coral/pink.
    const fontSize = 52 * scale;
    return (
      <View style={styles.tokyoWrap}>
        <Text style={[styles.tokyoWord, { fontSize, lineHeight: fontSize * 1.1 }]}>
          sushi <Text style={styles.tokyoAccent}>party</Text>
        </Text>
      </View>
    );
  }

  // Classic pixel/bold look (two stacked lines).
  const baseSize = 68 * scale;
  return (
    <View style={styles.wrap}>
      <View style={[styles.line, { height: baseSize * 1.05 }]}>
        <Text style={[styles.shadow, { fontSize: baseSize, lineHeight: baseSize * 1.05, top: 4, left: 3 }]}>Sushi</Text>
        <Text style={[styles.main, { fontSize: baseSize, lineHeight: baseSize * 1.05 }]}>Sushi</Text>
      </View>
      <View style={[styles.line, { height: baseSize * 1.05, marginLeft: baseSize * 0.6 }]}>
        <Text style={[styles.shadow, { fontSize: baseSize, lineHeight: baseSize * 1.05, top: 4, left: 3 }]}>Party</Text>
        <Text style={[styles.main, { fontSize: baseSize, lineHeight: baseSize * 1.05 }]}>Party</Text>
        <Text style={[styles.bang, { fontSize: baseSize, lineHeight: baseSize * 1.05 }]}>!</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // Tokyo serif wordmark
  tokyoWrap: {
    alignItems: 'center',
  },
  tokyoWord: {
    fontFamily: t.font.displayItalic,
    fontStyle: 'italic',
    color: t.color.textPrimary,
    letterSpacing: -1,
  },
  tokyoAccent: {
    color: t.color.accent,
    fontFamily: t.font.displayItalic,
    fontStyle: 'italic',
  },
  // Classic
  wrap: {
    alignItems: 'flex-start',
    gap: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    color: '#2b1e1c',
    fontFamily: t.font.display,
    fontStyle: 'italic',
    letterSpacing: -2,
    opacity: 0.22,
  },
  main: {
    color: t.color.accent,
    fontFamily: t.font.display,
    fontStyle: 'italic',
    letterSpacing: -2,
  },
  bang: {
    color: '#fdd835',
    fontFamily: t.font.display,
    fontStyle: 'italic',
    marginLeft: -4,
  },
});
