import React, { createContext, useContext } from 'react';
import { appTheme, type Theme } from '../theme/themes';

const ThemeContext = createContext<Theme>(appTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={appTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
