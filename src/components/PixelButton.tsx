import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../theme/themes';

interface PixelButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  textColor?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

export function PixelButton({
  label,
  onPress,
  disabled = false,
  color,
  textColor,
  size = 'md',
  icon,
  style,
}: PixelButtonProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const paddings = size === 'lg' ? { v: 16, h: 18 } : size === 'sm' ? { v: 8, h: 10 } : { v: 12, h: 14 };
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 9 : 11;
  const shadowOffset = size === 'lg' ? 5 : size === 'sm' ? 2 : 4;

  // When no explicit color is given, use the theme's accent gradient (modern in Tokyo,
  // flat-looking pixel red in classic since both gradient stops are the brand red).
  const useGradient = !color && !disabled;
  const gradientColors = t.color.accentGradient;
  const resolvedLabelColor = disabled ? t.color.textTertiary : textColor ?? t.color.onAccent;

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const content = (
    <View style={styles.row}>
      {icon ? <Text style={[styles.icon, { fontSize: fontSize * 1.5 }]}>{icon}</Text> : null}
      <Text
        style={[styles.label, { color: resolvedLabelColor, fontSize }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <View style={[styles.wrap, !disabled && styles.wrapGlow, style]}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: disabled ? t.color.surfaceAlt : color ?? t.color.accent,
            paddingVertical: paddings.v,
            paddingHorizontal: paddings.h,
            transform: pressed ? [{ translateX: shadowOffset }, { translateY: shadowOffset }] : [],
          },
        ]}
      >
        {useGradient ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {content}
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    position: 'relative',
    borderRadius: t.radius.button,
  },
  wrapGlow: {
    ...t.shadow.glow(t.color.accent),
  },
  btn: {
    borderRadius: t.radius.button,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    lineHeight: undefined as unknown as number,
  },
  label: {
    fontFamily: t.font.bodyBold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
