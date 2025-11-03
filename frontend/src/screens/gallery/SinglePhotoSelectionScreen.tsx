import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../components/BackButton';
import { BottomTab } from '../../components/BottomTab';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';

// Optimized image component
const OptimizedImage: React.FC<{
  photo: GeneratedPhoto;
  size: number;
  onPress: () => void;
  colors: any;
  index?: number;
  isLoaded: boolean;
  onImageLoad: (photoId: string) => void;
  isSelected?: boolean;
}> = ({ photo, size, onPress, colors, index = 0, isLoaded, onImageLoad, isSelected }) => {
  const [hasLoadedOnce, setHasLoadedOnce] = useState(isLoaded);
  const priority = index < 10 ? 'high' : 'normal';
  const canClick = hasLoadedOnce;

  return (
    <TouchableOpacity
      style={[
        styles.photoContainer,
        { width: size, height: size },
        isSelected && styles.selectedPhoto
      ]}
      onPress={canClick ? onPress : undefined}
      activeOpacity={canClick ? 0.8 : 1}
      disabled={!canClick}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.photo}
        contentFit="cover"
        priority={priority}
        cachePolicy="memory-disk"
        transition={{ duration: 150 }}
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        onLoad={() => {
          setHasLoadedOnce(true);
          onImageLoad(photo.id);
        }}
        onError={(error) => {
          console.error('Failed to load image:', photo.id, error);
          setHasLoadedOnce(true);
          onImageLoad(photo.id);
        }}
      />

      {!canClick && (
        <View style={styles.thumbnailLoadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {isSelected && (
        <View style={[styles.selectedOverlay, { backgroundColor: colors.primary + '40' }]}>
          <View style={[styles.selectedCheckmark, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={20} color={colors.background} />
          </View>
        </View>
      )}

      <View style={[styles.scenarioTag, { backgroundColor: colors.background }]}>
        <Text style={[styles.scenarioText, { color: colors.text }]}>
          {photo.scenario}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
  selectedProfileOrder?: number | null;
}

interface SinglePhotoSelectionScreenProps {
  generatedPhotos: GeneratedPhoto[];
  selectedScenarios: string[];
  currentPhoto: GeneratedPhoto;
  photoIndex: number;
  onPhotoSelect: (photo: GeneratedPhoto, index: number) => void;
  onCancel: () => void;
}

export const SinglePhotoSelectionScreen: React.FC<SinglePhotoSelectionScreenProps> = ({
  generatedPhotos,
  selectedScenarios,
  currentPhoto,
  photoIndex,
  onPhotoSelect,
  onCancel,
}) => {
  const { colors } = useTheme();
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<GeneratedPhoto | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const photoSize = (screenWidth - 60) / 2;

  // Group photos by scenario
  const photosByScenario = generatedPhotos.reduce((acc, photo) => {
    if (!acc[photo.scenario]) {
      acc[photo.scenario] = [];
    }
    acc[photo.scenario].push(photo);
    return acc;
  }, {} as Record<string, GeneratedPhoto[]>);

  const tabs = ['all', ...selectedScenarios];

  const getDisplayPhotos = () => {
    if (selectedTab === 'all') {
      return generatedPhotos;
    }
    return photosByScenario[selectedTab] || [];
  };

  const handlePhotoSelect = (photo: GeneratedPhoto) => {
    setSelectedPhoto(photo);
  };

  const handleConfirmSelection = () => {
    if (selectedPhoto) {
      onPhotoSelect(selectedPhoto, photoIndex);
    }
  };

  const openImageViewer = useCallback(async (photo: GeneratedPhoto) => {
    const displayPhotos = getDisplayPhotos();
    const index = displayPhotos.findIndex(p => p.id === photo.id);

    if (index === -1 || !displayPhotos[index]) {
      console.warn('Photo not found in current display photos');
      return;
    }

    setCurrentImageIndex(index);
    setImageViewerVisible(true);

    // Preload adjacent images
    setTimeout(() => {
      const preloadAdjacent = async () => {
        const nextIndex = (index + 1) % displayPhotos.length;
        const prevIndex = index > 0 ? index - 1 : displayPhotos.length - 1;

        const adjacentPhotos = [
          displayPhotos[nextIndex],
          displayPhotos[prevIndex]
        ].filter(Boolean);

        for (const photoToPreload of adjacentPhotos) {
          const uri = photoToPreload.downloadUrl || photoToPreload.uri;
          Image.prefetch(uri, { cachePolicy: 'memory-disk' }).catch(() => {});
        }
      };

      preloadAdjacent();
    }, 500);
  }, [selectedTab, generatedPhotos, photosByScenario]);

  const renderPhoto = useCallback(({ item: photo, index }: { item: GeneratedPhoto; index: number }) => {
    const isLoaded = loadedImages.has(photo.id);
    const isSelected = selectedPhoto?.id === photo.id;

    return (
      <View style={styles.photoWrapper}>
        <OptimizedImage
          photo={photo}
          size={photoSize}
          onPress={() => handlePhotoSelect(photo)}
          colors={colors}
          index={index}
          isLoaded={isLoaded}
          onImageLoad={(photoId) => {
            setLoadedImages(prev => new Set(prev).add(photoId));
          }}
          isSelected={isSelected}
        />
      </View>
    );
  }, [photoSize, colors, loadedImages, selectedPhoto]);

  const displayPhotos = getDisplayPhotos();

  useEffect(() => {
    setImageViewerVisible(false);
  }, [selectedTab]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackButton onPress={onCancel} />

        <View style={[styles.header, { marginTop: 20 }]}>
          <Text style={[styles.title, { color: colors.text }]}>Replace photo {photoIndex + 1}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Current: {currentPhoto.scenario}
          </Text>
        </View>

        {/* Filter Dropdown */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Text style={[styles.filterButtonText, { color: colors.text }]}>
              {selectedTab === 'all' ? `All photos (${generatedPhotos.length})` :
               `${selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)} (${photosByScenario[selectedTab]?.length || 0})`}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Photos Grid */}
        <View style={styles.content}>
          {displayPhotos.length > 0 ? (
            <FlatList
              data={displayPhotos}
              renderItem={renderPhoto}
              keyExtractor={(photo) => photo.id}
              numColumns={2}
              columnWrapperStyle={styles.photosRow}
              contentContainerStyle={styles.photosContainer}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={false}
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={10}
              contentInsetAdjustmentBehavior="automatic"
              automaticallyAdjustContentInsets={true}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No photos in this category
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setImageViewerVisible(false)}>
          <View style={styles.modalContainer}>
            {displayPhotos && displayPhotos.length > 0 && displayPhotos[currentImageIndex] ? (
              <TouchableWithoutFeedback>
                <View style={{ flex: 1 }}>
                  <View style={styles.imageViewerHeader}>
                    <TouchableOpacity
                      style={[styles.imageViewerButton, { backgroundColor: colors.surface }]}
                      onPress={() => setImageViewerVisible(false)}
                    >
                      <Ionicons name="close" size={18} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.imageViewerCounter}>
                      <Text style={[styles.imageViewerCounterText, { color: colors.background }]}>
                        {currentImageIndex + 1} / {displayPhotos.length}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.imageViewerButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        handlePhotoSelect(displayPhotos[currentImageIndex]);
                        setImageViewerVisible(false);
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color={colors.background} />
                    </TouchableOpacity>
                  </View>

                  <TouchableWithoutFeedback>
                    <View style={styles.imageContainer}>
                      <Image
                        key={`${displayPhotos[currentImageIndex].id}-${currentImageIndex}`}
                        source={{ uri: displayPhotos[currentImageIndex].uri }}
                        style={styles.fullScreenImage}
                        contentFit="contain"
                        priority="high"
                        cachePolicy="memory-disk"
                        transition={{ duration: 0 }}
                      />
                    </View>
                  </TouchableWithoutFeedback>

                  <View style={styles.imageViewerFooter}>
                    <Text style={[styles.imageViewerScenarioText, { color: colors.background }]}>
                      {displayPhotos[currentImageIndex]?.scenario}
                    </Text>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            ) : null}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.filterModalContainer}>
            <TouchableWithoutFeedback>
              <View style={[styles.filterModalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.filterModalTitle, { color: colors.text }]}>
                  Filter photos
                </Text>

                <ScrollView style={styles.filterOptionsContainer}>
                  {tabs.map((tab) => {
                    const isSelected = selectedTab === tab;
                    const tabLabel = tab === 'all' ? `All photos (${generatedPhotos.length})` :
                                   `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${photosByScenario[tab]?.length || 0})`;

                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[
                          styles.filterOption,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderColor: colors.border,
                          }
                        ]}
                        onPress={() => {
                          setSelectedTab(tab);
                          setFilterModalVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            { color: isSelected ? colors.background : colors.text }
                          ]}
                        >
                          {tabLabel}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color={colors.background} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bottom Tab with Confirm Button */}
      <BottomTab showScrollIndicator={false}>
        <Button
          title={selectedPhoto ? `Replace with ${selectedPhoto.scenario} photo` : 'Select a photo to replace'}
          onPress={handleConfirmSelection}
          disabled={!selectedPhoto}
          variant={selectedPhoto ? 'primary' : 'disabled'}
          icon="checkmark-circle-outline"
        />
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
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
  header: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'left',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    marginTop: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  filterModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  filterModalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterOptionsContainer: {
    maxHeight: 300,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  filterOptionText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  photosContainer: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },
  photosRow: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  photoWrapper: {
    flex: 1,
    marginHorizontal: 5,
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 15,
  },
  selectedPhoto: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  selectedCheckmark: {
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
    elevation: 4,
  },
  thumbnailLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  fullScreenImage: {
    flex: 1,
    width: '100%',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  imageViewerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCounter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  imageViewerCounterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imageViewerFooter: {
    padding: 20,
    alignItems: 'center',
  },
  imageViewerScenarioText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});