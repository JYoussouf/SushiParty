import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SushiPartyLogo } from './SushiPartyLogo';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface PartySplashProps {
  onFinish: () => void;
  duration?: number;
}

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

// X-style reveal: the logo pops in, holds, then zooms up toward the viewer while
// the whole splash fades away to reveal the app behind it.
const ENTRANCE = 640;
const HOLD = 360;
const EXIT = 460;

export function PartySplash({ onFinish, duration = ENTRANCE + HOLD + EXIT }: PartySplashProps) {
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

  const opacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.86);
  const logoY = useSharedValue(14);

  useEffect(() => {
    logPartyFlow('party-splash animation start', { duration });
    logoOpacity.value = withTiming(1, { duration: ENTRANCE, easing: Easing.out(Easing.cubic) });
    logoY.value = withTiming(0, { duration: ENTRANCE, easing: Easing.out(Easing.cubic) });
    // Pop in (slight overshoot), hold, then accelerate into a big zoom.
    logoScale.value = withSequence(
      withTiming(1, { duration: ENTRANCE, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(HOLD, withTiming(14, { duration: EXIT, easing: Easing.in(Easing.cubic) })),
    );
    // The whole splash fades during the zoom, revealing the app underneath.
    opacity.value = withDelay(
      ENTRANCE + HOLD,
      withTiming(0, { duration: EXIT, easing: Easing.in(Easing.cubic) }),
    );

    const timer = setTimeout(() => {
      finishOnce('timer');
    }, duration);
    return () => {
      logPartyFlow('party-splash cleanup');
      clearTimeout(timer);
    };
  }, [duration, finishOnce, logoOpacity, logoScale, logoY, opacity]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }, { scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => finishOnce('tap')}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      />
      <Animated.View style={[styles.logoWrap, logoStyle]} pointerEvents="none">
        <SushiPartyLogo size="lg" />
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.color.bg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoWrap: { alignItems: 'center' },
  });
