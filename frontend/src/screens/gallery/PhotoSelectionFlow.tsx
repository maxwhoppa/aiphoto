import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
}

interface PhotoSelectionFlowProps {
  photosByScenario: Record<string, GeneratedPhoto[]>;
  selectedScenarios: string[];
  onComplete: (selections: { generatedImageId: string; order: number }[]) => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const PhotoSelectionFlow: React.FC<PhotoSelectionFlowProps> = ({
  photosByScenario,
  selectedScenarios,
  onComplete,
  onSkip,
  onBack,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const photoSize = (screenWidth - 80) / 3; // 3 photos per row with spacing

  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [selectedPhotosMap, setSelectedPhotosMap] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentScenario = selectedScenarios[currentScenarioIndex];
  const currentPhotos = photosByScenario[currentScenario] || [];
  const selectedForScenario = selectedPhotosMap[currentScenario] || [];

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotosMap(prev => {
      const current = prev[currentScenario] || [];

      if (current.includes(photoId)) {
        // Remove from selection
        return {
          ...prev,
          [currentScenario]: current.filter(id => id !== photoId),
        };
      } else {
        // Add to selection (max 2 per scenario)
        if (current.length >= 2) {
          Alert.alert(
            'Maximum Photos Selected',
            'You can select up to 2 photos per scenario. Deselect one to choose another.',
            [{ text: 'OK' }]
          );
          return prev;
        }
        return {
          ...prev,
          [currentScenario]: [...current, photoId],
        };
      }
    });
  }, [currentScenario]);

  const handleNext = useCallback(() => {
    if (currentScenarioIndex < selectedScenarios.length - 1) {
      setCurrentScenarioIndex(prev => prev + 1);
    } else {
      // We're at the last scenario, prepare final selections
      handleSubmit();
    }
  }, [currentScenarioIndex, selectedScenarios.length]);

  const handlePrevious = useCallback(() => {
    if (currentScenarioIndex > 0) {
      setCurrentScenarioIndex(prev => prev - 1);
    }
  }, [currentScenarioIndex]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    // Compile all selections with order
    const allSelections: { generatedImageId: string; order: number }[] = [];
    let orderCounter = 1;

    selectedScenarios.forEach(scenario => {
      const selections = selectedPhotosMap[scenario] || [];
      selections.forEach(photoId => {
        if (orderCounter <= 6) {
          allSelections.push({
            generatedImageId: photoId,
            order: orderCounter++,
          });
        }
      });
    });

    if (allSelections.length === 0) {
      Alert.alert(
        'No Photos Selected',
        'Please select at least one photo for your profile.',
        [{ text: 'OK', onPress: () => setIsSubmitting(false) }]
      );
      return;
    }

    if (allSelections.length < 4) {
      Alert.alert(
        'More Photos Recommended',
        `You've selected ${allSelections.length} photo${allSelections.length === 1 ? '' : 's'}. We recommend selecting at least 4 photos for a complete profile. Continue anyway?`,
        [
          { text: 'Go Back', style: 'cancel', onPress: () => setIsSubmitting(false) },
          { text: 'Continue', onPress: () => onComplete(allSelections) },
        ]
      );
      return;
    }

    onComplete(allSelections);
  }, [selectedPhotosMap, selectedScenarios, onComplete]);

  const getTotalSelections = () => {
    return Object.values(selectedPhotosMap).reduce((sum, selections) => sum + selections.length, 0);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.skipButton, { backgroundColor: colors.surface }]}
          onPress={onBack || onSkip}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {onBack ? 'Back' : 'Skip'}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>Select Your Best Photos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {currentScenario.charAt(0).toUpperCase() + currentScenario.slice(1)} ({currentScenarioIndex + 1}/{selectedScenarios.length})
          </Text>
        </View>

        <View style={[styles.counter, { backgroundColor: colors.primary }]}>
          <Text style={[styles.counterText, { color: colors.background }]}>
            {getTotalSelections()}/6
          </Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={[styles.instructionText, { color: colors.text }]}>
          Select 0-2 photos from this scenario
        </Text>
        <Text style={[styles.instructionSubtext, { color: colors.textSecondary }]}>
          {selectedForScenario.length}/2 selected
        </Text>
      </View>

      {/* Photos Grid */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.photosContainer}
      >
        <View style={styles.photosGrid}>
          {currentPhotos.map((photo) => {
            const isSelected = selectedForScenario.includes(photo.id);
            return (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.photoItem,
                  { width: photoSize, height: photoSize },
                  isSelected && styles.photoSelected,
                  isSelected && { borderColor: colors.primary }
                ]}
                onPress={() => togglePhotoSelection(photo.id)}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={20} color={colors.background} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[
            styles.navButton,
            { backgroundColor: colors.surface },
            currentScenarioIndex === 0 && styles.navButtonDisabled
          ]}
          onPress={handlePrevious}
          disabled={currentScenarioIndex === 0}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentScenarioIndex === 0 ? colors.textSecondary : colors.text}
          />
          <Text style={[
            styles.navButtonText,
            { color: currentScenarioIndex === 0 ? colors.textSecondary : colors.text }
          ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            styles.navButtonPrimary,
            { backgroundColor: colors.primary }
          ]}
          onPress={handleNext}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Text style={[styles.navButtonText, { color: colors.background }]}>
                {currentScenarioIndex === selectedScenarios.length - 1 ? 'Finish' : 'Next'}
              </Text>
              <Ionicons
                name={currentScenarioIndex === selectedScenarios.length - 1 ? "checkmark" : "chevron-forward"}
                size={24}
                color={colors.background}
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${((currentScenarioIndex + 1) / selectedScenarios.length) * 100}%`
            }
          ]}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  counter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  instructionSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  photosContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  photoSelected: {
    borderWidth: 3,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  navigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  navButtonPrimary: {
    flex: 1.5,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});