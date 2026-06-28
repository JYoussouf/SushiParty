import React from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';
import { getItemSprite } from '../lib/itemSprites';

type Props = {
  imageKey: string | undefined;
  category: string | undefined;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * Renders the kawaii pixel sprite for a menu item (24px art exported at 96px),
 * replacing the old per-item emoji. Falls back to the category hero sprite, then
 * a neutral default, so every item always resolves to an image.
 */
export function ItemSprite({ imageKey, category, size = 32, style }: Props) {
  return (
    <Image
      source={getItemSprite(imageKey, category)}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}
