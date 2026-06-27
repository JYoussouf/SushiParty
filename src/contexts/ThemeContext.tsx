import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, type Theme, type ThemeName } from '../theme/themes';

const STORAGE_KEY = 'theme:name';
const DEFAULT_THEME: ThemeName = 'tokyo';

interface ThemeContextValue {
  theme: Theme;
  name: ThemeName;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'classic' || stored === 'tokyo') setName(stored);
    });
  }, []);

  const setTheme = (next: ThemeName) => {
    setName(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const toggleTheme = () => setTheme(name === 'tokyo' ? 'classic' : 'tokyo');

  return (
    <ThemeContext.Provider value={{ theme: THEMES[name], name, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx.theme;
}

export function useThemeControls(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeControls must be used within ThemeProvider');
  return ctx;
}
