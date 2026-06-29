import React, { useEffect } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getItemIdleSheet } from '../lib/itemIdleSprites';
import { getItemSprite } from '../lib/itemSprites';

type Props = {
  imageKey: string | undefined;
  category: string | undefined;
  size?: number;
  /** When false, shows the static rest frame and runs no animation loop. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Each idle frame is held this long (ms); ~2.8fps, a calm kawaii hover.
const FRAME_MS = 180;

/**
 * Renders a menu item's 2-frame idle sprite SHEET (frame0 rest / frame1 raised 1px)
 * inside a clipped window and toggles between the frames on the UI thread. When
 * `active` is false it falls back to the crisp static single-frame sprite — so it's
 * cheap to leave mounted for items that aren't currently "alive".
 */
export function ItemSpriteIdle({ imageKey, category, size = 36, active = true, style }: Props) {
  const frame = useSharedValue(0); // 0 = rest frame, 1 = raised frame

  useEffect(() => {
    if (active) {
      // Discrete 2-frame toggle: hold a frame for FRAME_MS, then jump (duration 0) to the
      // other. A small random start delay de-syncs many sprites so the motion reads organic.
      frame.value = withDelay(
        Math.floor(Math.random() * 240),
        withRepeat(
          withSequence(
            withTiming(1, { duration: 0 }),
            withDelay(FRAME_MS, withTiming(0, { duration: 0 })),
            withDelay(FRAME_MS, withTiming(1, { duration: 0 })),
          ),
          -1,
        ),
      );
    } else {
      cancelAnimation(frame);
      frame.value = 0;
    }
    return () => cancelAnimation(frame);
  }, [active, frame]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -size * frame.value }],
  }));

  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      {active ? (
        <Animated.View style={sheetStyle}>
          <Image
            source={getItemIdleSheet(imageKey, category)}
            style={{ width: size * 2, height: size }}
            resizeMode="stretch"
            fadeDuration={0}
          />
        </Animated.View>
      ) : (
        <Image
          source={getItemSprite(imageKey, category)}
          style={{ width: size, height: size }}
          resizeMode="contain"
          fadeDuration={0}
        />
      )}
    </View>
  );
}
