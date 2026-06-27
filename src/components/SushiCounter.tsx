import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface SushiCounterProps {
  name: string;
  count: number;
  category?: string;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export function SushiCounter({
  name,
  count,
  category,
  onIncrement,
  onDecrement,
  disabled = false,
}: SushiCounterProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const countGradient = category ? t.category(category).gradient : t.color.accentGradient;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleIncrement = useCallback(() => {
    scale.value = withSequence(withSpring(1.15, { duration: 80 }), withSpring(1, { duration: 120 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onIncrement();
  }, [onIncrement, scale]);

  const handleDecrement = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement();
  }, [onDecrement]);

  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={handleDecrement} disabled={count === 0 || disabled}>
          <Text style={[styles.btnText, (count === 0 || disabled) && styles.disabledText]}>−</Text>
        </TouchableOpacity>
        <Animated.View style={[styles.countBadge, animatedStyle]}>
          <LinearGradient
            colors={countGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.countText}>{count}</Text>
        </Animated.View>
        <TouchableOpacity style={styles.btn} onPress={handleIncrement} disabled={disabled}>
          <Text style={[styles.btnText, disabled && styles.disabledText]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
    marginRight: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: t.radius.pill,
    backgroundColor: t.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 22,
    lineHeight: 26,
    color: t.color.accent,
    fontFamily: t.font.bodySemibold,
  },
  disabledText: {
    color: t.color.textTertiary,
  },
  countBadge: {
    width: 36,
    height: 36,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
});
