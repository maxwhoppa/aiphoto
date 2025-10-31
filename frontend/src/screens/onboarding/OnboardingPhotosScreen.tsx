import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingButton } from '../../components/OnboardingButton';
import { BackButton } from '../../components/BackButton';

interface OnboardingPhotosScreenProps {
  onNext: () => void;
  onBack: (() => void) | null;
}

export const OnboardingPhotosScreen: React.FC<OnboardingPhotosScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { colors } = useTheme();
  const fadeAnim1 = useRef(new Animated.Value(0)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const fadeAnim3 = useRef(new Animated.Value(0)).current;
  const slideAnim1 = useRef(new Animated.Value(-200)).current; // From left
  const slideAnim2 = useRef(new Animated.Value(200)).current;  // From right
  const slideAnim3 = useRef(new Animated.Value(-200)).current; // From left

  useEffect(() => {
    // Staggered animations for cards
    const animateCards = () => {
      // First card animation
      Animated.parallel([
        Animated.timing(fadeAnim1, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim1, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();

      // Second card animation (delayed)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim2, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim2, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);

      // Third card animation (delayed)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim3, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim3, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 600);
    };

    // Start animations immediately
    const timer = setTimeout(animateCards, 100);

    return () => clearTimeout(timer);
  }, [fadeAnim1, fadeAnim2, fadeAnim3, slideAnim1, slideAnim2, slideAnim3]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            The Photo Problem
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Most struggle with taking photos
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <Animated.View
            style={[
              styles.statisticCard,
              { backgroundColor: colors.primary, borderColor: colors.primary },
              {
                opacity: fadeAnim1,
                transform: [{ translateX: slideAnim1 }],
              }
            ]}
          >
            <Ionicons name="eye-outline" size={24} color={colors.background} />
            <Text style={[styles.statLabel, { color: colors.background }]}>
              People Are Shallow On Dating Apps
            </Text>
            <Text style={[styles.statDescription, { color: colors.background }]}>
              Initial attraction is impulsive
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statisticCard,
              { backgroundColor: colors.background, borderColor: colors.text },
              {
                opacity: fadeAnim2,
                transform: [{ translateX: slideAnim2 }],
              }
            ]}
          >
            <Ionicons name="camera-outline" size={24} color={colors.text} />
            <Text style={[styles.statLabel, { color: colors.text }]}>
              Poor Quality Photos
            </Text>
            <Text style={[styles.statDescription, { color: colors.text }]}>
              Bad profiles are immediately dismissed
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statisticCard,
              { backgroundColor: colors.error, borderColor: colors.error },
              {
                opacity: fadeAnim3,
                transform: [{ translateX: slideAnim3 }],
              }
            ]}
          >
            <Ionicons name="image-outline" size={24} color={colors.background} />
            <Text style={[styles.statLabel, { color: colors.background }]}>
              Capturing the Moment
            </Text>
            <Text style={[styles.statDescription, { color: colors.background }]}>
              Creating good-looking photos is hard
            </Text>
          </Animated.View>

        </View>

      </View>

      <OnboardingButton title="What now?" onPress={onNext} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 5,
  },
  statisticCard: {
    width: '95%',
    padding: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
    textAlign: 'center',
  },
  statDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});