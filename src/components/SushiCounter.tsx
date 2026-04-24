import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

interface SushiCounterProps {
  name: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export function SushiCounter({
  name,
  count,
  onIncrement,
  onDecrement,
  disabled = false,
}: SushiCounterProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleIncrement = useCallback(() => {
    scale.value = withSequence(withSpring(1.15, { duration: 80 }), withSpring(1, { duration: 120 }));
    onIncrement();
  }, [onIncrement, scale]);

  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={onDecrement} disabled={count === 0 || disabled}>
          <Text style={[styles.btnText, (count === 0 || disabled) && styles.disabledText]}>−</Text>
        </TouchableOpacity>
        <Animated.View style={[styles.countBadge, animatedStyle]}>
          <Text style={styles.countText}>{count}</Text>
        </Animated.View>
        <TouchableOpacity style={styles.btn} onPress={handleIncrement} disabled={disabled}>
          <Text style={[styles.btnText, disabled && styles.disabledText]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: '#222',
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
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 22,
    lineHeight: 26,
    color: '#e53935',
    fontWeight: '600',
  },
  disabledText: {
    color: '#ccc',
  },
  countBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
