import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SushiPartyLogo } from '../../src/components';
import { useTransition } from '../../src/contexts/TransitionContext';

export default function PartyIntroScreen() {
  const router = useRouter();
  const { startTransition } = useTransition();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  useEffect(() => {
    // Start the transition - this manages the entire flow
    void startTransition('party-intro', async () => {
      // Wait for animations to complete
      await new Promise<void>((resolve) => {
        const completeAnimation = () => {
          resolve();
        };

        opacity.value = withSequence(
          withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) }),
          withDelay(250, withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) })),
        );
        scale.value = withSequence(
          withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.4)) }),
          withDelay(
            250,
            withTiming(14, { duration: 420, easing: Easing.in(Easing.quad) }, (finished) => {
              if (finished) {
                runOnJS(completeAnimation)();
              }
            }),
          ),
        );
      });

      // Navigate to scoreboard after animation + small buffer for loading
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          router.replace('/session/scoreboard');
          resolve();
        }, 200);
      });
    });
  }, [startTransition, router, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View style={animStyle}>
        <SushiPartyLogo size="lg" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0f0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
