import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';

interface BackButtonProps {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ onPress, disabled, label = 'Back', style }: BackButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={styles.icon}>←</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: '#ffeaea',
    borderWidth: 1,
    borderColor: '#ffd0cc',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
    color: '#e53935',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#e53935',
  },
});
