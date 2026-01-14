'use client';

import { createContext, useContext, useState } from 'react';
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
