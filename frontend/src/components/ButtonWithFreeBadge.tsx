import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { checkPaymentAccess } from '../services/api';

interface ButtonWithFreeBadgeProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'disabled';
  icon?: string;
}

export const ButtonWithFreeBadge: React.FC<ButtonWithFreeBadgeProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  icon,
}) => {
  const [freeCredits, setFreeCredits] = useState(0);

  useEffect(() => {
    const checkCredits = async () => {
      try {
        const accessResult = await checkPaymentAccess();
        if (accessResult?.hasAccess) {
          setFreeCredits(1);
        } else {
          setFreeCredits(0);
        }
      } catch (error) {
        console.log('Failed to check credits:', error);
        setFreeCredits(0);
      }
    };
    checkCredits();
  }, []);

  return (
    <View style={styles.buttonWithBadge}>
      <Button
        title={title}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        variant={variant}
        icon={icon}
      />
      {freeCredits > 0 && (
        <View style={styles.freeCreditBadge}>
          <Text style={styles.freeCreditText}>
            {freeCredits} free
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  buttonWithBadge: {
    position: 'relative',
  },
  freeCreditBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  freeCreditText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
});
