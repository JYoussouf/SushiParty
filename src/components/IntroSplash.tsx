import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface IntroSplashProps {
  onFinish: () => void;
  duration?: number;
}

export function IntroSplash({ onFinish, duration = 1400 }: IntroSplashProps) {
  const containerOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoTranslate = useSharedValue(8);
  const underlineWidth = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    logoTranslate.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
    underlineWidth.value = withDelay(
      280,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    containerOpacity.value = withSequence(
      withDelay(duration, withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) })),
    );
  }, [containerOpacity, logoOpacity, logoTranslate, underlineWidth, duration]);

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
  const underlineStyle = useAnimatedStyle(() => ({
    width: `${underlineWidth.value * 100}%`,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <View style={styles.logoBlock}>
        <Animated.Text style={[styles.logo, logoStyle]}>Sushi Party!</Animated.Text>
        <View style={styles.underlineTrack}>
          <Animated.View style={[styles.underlineFill, underlineStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logoBlock: {
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  underlineTrack: {
    width: 200,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  underlineFill: {
    height: '100%',
    backgroundColor: '#e53935',
    borderRadius: 2,
  },
});
