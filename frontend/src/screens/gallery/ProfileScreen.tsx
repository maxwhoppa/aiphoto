import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ProfileViewScreen } from './ProfileViewScreen';
import { PhotoSelectionFlow } from './PhotoSelectionFlow';
import { ProfilePreview } from './ProfilePreview';
import { setSelectedProfilePhotos, getSelectedProfilePhotos } from '../../services/api';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

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
}

type ViewMode = 'selection' | 'preview' | 'all';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  generatedPhotos,
  selectedScenarios,
  onGenerateAgain,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [selectedPhotos, setSelectedPhotos] = useState<GeneratedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState<Set<string>>(new Set());

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
        const response = await getSelectedProfilePhotos();
        const data = response?.result?.data || [];

        if (data && data.length > 0) {
          // Map the selected photos from API to our format
          const selected = data.map((photo: any) => ({
            id: photo.id,
            uri: photo.s3Url,
            scenario: photo.scenario,
            downloadUrl: photo.downloadUrl || photo.s3Url,
            selectedProfileOrder: photo.selectedProfileOrder,
          }));
          setSelectedPhotos(selected);
          setViewMode('preview'); // Show preview if we have selections
        } else {
          // No selections yet, show selection flow
          setViewMode('selection');
        }
      } catch (error) {
        console.error('Error loading selected photos:', error);
        setViewMode('selection');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedPhotos();
  }, []);

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

  const handleReselect = useCallback(() => {
    Alert.alert(
      'Reselect Photos',
      'This will clear your current selections. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => setViewMode('selection'),
        },
      ]
    );
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
    case 'selection':
      return (
        <PhotoSelectionFlow
          photosByScenario={photosByScenario}
          selectedScenarios={selectedScenarios}
          onComplete={handleSelectionComplete}
          onSkip={() => setViewMode('all')}
          onBack={selectedPhotos.length > 0 ? () => setViewMode('preview') : () => setViewMode('all')}
        />
      );

    case 'preview':
      return (
        <ProfilePreview
          selectedPhotos={selectedPhotos}
          onDownloadAll={handleDownloadAll}
          onReselect={handleReselect}
          onViewAllPhotos={() => setViewMode('all')}
          downloadingPhotos={downloadingPhotos}
        />
      );

    case 'all':
      return (
        <ProfileViewScreen
          generatedPhotos={generatedPhotos}
          selectedScenarios={selectedScenarios}
          onGenerateAgain={onGenerateAgain}
          onRefresh={onRefresh}
          onSelectProfilePhotos={() => setViewMode('selection')}
          onViewProfile={() => setViewMode('preview')}
          hasSelectedPhotos={selectedPhotos.length > 0}
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