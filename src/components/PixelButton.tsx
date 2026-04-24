import React from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { palette, pixelFamily } from '../theme/pixel';

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
  color = palette.red,
  textColor = palette.white,
  size = 'md',
  icon,
  style,
}: PixelButtonProps) {
  const paddings = size === 'lg' ? { v: 16, h: 18 } : size === 'sm' ? { v: 8, h: 10 } : { v: 12, h: 14 };
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 9 : 11;
  const shadowOffset = size === 'lg' ? 5 : size === 'sm' ? 2 : 4;

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.shadow,
          {
            backgroundColor: palette.ink,
            transform: [{ translateX: shadowOffset }, { translateY: shadowOffset }],
          },
        ]}
        pointerEvents="none"
      />
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: disabled ? palette.bgAlt : color,
            borderColor: palette.ink,
            paddingVertical: paddings.v,
            paddingHorizontal: paddings.h,
            transform: pressed ? [{ translateX: shadowOffset }, { translateY: shadowOffset }] : [],
          },
        ]}
      >
        <View style={styles.row}>
          {icon ? <Text style={[styles.icon, { fontSize: fontSize * 1.5 }]}>{icon}</Text> : null}
          <Text
            style={[
              styles.label,
              {
                color: disabled ? palette.inkSoft : textColor,
                fontSize,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  btn: {
    borderWidth: 3,
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
    fontFamily: pixelFamily,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
