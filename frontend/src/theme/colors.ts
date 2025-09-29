export interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  accent: string;
}

export const colorSchemes: Record<string, ColorScheme> = {
  default: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    border: '#E1E8ED',
    success: '#2ECC71',
    warning: '#F39C12',
    error: '#E74C3C',
    accent: '#9B59B6',
  },
  dark: {
    primary: '#D72638',
    secondary: '#FF3C47',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#F5F5F5',
    textSecondary: '#B0B0B0',
    border: '#404040',
    success: '#2ECC71',
    warning: '#F39C12',
    error: '#E74C3C',
    accent: '#D72638',
  },
  crimson: {
    primary: '#D72638',
    secondary: '#FF3C47',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#F5F5F5',
    textSecondary: '#B0B0B0',
    border: '#404040',
    success: '#2ECC71',
    warning: '#F39C12',
    error: '#E74C3C',
    accent: '#D72638',
  },
  ocean: {
    primary: '#0077BE',
    secondary: '#00A8CC',
    background: '#F0F8FF',
    surface: '#E6F3FF',
    text: '#1E3A8A',
    textSecondary: '#64748B',
    border: '#CBD5E1',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    accent: '#7C3AED',
  },
  sunset: {
    primary: '#FF7F50',
    secondary: '#FFB347',
    background: '#FFF8F0',
    surface: '#FFF0E6',
    text: '#8B4513',
    textSecondary: '#A0522D',
    border: '#DEB887',
    success: '#228B22',
    warning: '#FF8C00',
    error: '#DC143C',
    accent: '#DA70D6',
  },
};

export const getColorScheme = (schemeName: string): ColorScheme => {
  // return colorSchemes[schemeName] || colorSchemes.default;
  return colorSchemes['sunset'];
};