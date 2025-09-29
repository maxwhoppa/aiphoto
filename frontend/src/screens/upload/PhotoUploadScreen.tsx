import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { getUploadUrls, recordUploadedImages } from '../../services/api';

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface PhotoUploadScreenProps {
  onNext: (imageIds: string[]) => void; // Now passes uploaded image IDs instead of URIs
  existingPhotos?: string[];
  isRegenerateFlow?: boolean;
}

export const PhotoUploadScreen: React.FC<PhotoUploadScreenProps> = ({
  onNext,
  existingPhotos = [],
  isRegenerateFlow = false,
}) => {
  const { colors } = useTheme();
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(existingPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const photoSize = (screenWidth - 60) / 3; // 3 photos per row with spacing

  const requestMediaLibraryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'We need photo library permissions to select your photos.'
      );
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission needed',
        'We need camera permissions to take photos.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      const totalPhotos = [...selectedPhotos, ...newPhotos];
      
      if (totalPhotos.length > 10) {
        Alert.alert('Too Many Photos', 'You can upload a maximum of 10 photos.');
        return;
      }
      
      setSelectedPhotos(totalPhotos);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const newPhoto = result.assets[0].uri;
      const totalPhotos = [...selectedPhotos, newPhoto];
      
      if (totalPhotos.length > 10) {
        Alert.alert('Too Many Photos', 'You can upload a maximum of 10 photos.');
        return;
      }
      
      setSelectedPhotos(totalPhotos);
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = selectedPhotos.filter((_, i) => i !== index);
    setSelectedPhotos(updatedPhotos);
  };

  const uploadPhotosToS3 = async () => {
    if (selectedPhotos.length < 5) {
      Alert.alert(
        'More Photos Needed',
        'Please upload at least 5 photos to get the best results.'
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Prepare file metadata from selected photos
      setUploadProgress(10);
      const files = await Promise.all(
        selectedPhotos.map(async (photoUri, index) => {
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const uniqueId = generateUUID();
          
          return {
            fileName: `${uniqueId}.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: blob.size,
          };
        })
      );

      console.log('Files to upload:', files);
      
      // Step 2: Get upload URLs
      setUploadProgress(20);
      const uploadUrlsResponse = await getUploadUrls(files);
      console.log('Full upload URLs response:', uploadUrlsResponse);
      
      // Extract uploadUrls from the response structure
      const uploadUrls = uploadUrlsResponse?.uploadUrls || 
                        uploadUrlsResponse?.result?.data?.uploadUrls || 
                        uploadUrlsResponse?.data?.uploadUrls || [];

      if (uploadUrls.length === 0) {
        throw new Error('Failed to get upload URLs from server');
      }

      // Step 3: Upload photos to S3
      const uploadedImages = [];
      for (let i = 0; i < selectedPhotos.length; i++) {
        const photoUri = selectedPhotos[i];
        const uploadData = uploadUrls[i];
        
        if (!uploadData) {
          throw new Error(`No upload URL for photo ${i + 1}`);
        }
        
        // Upload to S3
        const response = await fetch(photoUri);
        const blob = await response.blob();
        
        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': uploadData.contentType,
          },
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload photo ${i + 1}`);
        }
        
        uploadedImages.push({
          fileName: uploadData.fileName,
          contentType: uploadData.contentType,
          sizeBytes: uploadData.sizeBytes,
          s3Key: uploadData.s3Key,
          s3Url: uploadData.s3Url,
        });
        
        // Update progress for each upload
        setUploadProgress(20 + (60 * (i + 1)) / selectedPhotos.length);
      }

      // Step 4: Record uploaded images in database
      setUploadProgress(85);
      const recordResponse = await recordUploadedImages(uploadedImages);
      console.log('Full record response:', recordResponse);
      
      // Extract images from the response structure
      const recordedImages = recordResponse?.images || 
                           recordResponse?.result?.data?.images || 
                           recordResponse?.data?.images || [];

      if (recordedImages.length === 0) {
        throw new Error('Failed to record images in database');
      }

      setUploadProgress(100);

      // Pass the image IDs to the next screen
      const imageIds = recordedImages.map((img: any) => img.id);
      onNext(imageIds);

    } catch (error: any) {
      console.error('Photo upload failed:', error);
      Alert.alert(
        'Upload Failed',
        error.message || 'Failed to upload your photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleNext = () => {
    uploadPhotosToS3();
  };

  const tips = [
    {
      icon: '💡',
      title: 'Good Lighting',
      description: 'Natural light works best - near a window or outdoors',
    },
    {
      icon: '👤',
      title: 'Clear Face',
      description: 'Make sure your face is clearly visible and not blurry',
    },
    {
      icon: '📐',
      title: 'Different Poses',
      description: 'Include variety - front facing, side profile, full body',
    },
    {
      icon: '🏠',
      title: 'Take at Home',
      description: 'You can take all photos right now if you don\'t have any',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isRegenerateFlow ? 'Upload New Photos' : 'Upload Your Photos'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Upload 5-10 photos for the best AI generation results
          </Text>
        </View>

        {/* Tips Section */}
        <View style={styles.tipsContainer}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>
            📸 Photo Tips for Best Results
          </Text>
          {tips.map((tip, index) => (
            <View key={index} style={[styles.tipCard, { backgroundColor: colors.surface }]}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle, { color: colors.text }]}>
                  {tip.title}
                </Text>
                <Text style={[styles.tipDescription, { color: colors.textSecondary }]}>
                  {tip.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Upload Buttons */}
        <View style={styles.uploadButtonsContainer}>
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: colors.primary }]}
            onPress={pickImage}
          >
            <Text style={[styles.uploadButtonText, { color: colors.background }]}>
              📱 Choose from Gallery
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: colors.secondary }]}
            onPress={takePhoto}
          >
            <Text style={[styles.uploadButtonText, { color: colors.background }]}>
              📷 Take Photo Now
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected Photos Grid */}
        {selectedPhotos.length > 0 && (
          <View style={styles.photosContainer}>
            <Text style={[styles.photosTitle, { color: colors.text }]}>
              Selected Photos ({selectedPhotos.length}/10)
            </Text>
            
            <View style={styles.photosGrid}>
              {selectedPhotos.map((photo, index) => (
                <View key={index} style={[styles.photoContainer, { width: photoSize, height: photoSize }]}>
                  <Image
                    source={{ uri: photo }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[styles.removeButton, { backgroundColor: colors.error }]}
                    onPress={() => removePhoto(index)}
                  >
                    <Text style={[styles.removeButtonText, { color: colors.background }]}>
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Add more photos placeholder */}
              {selectedPhotos.length < 10 && (
                <TouchableOpacity
                  style={[
                    styles.addMoreContainer,
                    {
                      width: photoSize,
                      height: photoSize,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={pickImage}
                >
                  <Text style={[styles.addMoreText, { color: colors.textSecondary }]}>
                    +
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.min((selectedPhotos.length / 5) * 100, 100)}%`,
                }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {selectedPhotos.length < 5
              ? `${5 - selectedPhotos.length} more photos needed`
              : `${selectedPhotos.length} photos selected`
            }
          </Text>
        </View>
      </ScrollView>

      {/* Next Button */}
      <View style={styles.buttonContainer}>
        {isUploading && (
          <View style={styles.uploadProgressContainer}>
            <View style={[styles.uploadProgressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.uploadProgressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${uploadProgress}%`,
                  }
                ]}
              />
            </View>
            <Text style={[styles.uploadProgressText, { color: colors.textSecondary }]}>
              Uploading photos... {Math.round(uploadProgress)}%
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: selectedPhotos.length >= 5 && !isUploading ? colors.primary : colors.border,
            },
          ]}
          onPress={handleNext}
          disabled={selectedPhotos.length < 5 || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={colors.textSecondary} />
          ) : (
            <Text
              style={[
                styles.nextButtonText,
                {
                  color: selectedPhotos.length >= 5 ? colors.background : colors.textSecondary,
                },
              ]}
            >
              {isRegenerateFlow ? 'Upload & Continue' : 'Upload & Continue'}
            </Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    marginBottom: 30,
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
    lineHeight: 22,
  },
  tipsContainer: {
    marginBottom: 30,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  tipCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  tipIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  uploadButtonsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  uploadButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  photosContainer: {
    marginBottom: 30,
  },
  photosTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  addMoreContainer: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreText: {
    fontSize: 32,
    fontWeight: '300',
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  nextButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  uploadProgressContainer: {
    marginBottom: 16,
  },
  uploadProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: 14,
    textAlign: 'center',
  },
});