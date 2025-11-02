import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'disabled';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'large',
  icon,
  style,
}) => {
  const { colors } = useTheme();

  const getBackgroundColor = () => {
    if (disabled || loading) return colors.border;
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.secondary;
      case 'outline':
        return 'transparent';
      case 'disabled':
        return colors.border;
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled || loading) return colors.textSecondary;
    switch (variant) {
      case 'primary':
      case 'secondary':
        return colors.background;
      case 'outline':
        return colors.primary;
      case 'disabled':
        return colors.textSecondary;
      default:
        return colors.background;
    }
  };

  const getBorderStyle = () => {
    if (variant === 'outline') {
      return {
        borderWidth: 2,
        borderColor: disabled ? colors.border : colors.primary,
      };
    }
    return {};
  };

  const getButtonHeight = () => {
    switch (size) {
      case 'small':
        return 44;
      case 'medium':
        return 50;
      case 'large':
        return 60;
      default:
        return 60;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 18;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          height: getButtonHeight(),
          ...getBorderStyle(),
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Ionicons
              name={icon as any}
              size={20}
              color={getTextColor()}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    textAlign: 'center',
  },
});