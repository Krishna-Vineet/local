import React, { createContext, useContext, useMemo, useState } from 'react';
import { AppTheme, darkTheme, defaultTheme, lightTheme, ThemeMode } from '../utils/theme';

interface ThemeContextType {
  theme: AppTheme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The kiosk now defaults to the Electron skin (warm light), because that is the
 * design the product is judged on. `toggleTheme` still exists — some venues ask
 * for the dark room look — but nothing in the flow depends on it.
 */
export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  initialMode?: ThemeMode;
}> = ({ children, initialMode = 'light' }) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeContextType>(() => {
    const theme = mode === 'light' ? lightTheme : darkTheme;
    return {
      theme,
      mode,
      toggleTheme: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
      setMode,
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};

/** Theme-agnostic access for components rendered outside a provider (tests). */
export const usePalette = () => (useContext(ThemeContext) ?? { theme: defaultTheme }).theme.palette;
