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

interface OnboardingStatsScreenProps {
  onNext: () => void;
  onBack: (() => void) | null;
}

export const OnboardingStatsScreen: React.FC<OnboardingStatsScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { colors } = useTheme();
  const fadeAnim1 = useRef(new Animated.Value(0)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const slideAnim1 = useRef(new Animated.Value(50)).current;
  const slideAnim2 = useRef(new Animated.Value(50)).current;

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
    };

    // Start animations immediately
    const timer = setTimeout(animateCards, 100);

    return () => clearTimeout(timer);
  }, [fadeAnim1, fadeAnim2, slideAnim1, slideAnim2]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            The Dating Reality
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You're losing to other profiles.
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <Animated.View
            style={[
              styles.statisticCard,
              { backgroundColor: colors.primary, borderColor: colors.primary },
              {
                opacity: fadeAnim1,
                transform: [{ translateY: slideAnim1 }],
              }
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.background }]}>
              Top 10% Get
            </Text>
            <View style={styles.statNumberContainer}>
              <Text style={[styles.statNumber, { color: colors.background }]}>
                58%
              </Text>
              <Text style={[styles.statAsterisk, { color: colors.background, opacity: 0.5 }]}>
                *
              </Text>
            </View>
            <Text style={[styles.statDescription, { color: colors.background }]}>
              of all matches
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.background, opacity: 0.3 }]} />
            <Text style={[styles.statInsight, { color: colors.background, opacity: 0.9 }]}>
              The top performers dominate the dating market
            </Text>
            <Text style={[styles.statCitation, { color: colors.background, opacity: 0.6 }]}>
              *Source: teamblind.com
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statisticCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              {
                opacity: fadeAnim2,
                transform: [{ translateY: slideAnim2 }],
              }
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              The Average Man Gets
            </Text>
            <View style={styles.statNumberContainer}>
              <Text style={[styles.statNumber, { color: colors.error }]}>
                2.63%
              </Text>
              <Text style={[styles.statAsterisk, { color: colors.textSecondary, opacity: 0.5 }]}>
                *
              </Text>
            </View>
            <Text style={[styles.statDescription, { color: colors.text }]}>
              of all matches
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.statInsight, { color: colors.textSecondary }]}>
              That's only 3 matches out of every 100 swipes
            </Text>
            <Text style={[styles.statCitation, { color: colors.textSecondary }]}>
              *Source: swipestats.io
            </Text>
          </Animated.View>
        </View>

      </View>

      <OnboardingButton title="Oh... I see" onPress={onNext} />
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
    fontSize: 36,
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
    width: '85%',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statNumberContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 42,
    fontWeight: 'bold',
  },
  statAsterisk: {
    position: 'absolute',
    fontSize: 18,
    right: -15,
    top: 6,
  },
  statDescription: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 15,
  },
  divider: {
    width: '80%',
    height: 1,
    marginBottom: 15,
  },
  statInsight: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statCitation: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  comparisonCards: {
    flexDirection: 'row',
    gap: 15,
  },
  smallCard: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 140,
  },
  fullWidthCard: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    width: '90%',
  },
  smallCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  smallCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  smallCardLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  cardCitation: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});