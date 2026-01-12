import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { ProfileViewScreen } from './ProfileViewScreen';
import { ProfilePreview } from './ProfilePreview';
import { PhotoRanking } from './PhotoRanking';
import { SinglePhotoSelectionScreen } from './SinglePhotoSelectionScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { setSelectedProfilePhotos, getSelectedProfilePhotos, checkPaymentAccess, checkHasSubmittedFeedback } from '../../services/api';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { hasNewPhotos, setLastViewedPhotoCount } from '../../utils/photoViewTracking';
import { FeedbackModal } from '../../components/FeedbackModal';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
  selectedProfileOrder?: number | null;
}

interface ProfileScreenProps {
  generatedPhotos: GeneratedPhoto[];
  selectedScenarios: string[];
  onGenerateAgain: () => void;
  onRefresh?: () => Promise<void>;
  isGenerating?: boolean;
  generationMessage?: string;
  hasNewGeneratedPhotos?: boolean;
  onNewPhotosViewed?: () => void;
}

type ViewMode = 'ranking' | 'preview' | 'all' | 'single-select' | 'settings';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  generatedPhotos,
  selectedScenarios,
  onGenerateAgain,
  onRefresh,
  isGenerating = false,
  generationMessage = "Images Generating...",
  hasNewGeneratedPhotos = false,
  onNewPhotosViewed,
}) => {
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('preview');
  const isInitialMount = useRef(true);
  const [selectedPhotos, setSelectedPhotos] = useState<GeneratedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState<Set<string>>(new Set());
  const [photosToRank, setPhotosToRank] = useState<GeneratedPhoto[]>([]);
  const [hasUnviewedPhotos, setHasUnviewedPhotos] = useState(false);
  const [photoToReplace, setPhotoToReplace] = useState<{ index: number; photo: GeneratedPhoto } | null>(null);
  const [freeCredits, setFreeCredits] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const hasPromptedFeedbackThisSession = useRef(false);

  // Group photos by scenario for selection flow
  const photosByScenario = generatedPhotos.reduce((acc, photo) => {
    if (!acc[photo.scenario]) {
      acc[photo.scenario] = [];
    }
    acc[photo.scenario].push(photo);
    return acc;
  }, {} as Record<string, GeneratedPhoto[]>);

  // Load selected photos on mount
  useEffect(() => {
    const loadSelectedPhotos = async () => {
      setIsLoading(true);
      try {
        // First check if generatedPhotos already has selection info
        const existingSelections = generatedPhotos.filter(photo =>
          photo.selectedProfileOrder !== null && photo.selectedProfileOrder !== undefined
        );

        if (existingSelections.length > 0) {
          console.log('Found existing selections in generatedPhotos:', existingSelections.length);
          // Sort by selectedProfileOrder to ensure correct positioning
          const sortedSelections = existingSelections.sort((a, b) =>
            (a.selectedProfileOrder || 0) - (b.selectedProfileOrder || 0)
          );
          console.log('ProfileScreen: Sorted selections:', sortedSelections.map(p => ({ id: p.id, order: p.selectedProfileOrder })));
          setSelectedPhotos(sortedSelections);
          // Only set to preview mode on initial mount, not on refreshes
          if (isInitialMount.current) {
            setViewMode('preview');
          }
        } else {
          // Fall back to API call
          console.log('No selections in generatedPhotos, calling API...');
          const response = await getSelectedProfilePhotos();
          const data = response?.result?.data || [];

          if (data && data.length > 0) {
            // Map the selected photos from API to our format
            const selected = data.map((photo: any) => ({
              id: photo.id,
              uri: photo.downloadUrl || photo.s3Url,
              scenario: photo.scenario,
              downloadUrl: photo.downloadUrl || photo.s3Url,
              selectedProfileOrder: photo.selectedProfileOrder,
            }));
            // Sort by selectedProfileOrder to ensure correct positioning
            const sortedSelected = selected.sort((a, b) =>
              (a.selectedProfileOrder || 0) - (b.selectedProfileOrder || 0)
            );
            console.log('Found selections from API:', sortedSelected.length);
            console.log('ProfileScreen: API sorted selections:', sortedSelected.map(p => ({ id: p.id, order: p.selectedProfileOrder })));
            setSelectedPhotos(sortedSelected);
            // Only set to preview mode on initial mount, not on refreshes
            if (isInitialMount.current) {
              setViewMode('preview');
            }
          } else {
            // No selections yet, show profile preview anyway
            console.log('No selections found, showing profile preview');
            // Only set to preview mode on initial mount, not on refreshes
            if (isInitialMount.current) {
              setViewMode('preview');
            }
          }
        }
      } catch (error) {
        console.error('Error loading selected photos:', error);
        // Only set to preview mode on initial mount, not on refreshes
        if (isInitialMount.current) {
          setViewMode('preview');
        }
      } finally {
        setIsLoading(false);
        // Mark that initial mount is complete
        isInitialMount.current = false;
      }
    };

    loadSelectedPhotos();
  }, [generatedPhotos]);

  // Check if there are unviewed photos
  useEffect(() => {
    const checkForNewPhotos = async () => {
      const hasNew = await hasNewPhotos(generatedPhotos.length);
      console.log('ProfileScreen: hasNewPhotos =', hasNew, 'for count', generatedPhotos.length);
      setHasUnviewedPhotos(hasNew);
    };
    checkForNewPhotos();
  }, [generatedPhotos.length]);

  // Check for free credits on focus and when view mode changes to preview
  useFocusEffect(
    useCallback(() => {
      const checkCredits = async () => {
        try {
          const accessResult = await checkPaymentAccess();
          if (accessResult?.hasAccess) {
            setFreeCredits(1); // User has at least 1 free credit
            console.log('ProfileScreen: User has free credit available');
          } else {
            setFreeCredits(0);
          }
        } catch (error) {
          console.error('ProfileScreen: Error checking credits:', error);
          setFreeCredits(0);
        }
      };

      if (viewMode === 'preview') {
        checkCredits();
      }
    }, [viewMode])
  );

  const handleSelectionComplete = useCallback(async (selections: { generatedImageId: string; order: number }[]) => {
    setIsSaving(true);
    try {
      await setSelectedProfilePhotos(selections);

      // Update local state with the selected photos
      const selected = selections.map(sel => {
        const photo = generatedPhotos.find(p => p.id === sel.generatedImageId);
        if (photo) {
          return {
            ...photo,
            selectedProfileOrder: sel.order,
          };
        }
        return null;
      }).filter(Boolean) as GeneratedPhoto[];

      setSelectedPhotos(selected);
      setViewMode('preview');

      Alert.alert(
        'Profile Created!',
        'Your profile photos have been selected. You can now see how your profile looks!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving selections:', error);
      Alert.alert(
        'Error',
        'Failed to save your photo selections. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  }, [generatedPhotos]);

  const handleRankPhotos = useCallback((photos: GeneratedPhoto[]) => {
    setPhotosToRank(photos);
    setViewMode('ranking');
  }, []);

  const handleReselect = useCallback(() => {
    // Instead of going to selection flow, just stay in preview
    // User can replace individual photos if needed
    Alert.alert(
      'Photo Selection',
      'You can replace individual photos by tapping on them in your profile.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleAutoAddPhotos = useCallback(async () => {
    try {
      console.log('handleAutoAddPhotos: Starting auto-add process');

      // Refresh to get latest photos
      if (onRefresh) {
        await onRefresh();
      }

      // Calculate how many more photos we need
      const currentCount = selectedPhotos.length;
      const neededCount = Math.min(6 - currentCount, 6);

      if (neededCount <= 0) {
        console.log('handleAutoAddPhotos: Already have 6 photos');
        return;
      }

      // Get IDs of already selected photos
      const selectedIds = new Set(selectedPhotos.map(p => p.id));

      // Find unselected photos from generatedPhotos
      const unselectedPhotos = generatedPhotos.filter(p => !selectedIds.has(p.id));

      console.log('handleAutoAddPhotos: Found', unselectedPhotos.length, 'unselected photos, need', neededCount);

      if (unselectedPhotos.length === 0) {
        Alert.alert(
          'No More Photos Available',
          'All your photos have already been selected. Would you like to generate more photos to add to your profile?',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Generate More', onPress: onGenerateAgain },
          ]
        );
        return;
      }

      // Take the first N unselected photos (they should be sorted by quality/recency)
      const photosToAdd = unselectedPhotos.slice(0, neededCount);

      // Create new selections array with existing + new photos
      // Order must be 1-indexed (1-6) for the server
      const newSelections = [
        ...selectedPhotos.map((photo, index) => ({
          generatedImageId: photo.id,
          order: photo.selectedProfileOrder ?? (index + 1),
        })),
        ...photosToAdd.map((photo, index) => ({
          generatedImageId: photo.id,
          order: currentCount + index + 1, // 1-indexed
        })),
      ];

      console.log('handleAutoAddPhotos: Saving', newSelections.length, 'selections', newSelections);

      // Save to API
      await setSelectedProfilePhotos(newSelections);

      // Update local state
      const updatedSelectedPhotos = [
        ...selectedPhotos,
        ...photosToAdd.map((photo, index) => ({
          ...photo,
          selectedProfileOrder: currentCount + index + 1, // 1-indexed
        })),
      ];
      setSelectedPhotos(updatedSelectedPhotos);

      console.log('handleAutoAddPhotos: Added', photosToAdd.length, 'photos');
    } catch (error) {
      console.error('handleAutoAddPhotos: Error:', error);
      Alert.alert(
        'Error',
        'Failed to add photos. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [selectedPhotos, generatedPhotos, onRefresh, onGenerateAgain]);

  const handleSinglePhotoReplace = useCallback((photoIndex: number, currentPhoto: GeneratedPhoto) => {
    setPhotoToReplace({ index: photoIndex, photo: currentPhoto });
    setViewMode('single-select');
  }, []);

  const handleSinglePhotoSelection = useCallback(async (newPhoto: GeneratedPhoto, replacementIndex: number) => {
    setIsSaving(true);
    try {
      console.log('handleSinglePhotoSelection: Replacing photo at index', replacementIndex);
      console.log('handleSinglePhotoSelection: Current selectedPhotos:', selectedPhotos.map(p => ({ id: p.id, order: p.selectedProfileOrder })));

      // Create new array with the replaced photo
      const updatedPhotos = [...selectedPhotos];
      const originalOrder = updatedPhotos[replacementIndex].selectedProfileOrder;

      console.log('handleSinglePhotoSelection: Original order was:', originalOrder);

      const photoWithOrder = {
        ...newPhoto,
        selectedProfileOrder: originalOrder,
      };
      updatedPhotos[replacementIndex] = photoWithOrder;

      console.log('handleSinglePhotoSelection: Updated photos:', updatedPhotos.map(p => ({ id: p.id, order: p.selectedProfileOrder })));

      // Update the API with new selections - ensure we preserve exact orders
      const selections = updatedPhotos.map((photo) => ({
        generatedImageId: photo.id,
        order: photo.selectedProfileOrder!, // We know this exists since these are selected photos
      }));

      console.log('handleSinglePhotoSelection: Sending selections to API:', selections);

      await setSelectedProfilePhotos(selections);
      setSelectedPhotos(updatedPhotos);
      setViewMode('preview');
      setPhotoToReplace(null);
    } catch (error) {
      console.error('Error replacing photo:', error);
      Alert.alert(
        'Error',
        'Failed to replace the photo. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  }, [selectedPhotos]);

  const handleCancelSingleSelection = useCallback(() => {
    setPhotoToReplace(null);
    setViewMode('preview');
  }, []);

  const handleDownloadAll = useCallback(async () => {
    Alert.alert(
      'Download Profile Photos',
      `Download ${selectedPhotos.length} selected photos to your device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              // Check permissions right before downloading
              const hasPermission = await requestMediaLibraryPermissions();
              if (!hasPermission) return;

              // Set all photos as downloading
              const photoIds = selectedPhotos.map(p => p.id);
              setDownloadingPhotos(new Set(photoIds));

              let successCount = 0;
              let failedCount = 0;

              // Download all selected photos
              await Promise.allSettled(
                selectedPhotos.map(async (photo) => {
                  try {
                    const downloadUrl = photo.downloadUrl || photo.uri;
                    const tempFileName = `dreamboat_profile_${photo.scenario}_${photo.id}.jpg`;
                    const tempFileUri = `${FileSystem.cacheDirectory}${tempFileName}`;

                    const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempFileUri);
                    if (downloadResult.status !== 200) {
                      throw new Error(`Download failed with status ${downloadResult.status}`);
                    }

                    const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

                    try {
                      // Try to create/add to album
                      await MediaLibrary.createAlbumAsync('DreamBoat Profile', asset, false);
                      console.log('Added to DreamBoat Profile album');
                    } catch (albumError) {
                      console.log('Album creation failed, but photo still saved:', albumError);
                      // Photo is still saved even if album creation fails
                    }

                    successCount++;

                    // Remove from downloading state
                    setDownloadingPhotos(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(photo.id);
                      return newSet;
                    });
                  } catch (error) {
                    console.error(`Failed to download photo ${photo.id}:`, error);
                    failedCount++;

                    // Remove from downloading state even on failure
                    setDownloadingPhotos(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(photo.id);
                      return newSet;
                    });
                  }
                })
              );

              if (failedCount === 0) {
                Alert.alert('Success', `All ${successCount} profile photos saved!`);

                // Show feedback modal if not prompted this session and user hasn't submitted feedback before
                if (!hasPromptedFeedbackThisSession.current) {
                  try {
                    const hasSubmitted = await checkHasSubmittedFeedback();
                    if (!hasSubmitted) {
                      hasPromptedFeedbackThisSession.current = true;
                      // Small delay to let the success alert dismiss
                      setTimeout(() => {
                        setShowFeedbackModal(true);
                      }, 500);
                    }
                  } catch (error) {
                    console.log('Error checking feedback status:', error);
                  }
                }
              } else {
                Alert.alert(
                  'Partially Complete',
                  `${successCount} photos saved, ${failedCount} failed.`
                );
              }
            } catch (error) {
              console.error('Download error:', error);
              Alert.alert('Error', 'Failed to download photos. Please try again.');
              // Clear all downloading states on error
              setDownloadingPhotos(new Set());
            }
          },
        },
      ]
    );
  }, [selectedPhotos]);

  const requestMediaLibraryPermissions = async () => {
    try {
      const { status: currentStatus } = await MediaLibrary.getPermissionsAsync();
      if (currentStatus === 'granted') return true;

      const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
      if (newStatus === 'granted') return true;

      Alert.alert(
        'Permission Required',
        'We need permission to save photos to your device.',
        [{ text: 'OK' }]
      );
      return false;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }


  // Render based on current view mode
  switch (viewMode) {
    case 'ranking':
      return (
        <PhotoRanking
          selectedPhotos={photosToRank}
          onComplete={handleSelectionComplete}
          onBack={() => setViewMode('selection')}
        />
      );

    case 'preview':
      return (
        <>
          <ProfilePreview
            selectedPhotos={selectedPhotos}
            onDownloadAll={handleDownloadAll}
            onReselect={handleReselect}
            onGenerateAgain={onGenerateAgain}
            onViewAllPhotos={() => {
              setPreviousViewMode(viewMode);
              setViewMode('all');
              // Don't mark photos as viewed here - let ProfileViewScreen handle it
              setHasUnviewedPhotos(false);
              // Clear the new generated photos flag when user views all photos
              if (onNewPhotosViewed) {
                onNewPhotosViewed();
              }
            }}
            onSinglePhotoReplace={handleSinglePhotoReplace}
            downloadingPhotos={downloadingPhotos}
            isNewGeneration={hasUnviewedPhotos || hasNewGeneratedPhotos}
            isGenerating={isGenerating}
            generationMessage={generationMessage}
            freeCredits={freeCredits}
            onAutoAddPhotos={handleAutoAddPhotos}
            onOpenSettings={() => setViewMode('settings')}
          />
          <FeedbackModal
            visible={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
          />
        </>
      );

    case 'all':
      return (
        <ProfileViewScreen
          generatedPhotos={generatedPhotos}
          selectedScenarios={selectedScenarios}
          onGenerateAgain={onGenerateAgain}
          onRefresh={onRefresh}
          onViewProfile={() => setViewMode(previousViewMode)}
          hasSelectedPhotos={selectedPhotos.length > 0}
          isGenerating={isGenerating}
          generationMessage={generationMessage}
        />
      );

    case 'single-select':
      return photoToReplace ? (
        <SinglePhotoSelectionScreen
          generatedPhotos={generatedPhotos}
          selectedScenarios={selectedScenarios}
          currentPhoto={photoToReplace.photo}
          photoIndex={photoToReplace.index}
          onPhotoSelect={handleSinglePhotoSelection}
          onCancel={handleCancelSingleSelection}
        />
      ) : null;

    case 'settings':
      return (
        <SettingsScreen
          onBack={() => setViewMode('preview')}
        />
      );

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});