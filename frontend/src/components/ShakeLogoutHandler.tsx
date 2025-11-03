import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { useTheme } from '../context/ThemeContext';
import { Text } from './Text';
import { Button } from './Button';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

interface ShakeLogoutHandlerProps {
  onLogout: () => void;
}

export const ShakeLogoutHandler: React.FC<ShakeLogoutHandlerProps> = ({ onLogout }) => {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const lastShakeTime = useRef<number>(0);

  useEffect(() => {
    let subscription: any;

    // Set update interval for accelerometer
    Accelerometer.setUpdateInterval(100);

    // Subscribe to accelerometer data
    subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Calculate total acceleration
      const totalAcceleration = Math.sqrt(x * x + y * y + z * z);

      // Detect shake (threshold can be adjusted)
      const shakeThreshold = 2.5;
      const now = Date.now();

      // Prevent multiple triggers within 2 seconds
      if (totalAcceleration > shakeThreshold && now - lastShakeTime.current > 2000) {
        lastShakeTime.current = now;
        setShowModal(true);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription && subscription.remove();
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Clear onboarding flag (same as SettingsScreen)
      await SecureStore.deleteItemAsync('hasCompletedOnboarding');

      // Close modal
      setShowModal(false);

      // Call the logout function (this handles clearing auth tokens)
      await onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Logout failed', 'Unable to log out. Please try again.');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <Modal
      visible={showModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
                <Ionicons name="log-out-outline" size={32} color={colors.primary} />
              </View>

              {/* Title */}
              <Text variant="title" style={[styles.title, { color: colors.text }]}>
                Log out?
              </Text>

              {/* Message */}
              <Text variant="body" style={[styles.message, { color: colors.textSecondary }]}>
                Are you sure you want to log out? You'll need to sign in again to access your photos.
              </Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handleCancel}
                >
                  <Text style={[styles.buttonText, { color: colors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.logoutButton, { backgroundColor: colors.error }]}
                  onPress={handleLogout}
                >
                  <Text style={[styles.buttonText, { color: colors.background }]}>
                    Log out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  logoutButton: {
    // Error color will be applied from parent
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});