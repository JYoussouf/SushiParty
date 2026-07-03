import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Avatar } from './Avatar';

interface PartyCharacterProps {
  /** Character id (e.g. 'panda') or legacy emoji. */
  avatar?: string | undefined;
  /**
   * The participant's current piece total. Whenever it INCREASES, the character
   * plays a one-shot eating animation (cookie-clicker style) — this works for both
   * local taps and remote players' increments arriving over the socket.
   */
  total: number;
  size?: number;
}

/**
 * An actively-participating party character. It idles continuously (a gentle bob)
 * and, each time its `total` ticks up, chomps while a sushi piece flies up into
 * its mouth.
 *
 * States today: `idle` (default loop) and `eating` (triggered by a count bump).
 * The animation is split across independent shared values — `bob` for the idle
 * loop, `chomp`/`piece*` for the one-shot eat — so more states (celebrate, sleepy,
 * …) can be layered in later without them fighting over one transform.
 */
export function PartyCharacter({ avatar, total, size = 64 }: PartyCharacterProps) {
  const bob = useSharedValue(0); // idle vertical hover
  const chomp = useSharedValue(1); // eating squash-and-stretch scale
  const pieceY = useSharedValue(0); // flying piece vertical offset
  const pieceOpacity = useSharedValue(0);
  const prevTotal = useRef(total);

  // Idle: a calm continuous hover. Always running underneath every other state.
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-size * 0.05, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(bob);
  }, [bob, size]);

  // Eating: fire once per count increase.
  useEffect(() => {
    if (total > prevTotal.current) {
      chomp.value = withSequence(
        withTiming(0.82, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1.12, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 130, easing: Easing.inOut(Easing.quad) }),
      );
      pieceY.value = 0;
      pieceOpacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 170 }),
        withTiming(0, { duration: 140 }),
      );
      pieceY.value = withTiming(-size * 0.44, { duration: 320, easing: Easing.in(Easing.quad) });
    }
    prevTotal.current = total;
  }, [total, chomp, pieceOpacity, pieceY, size]);

  const charStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      // Squash-and-stretch: widen as it shortens so the chomp keeps its volume.
      { scaleX: 1 / Math.sqrt(chomp.value) },
      { scaleY: chomp.value },
    ],
  }));
  const pieceStyle = useAnimatedStyle(() => ({
    opacity: pieceOpacity.value,
    transform: [{ translateY: pieceY.value }, { scale: 0.5 + 0.5 * pieceOpacity.value }],
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.Text style={[styles.piece, { fontSize: size * 0.36 }, pieceStyle]} pointerEvents="none">
        🍣
      </Animated.Text>
      <Animated.View style={charStyle}>
        <Avatar value={avatar} size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', bottom: 4, zIndex: 2 },
});
