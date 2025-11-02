import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const animationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const photoAnimation = () => {
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }).start();
    };

    const timer = setTimeout(photoAnimation, 1000);
    return () => clearTimeout(timer);
  }, [animationValue]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <View style={styles.content}>
        <View style={styles.header}>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Introducing 
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            DreamBoat AI
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your one-stop solution for the most realistic & stunning profile photos
          </Text>
        </View>

        <View style={styles.imageContainer}>
          <View style={styles.cardStack}>
            {/* Left card */}
            <Animated.View
              style={[
                styles.imageWrapper,
                styles.leftCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                {
                  transform: [
                    {
                      translateX: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -50],
                      }),
                    },
                    {
                      scale: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 0.9],
                      }),
                    },
                    {
                      rotateZ: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-8deg', '-12deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../../assets/me7.png')}
                style={styles.profileImage}
              />
            </Animated.View>

            {/* Center card */}
            <Animated.View
              style={[
                styles.imageWrapper,
                styles.centerCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                {
                  transform: [
                    {
                      scale: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.05],
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

            {/* Right card */}
            <Animated.View
              style={[
                styles.imageWrapper,
                styles.rightCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                {
                  transform: [
                    {
                      translateX: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 50],
                      }),
                    },
                    {
                      scale: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 0.9],
                      }),
                    },
                    {
                      rotateZ: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['8deg', '12deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../../assets/me9.png')}
                style={styles.profileImage}
              />
            </Animated.View>
          </View>
        </View>

        <View style={styles.description}>
          <Text style={[styles.descriptionText, { color: colors.text }]}>
            Watch how DreamBoat AI transforms your dating life
          </Text>
        </View>
      </View>

      <OnboardingButton title="Sign up" onPress={onNext} />
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
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  cardStack: {
    position: 'relative',
    width: 320,
    height: 260,
  },
  imageWrapper: {
    width: 200,
    height: 260,
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
    position: 'absolute',
  },
  leftCard: {
    left: -20,
    top: 0,
    zIndex: 1,
  },
  centerCard: {
    left: 60,
    top: 0,
    zIndex: 3,
  },
  rightCard: {
    left: 140,
    top: 0,
    zIndex: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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