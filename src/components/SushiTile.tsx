import React, { useCallback, useEffect, useState } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface SushiTileProps {
  name: string;
  emoji: string;
  count: number;
  tint: TileTint;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export interface TileTint {
  bg: string;
  bgActive: string;
  border: string;
  borderActive: string;
  badge: string;
  accent: string;
}

interface FloatingPlus {
  id: number;
  x: number;
}

export function SushiTile({
  name,
  emoji,
  count,
  tint,
  onIncrement,
  onDecrement,
  disabled = false,
}: SushiTileProps) {
  const scale = useSharedValue(1);
  const badgeScale = useSharedValue(1);
  const [floats, setFloats] = useState<FloatingPlus[]>([]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  useEffect(() => {
    if (count > 0) {
      badgeScale.value = withSequence(
        withSpring(1.35, { duration: 100 }),
        withSpring(1, { duration: 160 }),
      );
    }
  }, [count, badgeScale]);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.25, { duration: 80 }),
      withSpring(0.95, { duration: 100 }),
      withSpring(1, { duration: 140 }),
    );
    const id = Date.now() + Math.random();
    const x = (Math.random() - 0.5) * 30;
    setFloats((prev) => [...prev, { id, x }]);
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 700);
    onIncrement();
  }, [onIncrement, scale]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [styles.hit, pressed && styles.hitPressed, disabled && styles.hitDisabled]}
      >
        <Animated.View style={[styles.emojiWrap, animatedStyle]}>
          <Text style={styles.emoji}>{emoji}</Text>
          {floats.map((f) => (
            <FloatingEmoji key={f.id} offsetX={f.x} emoji={emoji} />
          ))}
        </Animated.View>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {count > 0 && (
          <Animated.View style={[styles.badge, { backgroundColor: tint.badge }, badgeStyle]}>
            <Pressable
              onPress={onDecrement}
              disabled={disabled}
              hitSlop={8}
              style={styles.badgePressable}
            >
              <Text style={styles.badgeText}>{count}</Text>
            </Pressable>
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
}

function FloatingEmoji({ offsetX, emoji }: { offsetX: number; emoji: string }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    y.value = withTiming(-180, { duration: 650 });
    opacity.value = withTiming(0, { duration: 650 });
    scale.value = withTiming(0.5, { duration: 650 });
  }, [y, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: offsetX },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatWrap, style]} pointerEvents="none">
      <Text style={styles.floatEmoji}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    aspectRatio: 1,
    padding: 2,
  },
  hit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    gap: 0,
  },
  hitPressed: {
    opacity: 0.9,
  },
  hitDisabled: {
    opacity: 0.4,
  },
  emojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 10,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  badgePressable: {
    flex: 1,
    minWidth: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
  },
  floatWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
});
