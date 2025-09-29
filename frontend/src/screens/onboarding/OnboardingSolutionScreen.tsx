import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { OnboardingButton } from '../../components/OnboardingButton';
import { BackButton } from '../../components/BackButton';

interface OnboardingSolutionScreenProps {
  onNext: () => void;
  onBack: (() => void) | null;
}

export const OnboardingSolutionScreen: React.FC<OnboardingSolutionScreenProps> = ({
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
            DreamBoat AI
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            See how it works
          </Text>
        </View>

        {/* Video Placeholder */}
        <View style={styles.videoContainer}>
          <View style={[styles.videoPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.playButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.playIcon, { color: colors.background }]}>▶</Text>
            </View>
            <Text style={[styles.videoText, { color: colors.textSecondary }]}>
              Demo Video Placeholder
            </Text>
            <Text style={[styles.videoSubtext, { color: colors.textSecondary }]}>
              Tap to play introduction video
            </Text>
          </View>
        </View>

        <View style={styles.bottomText}>
          <Text style={[styles.description, { color: colors.text }]}>
            Watch how DreamBoat AI transforms your photos into professional dating profile pictures
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
    justifyContent: 'center',
    minHeight: 600, // Ensure minimum height for scrolling
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
    zIndex: 10, // Above particles
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
  },
  videoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10, // Above particles
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  playIcon: {
    fontSize: 32,
    marginLeft: 4, // Slight offset to center triangle
  },
  videoText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  videoSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  bottomText: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    zIndex: 10, // Above particles
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});