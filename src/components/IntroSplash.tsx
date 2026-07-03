import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { SushiPartyLogo } from './SushiPartyLogo';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface IntroSplashProps {
  onFinish: () => void;
  duration?: number;
}

export function IntroSplash({ onFinish, duration = 1400 }: IntroSplashProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const containerOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoTranslate = useSharedValue(8);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    logoTranslate.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
    containerOpacity.value = withSequence(
      withDelay(duration, withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) })),
    );
  }, [containerOpacity, logoOpacity, logoTranslate, duration]);

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onFinish();
    }, duration + 340);
    return () => clearTimeout(timer);
  }, [duration, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslate.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <Animated.View style={logoStyle}>
        <SushiPartyLogo size="lg" />
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.color.bg,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
  });
