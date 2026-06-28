import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface BackButtonProps {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ onPress, disabled, label = 'Back', style }: BackButtonProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <Text style={styles.icon}>←</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: t.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: t.font.bodyBold,
    color: t.color.accent,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: t.font.bodyBold,
    color: t.color.accent,
  },
});
