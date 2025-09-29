import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            The Photo Problem
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Most men struggle with taking quality photos
          </Text>
        </View>

        <View style={styles.problemsContainer}>
          <View style={[styles.problemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="camera-outline" size={40} color={colors.error} />
            <Text style={[styles.problemTitle, { color: colors.text }]}>Poor Quality Photos</Text>
            <Text style={[styles.problemDescription, { color: colors.textSecondary }]}>
              Bad lighting, poor angles, and outdated selfies
            </Text>
          </View>

          <View style={[styles.problemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="cash-outline" size={40} color={colors.warning} />
            <Text style={[styles.problemTitle, { color: colors.text }]}>Expensive Photographers</Text>
            <Text style={[styles.problemDescription, { color: colors.textSecondary }]}>
              Professional shoots cost $200-500+ and require scheduling
            </Text>
          </View>

          <View style={[styles.problemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="time-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.problemTitle, { color: colors.text }]}>Time Consuming</Text>
            <Text style={[styles.problemDescription, { color: colors.textSecondary }]}>
              Finding locations, coordinating shoots, and editing photos
            </Text>
          </View>
        </View>

        <View style={styles.solutionContainer}>
          <Text style={[styles.solutionTitle, { color: colors.primary }]}>
            There's a Better Way
          </Text>
          <Text style={[styles.solutionDescription, { color: colors.text }]}>
            Good photos are essential to get into the top 10% of men, but you don't need to hire a professional photographer anymore.
          </Text>
        </View>
      </ScrollView>

      <OnboardingButton title="Tell Me More" onPress={onNext} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    minHeight: 650,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
    zIndex: 10, // Above particles
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  problemsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  problemCard: {
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    zIndex: 10, // Above particles
  },
  problemIcon: {
    marginBottom: 12,
  },
  problemTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  problemDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  solutionContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 10,
    zIndex: 10, // Above particles
  },
  solutionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  solutionDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});