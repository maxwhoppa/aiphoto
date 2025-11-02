import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from './Button';

interface OnboardingButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  title,
  onPress,
  disabled = false,
}) => {
  return (
    <Button
      title={title}
      onPress={onPress}
      disabled={disabled}
      variant={disabled ? 'disabled' : 'primary'}
      style={styles.button}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 28,
    marginHorizontal: 20,
    marginBottom: 40,
    zIndex: 10, // Above particles
  },
});