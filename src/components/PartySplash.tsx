import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SushiPartyLogo } from './SushiPartyLogo';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface PartySplashProps {
  onFinish: () => void;
  duration?: number;
}

const SUSHI = ['🍣', '🍤', '🍙', '🥢'] as const;

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

export function PartySplash({ onFinish, duration = 1800 }: PartySplashProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const finishedRef = useRef(false);

  const finishOnce = useCallback(
    (reason: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      logPartyFlow('party-splash finish', { reason });
      onFinish();
    },
    [onFinish],
  );
  const contentOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.82);
  const logoY = useSharedValue(18);
  const plateScale = useSharedValue(0.8);
  const plateBob = useSharedValue(0);
  const orbit = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    logPartyFlow('party-splash animation start', { duration });
    logoOpacity.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.back(1.3)) });
    logoY.value = withTiming(0, { duration: 760, easing: Easing.out(Easing.cubic) });
    plateScale.value = withDelay(
      220,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.2)) }),
    );
    plateBob.value = withDelay(
      920,
      withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    orbit.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.linear }),
      -1,
      false,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    progress.value = withTiming(1, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });
    contentOpacity.value = withDelay(
      duration - 520,
      withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) }),
    );

    const timer = setTimeout(() => {
      finishOnce('timer');
    }, duration);
    return () => {
      logPartyFlow('party-splash cleanup');
      clearTimeout(timer);
    };
  }, [contentOpacity, duration, finishOnce, logoOpacity, logoScale, logoY, orbit, plateBob, plateScale, progress, shimmer]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }, { scale: logoScale.value }],
  }));
  const plateStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(plateBob.value, [0, 1], [0, -7]) },
      { scale: plateScale.value },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.28, 0.65]),
    transform: [{ scale: interpolate(shimmer.value, [0, 1], [0.92, 1.08]) }],
  }));
  const loadingStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Pressable
      style={styles.container}
      onPress={() => finishOnce('tap')}
      accessibilityRole="button"
      accessibilityLabel="Skip intro"
    >
      <Animated.View style={[styles.content, contentStyle]} pointerEvents="none">
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <SushiPartyLogo size="lg" />
        </Animated.View>

        <Animated.View style={[styles.plate, plateStyle]}>
          <Text style={styles.plateEmoji}>🍱</Text>
          {SUSHI.map((emoji, index) => (
            <OrbitingBite key={emoji} emoji={emoji} index={index} progress={orbit} />
          ))}
        </Animated.View>

        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingFill, loadingStyle]} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function OrbitingBite({
  emoji,
  index,
  progress,
}: {
  emoji: string;
  index: number;
  progress: SharedValue<number>;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const style = useAnimatedStyle(() => {
    const angle = (progress.value * Math.PI * 2) + (index * Math.PI) / 2;
    return {
      transform: [
        { translateX: Math.cos(angle) * 88 },
        { translateY: Math.sin(angle) * 32 },
        { scale: interpolate(Math.sin(angle), [-1, 1], [0.82, 1.08]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.bite, style]}>
      <Text style={styles.biteText}>{emoji}</Text>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: t.color.accentSoft,
  },
  logoWrap: {
    alignItems: 'center',
    zIndex: 2,
  },
  plate: {
    width: 210,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateEmoji: {
    fontSize: 76,
  },
  bite: {
    position: 'absolute',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biteText: {
    fontSize: 30,
  },
  loadingTrack: {
    width: 168,
    height: 8,
    borderRadius: t.radius.sm,
    backgroundColor: t.color.border,
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    borderRadius: t.radius.sm,
    backgroundColor: t.color.accent,
  },
});
