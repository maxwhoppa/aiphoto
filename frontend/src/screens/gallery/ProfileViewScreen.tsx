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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
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
}> = ({ photo, size, onPress, colors }) => {
  return (
    <TouchableOpacity
      style={[styles.photoContainer, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.photo}
        contentFit="cover"
        priority="normal"
        cachePolicy="memory-disk"
        transition={{ duration: 150 }}
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        recyclingKey={photo.id}
      />

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
}

export const ProfileViewScreen: React.FC<ProfileViewScreenProps> = ({
  generatedPhotos,
  selectedScenarios,
  onGenerateAgain,
}) => {
  const { colors } = useTheme();
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [downloadingPhotos, setDownloadingPhotos] = useState<Set<string>>(new Set());
  const [savedPhotos, setSavedPhotos] = useState<Set<string>>(new Set());
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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

  const openImageViewer = (photo: GeneratedPhoto) => {
    const displayPhotos = getDisplayPhotos();
    const index = displayPhotos.findIndex(p => p.id === photo.id);
    setCurrentImageIndex(index);
    setImageViewerVisible(true);
  };

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

    Alert.alert(
      'Download All Photos',
      `Download ${photos.length} photos to your device?`,
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

  const renderPhoto = useCallback(({ item: photo }: { item: GeneratedPhoto }) => {
    const isDownloading = downloadingPhotos.has(photo.id);
    const isSaved = savedPhotos.has(photo.id);

    return (
      <View style={styles.photoWrapper}>
        <OptimizedImage
          photo={photo}
          size={photoSize}
          onPress={() => openImageViewer(photo)}
          colors={colors}
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
  }, [photoSize, colors, downloadingPhotos, savedPhotos]);

  const displayPhotos = getDisplayPhotos();

  // Optimized preloading: delay initial preload to not interfere with thumbnail rendering
  useEffect(() => {
    const preloadImages = async () => {
      const displayedPhotos = getDisplayPhotos();
      const visibleCount = 6; // Reduce initial batch size
      const batchSize = 4; // Smaller batch sizes

      // Delay preloading to let thumbnails render first
      setTimeout(async () => {
        // First, gently preload a few visible images
        const visibleUris = displayedPhotos.slice(0, visibleCount).map(photo => photo.uri);
        if (visibleUris.length > 0) {
          // Don't await this - let it happen in background
          Promise.allSettled(
            visibleUris.map(uri =>
              Image.prefetch(uri, { cachePolicy: 'memory' }).catch(() => {})
            )
          );
        }

        // Then preload remaining images with longer delays
        const remainingUris = displayedPhotos.slice(visibleCount).map(photo => photo.uri);
        if (remainingUris.length > 0) {
          setTimeout(async () => {
            for (let i = 0; i < remainingUris.length; i += batchSize) {
              const batch = remainingUris.slice(i, i + batchSize);

              // Non-blocking batch preload with disk cache only
              Promise.allSettled(
                batch.map(uri =>
                  Image.prefetch(uri, { cachePolicy: 'disk' }).catch(() => {})
                )
              );

              // Longer delay between batches
              if (i + batchSize < remainingUris.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
          }, 500); // Longer initial delay
        }
      }, 300); // Give thumbnails time to render first
    };

    if (generatedPhotos.length > 0) {
      preloadImages();
    }
  }, [generatedPhotos, selectedTab]);

  // Transform photos for ImageViewing component - always use full-size images
  const imageViewerImages = displayPhotos.map(photo => ({ uri: photo.uri }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header removed */}

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => {
          const isSelected = selectedTab === tab;
          const tabLabel = tab === 'all' ? `All (${generatedPhotos.length})` : 
                         `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${photosByScenario[tab]?.length || 0})`;
          
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isSelected ? colors.background : colors.text }
                ]}
              >
                {tabLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionBarButton, { backgroundColor: colors.secondary }]}
          onPress={downloadAllPhotos}
        >
          <View style={styles.actionButtonContent}>
            <Ionicons name="download-outline" size={16} color={colors.background} />
            <Text style={[styles.actionBarButtonText, { color: colors.background }]}>
              Download All ({displayPhotos.length})
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBarButton, { backgroundColor: colors.accent }]}
          onPress={onGenerateAgain}
        >
          <View style={styles.actionButtonContent}>
            <Ionicons name="refresh-outline" size={16} color={colors.background} />
            <Text style={[styles.actionBarButtonText, { color: colors.background }]}>
              Generate Again
            </Text>
          </View>
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
            getItemLayout={(data, index) => ({
              length: photoSize + 15, // photo height + margin
              offset: (photoSize + 15) * Math.floor(index / 2),
              index,
            })}
            ListFooterComponent={() => (
              <View>
                {/* Tips */}
                <View style={[styles.tipsContainer, { backgroundColor: colors.surface }]}>
                  <View style={styles.tipsHeaderContent}>
                    <Ionicons name="phone-portrait-outline" size={20} color={colors.text} />
                    <Text style={[styles.tipsTitle, { color: colors.text }]}>
                      Using Your Photos
                    </Text>
                  </View>
                  <View style={styles.tips}>
                    <Text style={[styles.tip, { color: colors.textSecondary }]}>
                      • Save all photos to your device for easy access
                    </Text>
                    <Text style={[styles.tip, { color: colors.textSecondary }]}>
                      • Use different scenarios for different dating apps
                    </Text>
                    <Text style={[styles.tip, { color: colors.textSecondary }]}>
                      • Professional photoshoot photos work best as main profile pics
                    </Text>
                    <Text style={[styles.tip, { color: colors.textSecondary }]}>
                      • Mix lifestyle photos (gym, beach) with professional ones
                    </Text>
                  </View>
                </View>
                <View style={styles.bottomSpacer} />
              </View>
            )}
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
      <ImageViewing
        images={imageViewerImages}
        imageIndex={currentImageIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        HeaderComponent={({ imageIndex }) => {
          const currentPhoto = displayPhotos[imageIndex];
          const isCurrentPhotoDownloading = currentPhoto && downloadingPhotos.has(currentPhoto.id);
          const isCurrentPhotoSaved = currentPhoto && savedPhotos.has(currentPhoto.id);

          return (
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                style={[styles.imageViewerButton, { backgroundColor: colors.surface }]}
                onPress={() => setImageViewerVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.imageViewerCounter}>
                <Text style={[styles.imageViewerCounterText, { color: colors.background }]}>
                  {imageIndex + 1} / {displayPhotos.length}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.imageViewerButton,
                  {
                    backgroundColor: isCurrentPhotoDownloading ? colors.surface : colors.primary
                  }
                ]}
                onPress={() => {
                  if (currentPhoto && !isCurrentPhotoDownloading) {
                    downloadPhoto(currentPhoto);
                  }
                }}
                disabled={isCurrentPhotoDownloading}
              >
                {isCurrentPhotoDownloading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.text}
                  />
                ) : (
                  <Ionicons
                    name={isCurrentPhotoSaved ? "checkmark" : "download-outline"}
                    size={18}
                    color={colors.background}
                  />
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        FooterComponent={({ imageIndex }) => (
          <View style={styles.imageViewerFooter}>
            <Text style={[styles.imageViewerScenarioText, { color: colors.background }]}>
              {displayPhotos[imageIndex]?.scenario}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  actionBarButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  tipsContainer: {
    marginTop: 30,
    padding: 20,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tips: {
    gap: 8,
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  // Image Viewer styles
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