export const PIXEL_FONT = 'PressStart2P_400Regular';
export const PIXEL_FONT_FALLBACK: ReadonlyArray<string> = [PIXEL_FONT, 'Menlo', 'monospace'];

export const pixelFamily = PIXEL_FONT;

export const palette = {
  bg: '#fdf6e3',
  bgAlt: '#f5eccc',
  ink: '#1a1326',
  inkSoft: '#5b4a6e',
  white: '#ffffff',
  cream: '#fff7dc',
  red: '#e03434',
  redDeep: '#7a1414',
  yellow: '#f5b81e',
  green: '#3aa354',
  greenDeep: '#1e5a2e',
  blue: '#2c7be5',
  blueDeep: '#123d78',
  purple: '#7a2fb3',
  orange: '#ec7112',
  shadow: '#1a1326',
  border: '#1a1326',
};

export const pixelShadow = {
  shadowColor: palette.shadow,
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 0,
};

export const pixelShadowSm = {
  shadowColor: palette.shadow,
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 2, height: 2 },
  elevation: 0,
};
