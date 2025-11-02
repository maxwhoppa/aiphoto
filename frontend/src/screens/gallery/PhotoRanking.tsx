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

interface PhotoRankingProps {
  selectedPhotos: GeneratedPhoto[];
  onComplete: (topPhotos: { generatedImageId: string; order: number }[]) => void;
  onBack: () => void;
}

export const PhotoRanking: React.FC<PhotoRankingProps> = ({
  selectedPhotos,
  onComplete,
  onBack,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const photoSize = (screenWidth - 80) / 3; // 3 photos per row with spacing

  const [orderedPhotos, setOrderedPhotos] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoTap = useCallback((photoId: string) => {
    setOrderedPhotos(prev => {
      if (prev[photoId]) {
        // Photo already has an order - deselect it and adjust other orders
        const removedOrder = prev[photoId];
        const newOrdered = { ...prev };
        delete newOrdered[photoId];

        // Shift down all orders higher than the removed one
        Object.keys(newOrdered).forEach(id => {
          if (newOrdered[id] > removedOrder) {
            newOrdered[id]--;
          }
        });

        return newOrdered;
      } else {
        // Photo doesn't have an order - assign the next available order
        const currentOrders = Object.values(prev);
        const maxOrder = currentOrders.length > 0 ? Math.max(...currentOrders) : 0;

        if (maxOrder >= 6) {
          Alert.alert(
            'Maximum Photos Reached',
            'You can only select 6 photos for your profile. Remove one to add another.',
            [{ text: 'OK' }]
          );
          return prev;
        }

        return {
          ...prev,
          [photoId]: maxOrder + 1,
        };
      }
    });
  }, []);

  const handleComplete = useCallback(async () => {
    const orderedPhotoIds = Object.keys(orderedPhotos);

    if (orderedPhotoIds.length < 4) {
      Alert.alert(
        'Select More Photos',
        'Please select at least 4 photos for your profile.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);

    const selections = orderedPhotoIds.map(photoId => ({
      generatedImageId: photoId,
      order: orderedPhotos[photoId],
    }));

    onComplete(selections);
  }, [orderedPhotos, onComplete]);

  const getSelectedCount = () => Object.keys(orderedPhotos).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          onPress={onBack}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>Rank your top photos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select and order up to 6 photos
          </Text>
        </View>

        <View style={[styles.counter, { backgroundColor: colors.primary }]}>
          <Text style={[styles.counterText, { color: colors.background }]}>
            {getSelectedCount()}/6
          </Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={[styles.instructionText, { color: colors.text }]}>
          Tap photos to order them for your profile
        </Text>
        <Text style={[styles.instructionSubtext, { color: colors.textSecondary }]}>
          Tap again to deselect • First photo will be your main photo
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.photosGrid}>
          {selectedPhotos.map((photo) => {
            const orderNumber = orderedPhotos[photo.id];
            const isSelected = !!orderNumber;

            return (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.photoItem,
                  { width: photoSize, height: photoSize },
                  isSelected && styles.photoSelected,
                  isSelected && { borderColor: colors.primary }
                ]}
                onPress={() => handlePhotoTap(photo.id)}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />

                {/* Order Number Badge */}
                {isSelected && (
                  <View style={[styles.orderBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.orderText, { color: colors.background }]}>
                      {orderNumber}
                    </Text>
                  </View>
                )}

                {/* Scenario Tag */}
                <View style={[styles.scenarioTag, { backgroundColor: colors.background }]}>
                  <Text style={[styles.scenarioText, { color: colors.text }]}>
                    {photo.scenario}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Complete Button */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            { backgroundColor: getSelectedCount() >= 4 ? colors.primary : colors.surface },
            getSelectedCount() < 4 && styles.completeButtonDisabled
          ]}
          onPress={handleComplete}
          disabled={getSelectedCount() < 4 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Text style={[
                styles.completeButtonText,
                { color: getSelectedCount() >= 4 ? colors.background : colors.textSecondary }
              ]}>
                Create Profile with {getSelectedCount()} Photos
              </Text>
              <Ionicons
                name="checkmark"
                size={20}
                color={getSelectedCount() >= 4 ? colors.background : colors.textSecondary}
              />
            </>
          )}
        </TouchableOpacity>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  backText: {
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  orderBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  orderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  scenarioTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  scenarioText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 30,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});