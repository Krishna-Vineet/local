export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    accent: string;
    border: string;
    error: string;
    success: string;
    film: string;
    hole: string;
    glass: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

export const darkTheme: AppTheme = {
  colors: {
    background: '#000000',
    surface: '#09090b',
    surfaceSecondary: '#18181b',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    primary: '#8b5cf6',
    secondary: '#d946ef',
    accent: '#06b6d4',
    border: '#27272a',
    error: '#ef4444',
    success: '#22c55e',
    film: '#18181A',
    hole: '#52525b',
    glass: 'rgba(24, 24, 27, 0.7)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

export const lightTheme: AppTheme = {
  colors: {
    background: '#ffffff',
    surface: '#f4f4f5',
    surfaceSecondary: '#e4e4e7',
    text: '#09090b',
    textSecondary: '#71717a',
    primary: '#7c3aed',
    secondary: '#c026d3',
    accent: '#0891b2',
    border: '#d4d4d8',
    error: '#dc2626',
    success: '#16a34a',
    // film: '#cecece',
    // hole: '#18181A',
    film: '#18181A',
    hole: '#52525b',
    glass: 'rgba(244, 244, 245, 0.7)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
