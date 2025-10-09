import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Share,
  FlatList,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// Optimized image component with expo-image for better performance
const OptimizedImage: React.FC<{
  photo: GeneratedPhoto;
  size: number;
  onPress: () => void;
  colors: any;
  index?: number;
  isLoaded: boolean;
  onImageLoad: (photoId: string) => void;
}> = ({ photo, size, onPress, colors, index = 0, isLoaded, onImageLoad }) => {
  const [hasLoadedOnce, setHasLoadedOnce] = useState(isLoaded);

  // Prioritize first visible images
  const priority = index < 10 ? 'high' : 'normal';

  // Image is clickable once it has loaded at least once
  const canClick = hasLoadedOnce;

  return (
    <TouchableOpacity
      style={[styles.photoContainer, { width: size, height: size }]}
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
          // onLoad fires when image loads (from cache or network)
          setHasLoadedOnce(true);
          onImageLoad(photo.id);
        }}
        onError={(error) => {
          console.error('Failed to load image:', photo.id, error);
          // Still mark as loaded to remove spinner
          setHasLoadedOnce(true);
          onImageLoad(photo.id);
        }}
      />

      {/* Loading overlay for unloaded images */}
      {!canClick && (
        <View style={styles.thumbnailLoadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
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
}

interface ProfileViewScreenProps {
  generatedPhotos: GeneratedPhoto[];
  selectedScenarios: string[];
  onGenerateAgain: () => void;
  onRefresh?: () => Promise<void>;
  onSelectProfilePhotos?: () => void;
  onViewProfile?: () => void;
  hasSelectedPhotos?: boolean;
}

export const ProfileViewScreen: React.FC<ProfileViewScreenProps> = ({
  generatedPhotos,
  selectedScenarios,
  onGenerateAgain,
  onRefresh,
  onSelectProfilePhotos,
  onViewProfile,
  hasSelectedPhotos = false,
}) => {
  const { colors } = useTheme();
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [downloadingPhotos, setDownloadingPhotos] = useState<Set<string>>(new Set());
  const [savedPhotos, setSavedPhotos] = useState<Set<string>>(new Set());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const photoSize = (screenWidth - 60) / 2; // 2 photos per row with spacing

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

  const requestMediaLibraryPermissions = async () => {
    try {
      // First check current permission status
      const { status: currentStatus } = await MediaLibrary.getPermissionsAsync();

      if (currentStatus === 'granted') {
        return true;
      }

      // Request permission if not granted
      const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();

      if (newStatus === 'granted') {
        return true;
      }

      // Handle permission denied
      Alert.alert(
        'Permission Required',
        'We need permission to save photos to your device. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              // On iOS, this will open the app's settings page
              MediaLibrary.requestPermissionsAsync();
            }
          }
        ]
      );
      return false;

    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert(
        'Permission Error',
        'Unable to request media library permissions. Please check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const openImageViewer = useCallback(async (photo: GeneratedPhoto) => {
    const displayPhotos = getDisplayPhotos();
    const index = displayPhotos.findIndex(p => p.id === photo.id);

    // Validate that we found the photo
    if (index === -1 || !displayPhotos[index]) {
      console.warn('Photo not found in current display photos');
      return;
    }

    setCurrentImageIndex(index);

    // Show modal immediately with already-loaded image
    setImageViewerVisible(true);

    // After modal is open, preload only adjacent images (not the current one)
    setTimeout(() => {
      const preloadAdjacent = async () => {
        // Only preload next and previous
        const nextIndex = (index + 1) % displayPhotos.length;
        const prevIndex = index > 0 ? index - 1 : displayPhotos.length - 1;

        const adjacentPhotos = [
          displayPhotos[nextIndex],
          displayPhotos[prevIndex]
        ].filter(Boolean);

        for (const photoToPreload of adjacentPhotos) {
          if (!preloadedImages.has(photoToPreload.id)) {
            const uri = photoToPreload.downloadUrl || photoToPreload.uri;
            Image.prefetch(uri, { cachePolicy: 'memory-disk' }).catch(() => {});
          }
        }
      };

      preloadAdjacent();
    }, 500); // Delay adjacent preloading
  }, [preloadedImages, selectedTab, generatedPhotos, photosByScenario]);

  const downloadPhoto = async (photo: GeneratedPhoto) => {
    console.log('Starting download for photo:', photo.id);

    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
      console.log('Permission denied for photo download');
      return;
    }

    setDownloadingPhotos(prev => new Set(prev).add(photo.id));

    try {
      const downloadUrl = photo.downloadUrl || photo.uri;
      if (!downloadUrl) {
        throw new Error('No download URL available');
      }

      console.log('Downloading from URL:', downloadUrl);

      // Download and save to gallery
      const tempFileName = `dreamboat_${photo.scenario}_${photo.id}.jpg`;
      const tempFileUri = `${FileSystem.cacheDirectory}${tempFileName}`;

      console.log('Downloading to temp file:', tempFileUri);
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempFileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      console.log('Creating asset from:', downloadResult.uri);
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      console.log('Asset created:', asset.id);

      try {
        // Try to create/add to album
        await MediaLibrary.createAlbumAsync('DreamBoat AI', asset, false);
        console.log('Added to DreamBoat AI album');
      } catch (albumError) {
        console.log('Album creation failed, but photo still saved:', albumError);
        // Photo is still saved even if album creation fails
      }

      // Show checkmark briefly instead of popup
      setSavedPhotos(prev => new Set(prev).add(photo.id));
      // Remove checkmark after 2 seconds
      setTimeout(() => {
        setSavedPhotos(prev => {
          const newSet = new Set(prev);
          newSet.delete(photo.id);
          return newSet;
        });
      }, 2000);
    } catch (error: any) {
      console.error('Download error:', error);
      Alert.alert(
        'Save Error',
        `Failed to save photo: ${error.message || 'Unknown error'}. Please try again.`
      );
    } finally {
      setDownloadingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    }
  };

  const downloadAllPhotos = async () => {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return;

    const photos = getDisplayPhotos();
    const filterLabel = selectedTab === 'all' ? 'all' : selectedTab;

    Alert.alert(
      'Download Photos',
      `Download ${photos.length} ${filterLabel} photos to your device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            // Set all photos as downloading
            const photoIds = photos.map(p => p.id);
            setDownloadingPhotos(new Set(photoIds));

            let successCount = 0;
            let failedCount = 0;

            try {
              // Process all photos in parallel for faster downloads
              const downloadPromises = photos.map(async (photo) => {
                try {
                  const downloadUrl = photo.downloadUrl || photo.uri;
                  if (!downloadUrl) {
                    throw new Error('No download URL available');
                  }

                  // Download to temp file
                  const tempFileName = `dreamboat_${photo.scenario}_${photo.id}.jpg`;
                  const tempFileUri = `${FileSystem.cacheDirectory}${tempFileName}`;
                  const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempFileUri);

                  if (downloadResult.status !== 200) {
                    throw new Error(`Download failed with status ${downloadResult.status}`);
                  }

                  // Save to gallery
                  const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

                  try {
                    await MediaLibrary.createAlbumAsync('DreamBoat AI', asset, false);
                  } catch (albumError) {
                    // Album creation can fail but photo is still saved
                    console.log('Album creation failed for photo:', photo.id, albumError);
                  }

                  successCount++;
                } catch (error) {
                  console.error(`Failed to download photo ${photo.id}:`, error);
                  failedCount++;
                }
              });

              // Wait for all downloads to complete
              await Promise.allSettled(downloadPromises);

              // Show single result message
              if (failedCount === 0) {
                Alert.alert('Success', `All ${successCount} photos saved to your gallery!`);
              } else if (successCount === 0) {
                Alert.alert('Error', `Failed to save all ${failedCount} photos. Please try again.`);
              } else {
                Alert.alert(
                  'Partially Complete',
                  `${successCount} photos saved successfully, ${failedCount} failed. Please try downloading the failed ones individually.`
                );
              }

            } catch (error) {
              console.error('Batch download error:', error);
              Alert.alert('Error', 'Failed to download photos. Please try again.');
            } finally {
              // Clear downloading state for all photos
              setDownloadingPhotos(new Set());
            }
          }
        }
      ]
    );
  };

  const sharePhoto = async (photo: GeneratedPhoto) => {
    try {
      await Share.share({
        url: photo.uri,
        message: 'Check out my AI-generated photo from DreamBoat AI!',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const renderPhoto = useCallback(({ item: photo, index }: { item: GeneratedPhoto; index: number }) => {
    const isDownloading = downloadingPhotos.has(photo.id);
    const isSaved = savedPhotos.has(photo.id);
    const isLoaded = loadedImages.has(photo.id);

    return (
      <View style={styles.photoWrapper}>
        <OptimizedImage
          photo={photo}
          size={photoSize}
          onPress={() => openImageViewer(photo)}
          colors={colors}
          index={index}
          isLoaded={isLoaded}
          onImageLoad={(photoId) => {
            setLoadedImages(prev => new Set(prev).add(photoId));
          }}
        />

        {/* Download indicator overlay */}
        {isDownloading && (
          <View style={styles.downloadingOverlay}>
            <View style={[styles.downloadingModal, { backgroundColor: colors.surface }]}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.spinner}
              />
              <Text style={[styles.downloadingLabel, { color: colors.text }]}>
                Saving...
              </Text>
            </View>
          </View>
        )}

        {/* Saved checkmark overlay */}
        {isSaved && (
          <View style={styles.savedOverlay}>
            <Ionicons name="checkmark" size={18} color={colors.background} />
          </View>
        )}
      </View>
    );
  }, [photoSize, colors, downloadingPhotos, savedPhotos, openImageViewer, loadedImages]);

  const displayPhotos = getDisplayPhotos();

  // Handle pull-to-refresh - only triggers on release
  const handleRefresh = useCallback(() => {
    console.log('Pull-to-refresh released, starting refresh...');

    if (!onRefresh || isRefreshing) {
      console.log('Refresh blocked:', !onRefresh ? 'no handler' : 'already refreshing');
      return;
    }

    // Set refreshing state immediately
    setIsRefreshing(true);

    // Perform the actual refresh asynchronously
    (async () => {
      // Minimum refresh duration for better UX
      const minimumRefreshPromise = new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Run refresh and minimum duration in parallel
        await Promise.all([
          onRefresh(),
          minimumRefreshPromise
        ]);
        console.log('Refresh completed successfully');
      } catch (error) {
        console.error('Error refreshing images:', error);
        Alert.alert('Refresh Failed', 'Unable to refresh images. Please try again.');
      } finally {
        // End refresh state
        setIsRefreshing(false);
      }
    })();
  }, [onRefresh, isRefreshing]);

  // Reset loaded images when photos change significantly
  useEffect(() => {
    // If we get completely new photos, clear the loaded cache
    if (generatedPhotos.length > 0) {
      // Don't clear on every render, only when photos actually change
      setLoadedImages(new Set());
    }
  }, [generatedPhotos.length]); // Only reset when count changes


  // Close modal when switching tabs but keep loaded images
  useEffect(() => {
    setImageViewerVisible(false);
    // Don't clear loaded images - they're already cached
  }, [selectedTab]);

  // Removed aggressive preloading - let images load naturally as they appear


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Action Buttons - Moved to top */}
      <View style={styles.topActionsContainer}>
        {(onSelectProfilePhotos || onViewProfile) && (
          <TouchableOpacity
            style={[styles.topActionButton, { backgroundColor: colors.primary }]}
            onPress={hasSelectedPhotos && onViewProfile ? onViewProfile : onSelectProfilePhotos}
          >
            <View style={styles.topActionButtonContent}>
              <Ionicons
                name={hasSelectedPhotos ? "person-outline" : "heart-outline"}
                size={18}
                color={colors.background}
              />
              <Text style={[styles.topActionButtonText, { color: colors.background }]}>
                {hasSelectedPhotos ? "Profile" : "Select Profile"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.topActionButton, { backgroundColor: colors.secondary }]}
          onPress={downloadAllPhotos}
        >
          <View style={styles.topActionButtonContent}>
            <Ionicons name="download-outline" size={18} color={colors.background} />
            <Text style={[styles.topActionButtonText, { color: colors.background }]}>
              Download ({displayPhotos.length})
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topActionButton, { backgroundColor: colors.accent }]}
          onPress={onGenerateAgain}
        >
          <View style={styles.topActionButtonContent}>
            <Ionicons name="refresh-outline" size={18} color={colors.background} />
            <Text style={[styles.topActionButtonText, { color: colors.background }]}>
              Generate Again
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Filter Dropdown */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Text style={[styles.filterButtonText, { color: colors.text }]}>
            {selectedTab === 'all' ? `All Photos (${generatedPhotos.length})` :
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
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressViewOffset={0}
                />
              ) : undefined
            }
            getItemLayout={(data, index) => ({
              length: photoSize + 15, // photo height + margin
              offset: (photoSize + 15) * Math.floor(index / 2),
              index,
            })}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No photos in this category
            </Text>
          </View>
        )}
      </View>

      {/* Native Image Viewer */}
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
                  {/* Header */}
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
                      style={[
                        styles.imageViewerButton,
                        {
                          backgroundColor: downloadingPhotos.has(displayPhotos[currentImageIndex].id) ? colors.surface : colors.primary
                        }
                      ]}
                      onPress={() => {
                        const currentPhoto = displayPhotos[currentImageIndex];
                        if (currentPhoto && !downloadingPhotos.has(currentPhoto.id)) {
                          downloadPhoto(currentPhoto);
                        }
                      }}
                      disabled={downloadingPhotos.has(displayPhotos[currentImageIndex].id)}
                    >
                      {downloadingPhotos.has(displayPhotos[currentImageIndex].id) ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.text}
                        />
                      ) : (
                        <Ionicons
                          name={savedPhotos.has(displayPhotos[currentImageIndex].id) ? "checkmark" : "download-outline"}
                          size={18}
                          color={colors.background}
                        />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Image container - uses same URL as thumbnail so should be instant */}
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
                        onLoadEnd={() => {
                          // Preload high-res version if available
                          if (displayPhotos[currentImageIndex].downloadUrl &&
                              displayPhotos[currentImageIndex].downloadUrl !== displayPhotos[currentImageIndex].uri) {
                            // Load high-res version in background
                            Image.prefetch(displayPhotos[currentImageIndex].downloadUrl, {
                              cachePolicy: 'memory-disk'
                            }).catch(() => {});
                          }

                          // Preload adjacent images
                          setTimeout(() => {
                            const nextIndex = (currentImageIndex + 1) % displayPhotos.length;
                            const prevIndex = currentImageIndex > 0 ? currentImageIndex - 1 : displayPhotos.length - 1;

                            if (displayPhotos[nextIndex]) {
                              Image.prefetch(displayPhotos[nextIndex].uri, {
                                cachePolicy: 'memory-disk'
                              }).catch(() => {});
                            }
                            if (displayPhotos[prevIndex]) {
                              Image.prefetch(displayPhotos[prevIndex].uri, {
                                cachePolicy: 'memory-disk'
                              }).catch(() => {});
                            }
                          }, 300);
                        }}
                      />
                    </View>
                  </TouchableWithoutFeedback>

                  {/* Footer */}
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
                  Filter Photos
                </Text>

                <ScrollView style={styles.filterOptionsContainer}>
                  {tabs.map((tab) => {
                    const isSelected = selectedTab === tab;
                    const tabLabel = tab === 'all' ? `All Photos (${generatedPhotos.length})` :
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // New top action button styles
  topActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  topActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0, // Allow flex shrinking
  },
  topActionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  topActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textAlign: 'center',
    flexShrink: 1, // Allow text to shrink if needed
  },
  // Filter dropdown styles
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  // Filter modal styles
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
  // Legacy styles (keeping for now but removing unused ones later)
  tabsContainer: {
    maxHeight: 50,
    marginBottom: 15,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  photosContainer: {
    paddingHorizontal: 20,
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
  photo: {
    width: '100%',
    height: '100%',
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingModal: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  spinner: {
    marginBottom: 10,
  },
  downloadingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  savedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  savedText: {
    fontSize: 18,
    fontWeight: 'bold',
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
  // Image Viewer styles
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
  imageViewerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
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