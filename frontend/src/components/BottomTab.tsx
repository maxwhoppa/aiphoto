import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Text } from './Text';

interface ProgressBarProps {
  progress: number;
  title: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, title }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.uploadProgressContainer}>
      <View style={[styles.uploadProgressBar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.uploadProgressFill,
            {
              backgroundColor: colors.primary,
              width: `${progress}%`,
            }
          ]}
        />
      </View>
      <Text style={[styles.uploadProgressText, { color: colors.textSecondary }]}>
        {title} {Math.round(progress)}%
      </Text>
    </View>
  );
};

interface ScrollIndicatorProps {
  onPress: () => void;
  visible: boolean;
  offset: number;
}

const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ onPress, visible, offset }) => {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[styles.scrollIndicator, { bottom: offset }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name="arrow-down" size={24} color="#000000" />
    </TouchableOpacity>
  );
};

interface BottomTabProps {
  children: React.ReactNode;
  showProgress?: boolean;
  progress?: number;
  progressTitle?: string;
  showScrollIndicator?: boolean;
  onScrollIndicatorPress?: () => void;
  scrollIndicatorOffset?: number; // Custom offset for scroll indicator position
}

export const BottomTab: React.FC<BottomTabProps> = ({
  children,
  showProgress = false,
  progress = 0,
  progressTitle = "Processing...",
  showScrollIndicator = false,
  onScrollIndicatorPress,
  scrollIndicatorOffset = 120, // Default offset
}) => {
  const { colors } = useTheme();

  return (
    <>
      <ScrollIndicator
        visible={showScrollIndicator}
        onPress={onScrollIndicatorPress || (() => {})}
        offset={scrollIndicatorOffset}
      />
      <View style={[styles.bottomTab, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {showProgress && (
          <ProgressBar progress={progress} title={progressTitle} />
        )}
        {children}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  scrollIndicator: {
    position: 'absolute',
    left: '50%',
    marginLeft: -20, // Half of width to center
    width: 40,
    height: 40,
    borderRadius: 400,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  bottomTab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadProgressContainer: {
    marginBottom: 16,
  },
  uploadProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
});