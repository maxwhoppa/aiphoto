import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const animationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const popAnimation = () => {
      Animated.loop(
        Animated.sequence([
          // Pop out animation (0 -> 1)
          Animated.timing(animationValue, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          // Pause with second image visible
          Animated.delay(2000),
          // Return to original position (1 -> 0)
          Animated.timing(animationValue, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
          // Pause with first image visible
          Animated.delay(2000),
        ]),
        { iterations: -1 }
      ).start();
    };

    // Start the animation after a short delay
    const timer = setTimeout(popAnimation, 1000);

    return () => clearTimeout(timer);
  }, [animationValue]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Welcome to
          </Text>
          <Text style={[styles.appName, { color: colors.primary }]}>
            DreamBoat AI
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Transform your dating profile with a polished "You".
          </Text>
        </View>

        <View style={styles.imageContainer}>
          <View style={styles.cardStack}>
            {/* Back card - me4.png (pops out from behind) */}
            <Animated.View
              style={[
                styles.imageWrapper,
                styles.backCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                {
                  transform: [
                    {
                      translateY: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -60], // Starts perfectly aligned, moves up
                      }),
                    },
                    {
                      translateX: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 40], // Starts perfectly aligned, moves right
                      }),
                    },
                    {
                      scale: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 0.9], // Scales up even less
                      }),
                    },
                    {
                      rotateZ: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['5deg', '8deg'], // Slight rotation
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../../assets/mebefore.png')}
                style={styles.profileImage}
              />
            </Animated.View>

            {/* Front card - mebefore.png (stays mostly in place) */}
            <Animated.View
              style={[
                styles.imageWrapper,
                styles.frontCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                {
                  transform: [
                    {
                      translateY: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 80], // Start a bit higher up, then move down significantly
                      }),
                    },
                    {
                      translateX: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -80], // Move left significantly
                      }),
                    },
                    {
                      scale: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1.2, 0.8], // Starts even bigger, scales down more significantly
                      }),
                    },
                    {
                      rotateZ: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '-2deg'], // Slight rotation
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../../assets/me4.png')}
                style={styles.profileImage}
              />
            </Animated.View>
          </View>
        </View>
      </View>

      <OnboardingButton title="Get Started" onPress={onNext} />
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
  cardStack: {
    position: 'relative',
    marginBottom: 20,
  },
  imageWrapper: {
    width: 280,
    height: 280,
    borderRadius: 20,
    borderWidth: 3,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  frontCard: {
    position: 'relative',
    zIndex: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageCaption: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
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