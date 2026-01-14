'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createTheme, MantineProvider } from '@mantine/core';

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: 'blue',
  setPrimaryColor: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState('blue');

  // Load user's accent color preference on mount
  useEffect(() => {
    const fetchUserAccentColor = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user?.accentColor) {
          setPrimaryColor(data.user.accentColor);
        }
      } catch (error) {
        // Silently fail - use default color
        console.error('Failed to fetch user accent color:', error);
      }
    };

    fetchUserAccentColor();
  }, []);

  const theme = createTheme({
    primaryColor,
  });

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}
