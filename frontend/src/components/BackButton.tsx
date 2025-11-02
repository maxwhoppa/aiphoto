import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Text } from './Text';

interface BackButtonProps {
  onPress: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.buttonContent}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text variant="back" style={[styles.buttonText, { color: colors.primary }]}>Back</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100, // Above everything
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 30, // Matches line height
  },
  buttonText: {
    // Text component handles all typography through variant="back"
  },
});