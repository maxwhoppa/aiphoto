import React from 'react';
import { View, StyleSheet, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Text } from './Text';

interface GenerationStatusNotificationProps {
  visible: boolean;
  message?: string;
}

export const GenerationStatusNotification: React.FC<GenerationStatusNotificationProps> = ({
  visible,
  message = "Images Generating...",
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const isCompletionMessage = message.includes("complete");

  // Debug logging
  React.useEffect(() => {
    console.log('GenerationStatusNotification: visible prop changed to:', visible, 'message:', message);
  }, [visible, message]);

  if (!visible) return null;

  return (
    <View style={[styles.notification, { top: insets.top + 60 }]}>
      {!isCompletionMessage && (
        <ActivityIndicator size="small" color="#666" style={styles.spinner} />
      )}
      <Text style={styles.notificationText}>
        {message}
      </Text>
    </View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  notification: {
    position: 'absolute',
    left: (screenWidth - 200) / 2, // Center horizontally (200px width)
    width: 200, // Smaller, fixed width
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20, // More rounded for smaller size
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  spinner: {
    marginRight: 8,
  },
  notificationText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
});