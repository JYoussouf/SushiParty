import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_AVATAR, getAvatarCharacter } from '../lib/avatars';

interface AvatarProps {
  /** Character id (e.g. 'panda'), a legacy emoji string, or undefined. */
  value?: string | undefined;
  /** Rendered width/height in px. */
  size: number;
}

/**
 * Renders a profile avatar. Resolves a character id to its bundled image;
 * falls back to rendering a legacy emoji string as text; defaults to the
 * first character when no value is set.
 */
export function Avatar({ value, size }: AvatarProps) {
  const character = getAvatarCharacter(value) ?? (value ? undefined : getAvatarCharacter(DEFAULT_AVATAR));

  if (character) {
    return (
      <Image
        source={character.source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessible
        accessibilityLabel={character.name}
      />
    );
  }

  // Legacy avatar stored as a raw emoji — keep showing it as text.
  return (
    <View style={[styles.emojiWrap, { width: size, height: size }]}>
      <Text style={{ fontSize: Math.round(size * 0.82) }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
