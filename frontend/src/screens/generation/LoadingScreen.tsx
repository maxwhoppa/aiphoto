import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { getUploadUrls, recordUploadedImages, generateImages, getGeneratedImages, redeemPayment } from '../../services/api';

interface LoadingScreenProps {
  onComplete: (generatedImages: any[]) => void;
  selectedScenarios: string[];
  imageIds: string[];
  paymentId?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onComplete,
  selectedScenarios,
  imageIds,
  paymentId,
}) => {
  const { colors } = useTheme();
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [dots, setDots] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const messages = [
    {
      title: "Analyzing Your Photos",
      subtitle: "Our AI is studying your facial features and style preferences",
      tip: "Good lighting in your original photos leads to better AI results"
    },
    {
      title: "Generating Scenarios",
      subtitle: `Creating ${imageIds.length * selectedScenarios.length} professional photos across ${selectedScenarios.length} scenarios`,
      tip: "Each scenario uses different AI models for optimal results"
    },
    {
      title: "Enhancing Quality",
      subtitle: "Applying professional-grade enhancements and lighting corrections",
      tip: "Professional photographers charge $200-500 for similar results"
    },
    {
      title: "Adding Final Touches",
      subtitle: "Optimizing photos for dating apps and social media",
      tip: "Studies show professional photos get 3x more matches"
    },
    {
      title: "Almost Ready!",
      subtitle: "Preparing your photo gallery for download",
      tip: "You're about to join the top 10% on dating apps"
    }
  ];

  const processImages = async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      console.log('Starting image generation process...');

      // Start the fake progress that takes 60 seconds to reach 99%
      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min(99, (elapsed / 60000) * 99); // 99% over 60 seconds
        setProgress(progressPercent);

        // Update messages based on progress
        if (progressPercent < 25) {
          setCurrentMessage(1); // "Generating Scenarios"
        } else if (progressPercent < 50) {
          setCurrentMessage(2); // "Enhancing Quality"
        } else if (progressPercent < 75) {
          setCurrentMessage(3); // "Adding Final Touches"
        } else {
          setCurrentMessage(4); // "Almost Ready!"
        }

        if (progressPercent >= 99) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }

        // Check if we've exceeded 60 seconds
        if (elapsed > 60000) {
          setIsOvertime(true);
        }
      }, 100); // Update every 100ms for smooth animation

      // Meanwhile, do the actual API work in parallel
      const generateResponse = await generateImages(imageIds, selectedScenarios);

      // Redeem payment if paymentId provided
      if (paymentId) {
        try {
          await redeemPayment(paymentId);
          console.log('Payment redeemed successfully');
        } catch (error) {
          console.error('Failed to redeem payment:', error);
        }
      }

      // Fetch generated images
      const generatedImagesResponse = await getGeneratedImages({});
      const generatedImages = generatedImagesResponse.result?.data || generatedImagesResponse.data || [];

      // Clear the interval in case API finished before 40 seconds
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Complete the progress bar
      setProgress(100);

      // Complete after a brief delay
      setTimeout(() => {
        onComplete(generatedImages);
      }, 500);

    } catch (error: any) {
      console.error('Image generation failed:', error);

      // Clear the progress interval to stop it from continuing
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      Alert.alert(
        'Generation Error',
        error.message || 'Failed to generate your images. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Only reset if user wants to try again
              setProgress(0);
              setCurrentMessage(0);
              setIsProcessing(false);
            }
          }
        ]
      );
    }
  };

  useEffect(() => {
    processImages();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Animate dots for loading effect
    const dotsInterval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  useEffect(() => {
    // Smooth progress bar animation
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500, // Smoother animation
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const currentMsg = messages[currentMessage];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Creating Your Photos{dots}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isOvertime
              ? "Taking longer than usual due to high traffic"
              : "This usually takes about 60 seconds"
            }
          </Text>
        </View>

        {/* AI Visualization */}
        <View style={styles.visualContainer}>
          <View style={[styles.aiContainer, { borderColor: colors.primary }]}>
            <Ionicons name="hardware-chip-outline" size={48} color={colors.primary} />
            <View style={styles.processingIndicator}>
              {[...Array(8)].map((_, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.processingDot,
                    {
                      backgroundColor: colors.primary,
                      opacity: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: [0.3, 1],
                        extrapolate: 'clamp',
                      }),
                      transform: [{
                        scale: progressAnim.interpolate({
                          inputRange: [index * 12.5, (index + 1) * 12.5],
                          outputRange: [0.5, 1],
                          extrapolate: 'clamp',
                        })
                      }]
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>
              {currentMsg.title}
            </Text>
            <Text style={[styles.progressPercentage, { color: colors.primary }]}>
              {Math.round(progress)}%
            </Text>
          </View>
          
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                }
              ]}
            />
          </View>
          
          <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>
            {currentMsg.subtitle}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {imageIds.length * selectedScenarios.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>
              Photos Generating
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNumber, { color: colors.secondary }]}>
              {selectedScenarios.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>
              Scenarios
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>
              HD
            </Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>
              Quality
            </Text>
          </View>
        </View>

        {/* Tip */}
        <View style={[styles.tipContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.tipContent}>
            <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} style={styles.tipIcon} />
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              {currentMsg.tip}
            </Text>
          </View>
        </View>

        {/* Marketing messages during wait */}
        <View style={styles.marketingContainer}>
          <Text style={[styles.marketingTitle, { color: colors.text }]}>
            While You Wait...
          </Text>
          <View style={styles.marketingPoints}>
            <Text style={[styles.marketingPoint, { color: colors.textSecondary }]}>
              • Professional photos increase match rates by 300%
            </Text>
            <Text style={[styles.marketingPoint, { color: colors.textSecondary }]}>
              • AI generation costs 20x less than a photo shoot
            </Text>
            <Text style={[styles.marketingPoint, { color: colors.textSecondary }]}>
              • Your photos will be optimized for all dating apps
            </Text>
          </View>
        </View>
      </View>
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
    marginBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  visualContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  aiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  aiIcon: {
    fontSize: 48,
  },
  processingIndicator: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 70,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 5,
  },
  processingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressContainer: {
    marginBottom: 40,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  tipContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  tipText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
    flex: 1,
    marginLeft: 8,
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  tipIcon: {
    marginTop: 2,
  },
  marketingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  marketingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  marketingPoints: {
    gap: 8,
  },
  marketingPoint: {
    fontSize: 14,
    lineHeight: 20,
  },
});