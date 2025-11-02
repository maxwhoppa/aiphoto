import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ColorScheme, colorSchemes, getColorScheme } from '../theme/colors';
import { typography } from '../theme/typography';

interface ThemeContextType {
  currentScheme: string;
  colors: ColorScheme;
  typography: typeof typography;
  availableSchemes: string[];
  setColorScheme: (scheme: string) => void;
  updateColor: (colorKey: keyof ColorScheme, hexValue: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentScheme, setCurrentScheme] = useState<string>('default');
  const [customColors, setCustomColors] = useState<Partial<ColorScheme>>({});

  const baseColors = getColorScheme(currentScheme);
  const colors = { ...baseColors, ...customColors };

  const setColorScheme = (scheme: string) => {
    setCurrentScheme(scheme);
    setCustomColors({}); // Reset custom colors when switching schemes
  };

  const updateColor = (colorKey: keyof ColorScheme, hexValue: string) => {
    setCustomColors(prev => ({
      ...prev,
      [colorKey]: hexValue,
    }));
  };

  const availableSchemes = Object.keys(colorSchemes);

  return (
    <ThemeContext.Provider
      value={{
        currentScheme,
        colors,
        typography,
        availableSchemes,
        setColorScheme,
        updateColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};