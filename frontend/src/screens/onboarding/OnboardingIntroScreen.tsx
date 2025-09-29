import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { OnboardingButton } from '../../components/OnboardingButton';
import { BackButton } from '../../components/BackButton';

interface OnboardingIntroScreenProps {
  onNext: () => void;
  onBack: (() => void) | null;
}

export const OnboardingIntroScreen: React.FC<OnboardingIntroScreenProps> = ({
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
            Welcome to
          </Text>
          <Text style={[styles.appName, { color: colors.primary }]}>
            DreamBoat AI
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Transform your dating profile with AI-generated photos
          </Text>
        </View>

        <View style={styles.imageContainer}>
          <View style={[styles.phoneMockup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.phoneScreen, { backgroundColor: colors.background }]}>
              <Text style={[styles.phoneText, { color: colors.text }]}>
                📱 Hinge Matches
              </Text>
              <View style={styles.matchesContainer}>
                {[1, 2, 3, 4].map((match) => (
                  <View
                    key={match}
                    style={[styles.matchItem, { backgroundColor: colors.success }]}
                  >
                    <Text style={[styles.matchText, { color: colors.background }]}>
                      ✓
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.description}>
          <Text style={[styles.descriptionText, { color: colors.text }]}>
            See how AI can help you get more matches and better conversations
          </Text>
        </View>
      </ScrollView>

      <OnboardingButton title="Get Started" onPress={onNext} />
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
    minHeight: 600,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  phoneMockup: {
    width: 200,
    height: 400,
    borderRadius: 25,
    borderWidth: 3,
    padding: 15,
    justifyContent: 'center',
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 30,
  },
  matchesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  matchItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  description: {
    alignItems: 'center',
    marginBottom: 40,
  },
  descriptionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});