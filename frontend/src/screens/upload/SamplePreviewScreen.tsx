import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BackButton } from '../../components/BackButton';
import { Button } from '../../components/Button';
import { BottomTab } from '../../components/BottomTab';
import { Text } from '../../components/Text';
import { getSamplePhotos, SamplePhotoImage } from '../../services/api';
import { SamplePhotos } from './PhotoValidationScreen';

interface SamplePreviewScreenProps {
  imageIds: string[];
  samplePhotos?: SamplePhotos;
  onNext: (imageIds: string[]) => void;
  onBack: () => void;
  navigation?: any;
}

const SCENARIO_LABELS: Record<string, string> = {
  white_photoshoot: 'Studio',
  pinterest_thirst: 'Pinterest',
  professional: 'Professional',
};

export const SamplePreviewScreen: React.FC<SamplePreviewScreenProps> = ({
  imageIds,
  samplePhotos: initialSamplePhotos,
  onNext,
  onBack,
  navigation,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const imageSize = screenWidth - 80;

  const [photos, setPhotos] = useState<SamplePhotoImage[]>(initialSamplePhotos?.photos || []);
  const [isLoading, setIsLoading] = useState(!initialSamplePhotos || initialSamplePhotos.isGenerating);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

  // Poll for sample photos if still generating
  useEffect(() => {
    if (initialSamplePhotos?.isGenerating) {
      const pollInterval = setInterval(async () => {
        try {
          const samples = await getSamplePhotos();
          if (samples && samples.length > 0) {
            setPhotos(samples);
            setIsLoading(false);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Error polling for sample photos:', error);
        }
      }, 3000);

      return () => clearInterval(pollInterval);
    } else if (initialSamplePhotos && !initialSamplePhotos.isGenerating) {
      setIsLoading(false);
    }
  }, [initialSamplePhotos?.isGenerating]);

  // Fetch sample photos if none were passed
  useEffect(() => {
    if (!initialSamplePhotos) {
      fetchSamplePhotos();
    }
  }, []);

  // Auto-scroll carousel
  useEffect(() => {
    if (photos.length > 1 && !isLoading) {
      autoScrollTimer.current = setInterval(() => {
        setCurrentIndex(prev => {
          const nextIndex = (prev + 1) % photos.length;
          scrollViewRef.current?.scrollTo({
            x: nextIndex * imageSize,
            animated: true,
          });
          return nextIndex;
        });
      }, 1500); // Change image every 1.5 seconds

      return () => {
        if (autoScrollTimer.current) {
          clearInterval(autoScrollTimer.current);
        }
      };
    }
  }, [photos.length, isLoading, imageSize]);

  const fetchSamplePhotos = async () => {
    try {
      const samples = await getSamplePhotos();
      if (samples && samples.length > 0) {
        setPhotos(samples);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching sample photos:', error);
      setIsLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / imageSize);
    setCurrentIndex(index);

    // Reset auto-scroll timer on manual scroll
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = setInterval(() => {
        setCurrentIndex(prev => {
          const nextIndex = (prev + 1) % photos.length;
          scrollViewRef.current?.scrollTo({
            x: nextIndex * imageSize,
            animated: true,
          });
          return nextIndex;
        });
      }, 1500);
    }
  };

  const handleContinue = () => {
    onNext(imageIds);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackButton onPress={onBack} />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text variant="title" style={[styles.title, { color: colors.text }]}>
              Select your scenarios
            </Text>
            <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
                Choose from 13 different scenarios to create the perfect dating profile photos
            </Text>
          </View>

          {/* Sample Photos Carousel */}
          <View style={[styles.carouselContainer, { width: imageSize, height: imageSize }]}>
            {isLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Generating your previews...
                </Text>
                <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>
                  This usually takes 30-60 seconds
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  style={styles.carousel}
                >
                  {photos.map((photo, index) => (
                    <View key={photo.id} style={[styles.slideContainer, { width: imageSize }]}>
                      <Image
                        source={{ uri: photo.downloadUrl! }}
                        style={[styles.sampleImage, { width: imageSize, height: imageSize }]}
                        resizeMode="cover"
                      />
                      {/* Scenario Label */}
                      <View style={[styles.scenarioLabel, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                        <Text style={styles.scenarioLabelText}>
                          {SCENARIO_LABELS[photo.scenario] || photo.scenario}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Pagination Dots */}
                {photos.length > 1 && (
                  <View style={styles.pagination}>
                    {photos.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          {
                            backgroundColor: index === currentIndex ? colors.primary : colors.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                Re-enforcing Photos
              </Text>
              <Text style={[styles.infoDescription, { color: colors.textSecondary }]}>
                Models can struggle to match features on first generation. We will create many generations to ensure that photos are able to match your features.
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom Tab */}
      <BottomTab>
        <Button
          title="Choose Scenarios"
          onPress={handleContinue}
          variant="primary"
        />
      </BottomTab>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    marginBottom: 30,
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  carouselContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
  },
  carousel: {
    flex: 1,
  },
  slideContainer: {
    position: 'relative',
  },
  sampleImage: {
    borderRadius: 16,
  },
  scenarioLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scenarioLabelText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    marginTop: 10,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
});
