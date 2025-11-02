import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';

interface TextProps extends RNTextProps {
  variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'button' | 'label' | 'back';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

export const Text: React.FC<TextProps> = ({
  children,
  style,
  variant = 'body',
  weight,
  ...props
}) => {
  const getDefaultFontFamily = () => {
    // If weight is explicitly provided, use it
    if (weight) {
      switch (weight) {
        case 'regular':
          return 'Poppins-Regular';
        case 'medium':
          return 'Poppins-Medium';
        case 'semibold':
          return 'Poppins-SemiBold';
        case 'bold':
          return 'Poppins-Bold';
        default:
          return 'Poppins-Regular';
      }
    }

    // Otherwise, use variant-based defaults
    switch (variant) {
      case 'title':
        return 'Poppins-Bold';
      case 'subtitle':
        return 'Poppins-SemiBold';
      case 'body':
        return 'Poppins-Regular';
      case 'caption':
        return 'Poppins-Regular';
      case 'button':
        return 'Poppins-Bold';
      case 'label':
        return 'Poppins-SemiBold';
      case 'back':
        return 'Poppins-Medium';
      default:
        return 'Poppins-Regular';
    }
  };

  const getDefaultFontWeight = () => {
    if (weight) {
      switch (weight) {
        case 'regular':
          return 'normal';
        case 'medium':
          return '500';
        case 'semibold':
          return '600';
        case 'bold':
          return '700';
        default:
          return 'normal';
      }
    }

    switch (variant) {
      case 'title':
        return '700'; // 700 for titles as specified
      case 'subtitle':
        return '600';
      case 'body':
        return 'normal';
      case 'caption':
        return 'normal';
      case 'button':
        return '700';
      case 'label':
        return '600';
      case 'back':
        return '500'; // 500 for back button as specified
      default:
        return 'normal';
    }
  };

  const getDefaultFontSize = () => {
    switch (variant) {
      case 'title':
        return 32; // 32px for titles as specified
      case 'subtitle':
        return 18;
      case 'body':
        return 16;
      case 'caption':
        return 14;
      case 'button':
        return 18;
      case 'label':
        return 16;
      case 'back':
        return 20; // 20px for back button as specified
      default:
        return 16;
    }
  };

  const getDefaultLineHeight = () => {
    switch (variant) {
      case 'title':
        return 38.4; // 120% of 32px (32 * 1.2 = 38.4px)
      case 'subtitle':
        return 24;
      case 'body':
        return 22;
      case 'caption':
        return 18;
      case 'button':
        return 24;
      case 'label':
        return 22;
      case 'back':
        return 30; // 30px line height for back button as specified
      default:
        return 22;
    }
  };

  const defaultStyle = {
    fontFamily: getDefaultFontFamily(),
    fontWeight: getDefaultFontWeight(),
    fontSize: getDefaultFontSize(),
    lineHeight: getDefaultLineHeight(),
  };

  return (
    <RNText
      style={[defaultStyle, style]}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  // Base styles can be added here if needed
});