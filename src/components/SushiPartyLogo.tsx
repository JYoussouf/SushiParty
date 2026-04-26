import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SushiPartyLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function SushiPartyLogo({ size = 'lg' }: SushiPartyLogoProps) {
  const scale = size === 'lg' ? 1 : size === 'md' ? 0.75 : 0.55;
  const baseSize = 68 * scale;
  return (
    <View style={styles.wrap}>
      <View style={[styles.line, { height: baseSize * 1.05 }]}>
        <Text
          style={[
            styles.shadow,
            { fontSize: baseSize, lineHeight: baseSize * 1.05, top: 4, left: 3 },
          ]}
        >
          Sushi
        </Text>
        <Text style={[styles.main, { fontSize: baseSize, lineHeight: baseSize * 1.05 }]}>
          Sushi
        </Text>
      </View>
      <View style={[styles.line, { height: baseSize * 1.05, marginLeft: baseSize * 0.6 }]}>
        <Text
          style={[
            styles.shadow,
            { fontSize: baseSize, lineHeight: baseSize * 1.05, top: 4, left: 3 },
          ]}
        >
          Party
        </Text>
        <Text style={[styles.main, { fontSize: baseSize, lineHeight: baseSize * 1.05 }]}>
          Party
        </Text>
        <Text
          style={[
            styles.bang,
            { fontSize: baseSize, lineHeight: baseSize * 1.05 },
          ]}
        >
          !
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2,
    opacity: 0.22,
  },
  main: {
    color: '#e53935',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2,
  },
  bang: {
    color: '#fdd835',
    fontWeight: '900',
    fontStyle: 'italic',
    marginLeft: -4,
  },
  dotSushi: {
    position: 'absolute',
    right: 0,
  },
});
