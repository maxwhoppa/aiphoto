import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import type { LoadingStep } from '@/types';

const { width } = Dimensions.get('window');

const loadingSteps: LoadingStep[] = [
  { id: 1, text: 'Analyzing your photos...', duration: 3000 },
  { id: 2, text: 'Preparing AI models...', duration: 4000 },
  { id: 3, text: 'Generating scenarios...', duration: 5000 },
  { id: 4, text: 'Creating magic...', duration: 6000 },
  { id: 5, text: 'Almost ready!', duration: 2000 },
];

const pitchMessages: string[] = [
  'Professional photographers charge $200-500 for a session',
  'You\'re getting 50+ photos for just $99.99',
  'Perfect for Tinder, Bumble, and Hinge profiles',
  'Stand out with unique, eye-catching photos',
  'No awkward poses or expensive equipment needed',
];

type Props = NativeStackScreenProps<RootStackParamList, 'Loading'>;

const LoadingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { photos, scenarios } = route.params;
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentPitch, setCurrentPitch] = useState<number>(0);
  const [progress] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    let stepTimeout: NodeJS.Timeout;
    let pitchInterval: NodeJS.Timeout;

    const startLoading = (): void => {
      pitchInterval = setInterval(() => {
        setCurrentPitch(prev => (prev + 1) % pitchMessages.length);
      }, 3000);

      const runStep = (stepIndex: number): void => {
        if (stepIndex >= loadingSteps.length) {
          setTimeout(() => {
            navigation.navigate('PreviewGallery', { photos, scenarios });
          }, 1000);
          return;
        }

        setCurrentStep(stepIndex);
        
        Animated.timing(progress, {
          toValue: (stepIndex + 1) / loadingSteps.length,
          duration: loadingSteps[stepIndex]?.duration || 1000,
          useNativeDriver: false,
        }).start();

        stepTimeout = setTimeout(() => {
          runStep(stepIndex + 1);
        }, loadingSteps[stepIndex]?.duration || 1000);
      };

      runStep(0);
    };

    startLoading();

    return () => {
      if (stepTimeout) clearTimeout(stepTimeout);
      if (pitchInterval) clearInterval(pitchInterval);
    };
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentPitch]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 40],
  });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Creating Your Photos</Text>
            <Text style={styles.subtitle}>
              Our AI is working its magic on {scenarios.length} scenarios
            </Text>
          </View>

          <View style={styles.progressSection}>
            <Text style={styles.currentStep}>
              {loadingSteps[currentStep]?.text || 'Processing...'}
            </Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { width: progressWidth }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(((currentStep + 1) / loadingSteps.length) * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.pitchSection}>
            <Text style={styles.pitchTitle}>Did you know?</Text>
            <Animated.View style={[styles.pitchContainer, { opacity: fadeAnim }]}>
              <Text style={styles.pitchText}>
                {pitchMessages[currentPitch]}
              </Text>
            </Animated.View>
          </View>

          <View style={styles.scenariosList}>
            <Text style={styles.scenariosTitle}>Generating scenarios:</Text>
            {scenarios.map((scenarioId, index) => (
              <View key={scenarioId} style={styles.scenarioItem}>
                <Text style={styles.scenarioText}>
                  {scenarioId.charAt(0).toUpperCase() + scenarioId.slice(1)}
                </Text>
                {index <= currentStep && (
                  <Text style={styles.scenarioCheck}>✓</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.loadingAnimation}>
            <View style={styles.dotContainer}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      opacity: progress.interpolate({
                        inputRange: [0, 0.33, 0.66, 1],
                        outputRange: i === 0 ? [1, 0.3, 0.3, 1] : 
                                   i === 1 ? [0.3, 1, 0.3, 0.3] : 
                                   [0.3, 0.3, 1, 0.3],
                      }),
                      transform: [{
                        scale: progress.interpolate({
                          inputRange: [0, 0.33, 0.66, 1],
                          outputRange: i === 0 ? [1, 0.7, 0.7, 1] : 
                                     i === 1 ? [0.7, 1, 0.7, 0.7] : 
                                     [0.7, 0.7, 1, 0.7],
                        })
                      }]
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#f0f0f0',
    textAlign: 'center',
  },
  progressSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  currentStep: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    width: '100%',
  },
  progressBar: {
    width: width - 40,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#f0f0f0',
    fontWeight: '600',
  },
  pitchSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pitchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  pitchContainer: {
    minHeight: 50,
    justifyContent: 'center',
  },
  pitchText: {
    fontSize: 16,
    color: '#f0f0f0',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  scenariosList: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
  },
  scenariosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  scenarioItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  scenarioText: {
    fontSize: 14,
    color: '#f0f0f0',
    textTransform: 'capitalize',
  },
  scenarioCheck: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  loadingAnimation: {
    alignItems: 'center',
    marginBottom: 40,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
});

export default LoadingScreen;