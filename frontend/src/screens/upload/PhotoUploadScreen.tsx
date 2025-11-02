import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BackButton } from '../../components/BackButton';
import { Button } from '../../components/Button';
import { BottomTab } from '../../components/BottomTab';
import { getUploadUrls, recordUploadedImages } from '../../services/api';
import { Text } from '../../components/Text';

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
  navigation?: any;
}

export const PhotoUploadScreen: React.FC<PhotoUploadScreenProps> = ({
  onNext,
  existingPhotos = [],
  isRegenerateFlow = false,
  navigation,
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

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        {
          text: 'Choose from Gallery',
          onPress: pickImage,
        },
        {
          text: 'Take Photo Now',
          onPress: takePhoto,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const tips = [
    {
      icon: 'bulb-outline',
      title: 'Good Lighting',
      description: 'Natural light works best - near a window or outdoors',
    },
    {
      icon: 'person-outline',
      title: 'Clear Face',
      description: 'Make sure your face is clearly visible and not blurry',
    },
    {
      icon: 'grid-outline',
      title: 'Different Poses',
      description: 'Include variety - front facing, side profile, full body',
    },
    {
      icon: 'home-outline',
      title: 'Take at Home',
      description: 'You can take all photos right now if you don\'t have any',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {isRegenerateFlow && navigation && (
          <BackButton onPress={() => navigation.goBack()} />
        )}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <Text variant="title" style={[styles.title, { color: colors.text }]}>
            {isRegenerateFlow ? 'Upload New Photos' : 'Upload Your Photos'}
          </Text>
          <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
            Upload 10 photos for the best results
          </Text>
        </View>

        {/* Tips Section - Only show when no photos selected */}
        {selectedPhotos.length === 0 && (
          <>
            <View style={styles.tipsContainer}>
              <View style={styles.tipsTitleContainer}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
                <Text variant="subtitle" style={{ color: colors.text }}>
                  Photo Tips for Best Results
                </Text>
              </View>
              {tips.map((tip, index) => (
                <View key={index} style={[styles.tipCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.tipIconContainer}>
                    <Ionicons name={tip.icon as any} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.tipContent}>
                    <Text variant="label" style={{ color: colors.text }}>
                      {tip.title}
                    </Text>
                    <Text variant="body" style={{ color: colors.textSecondary }}>
                      {tip.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

          </>
        )}

        {/* Selected Photos Grid */}
        {selectedPhotos.length > 0 && (
          <View style={styles.photosContainer}>
            <Text style={[styles.photosTitle, { color: colors.text }]}>
              Selected Photos ({selectedPhotos.length}/10)
            </Text>

            {/* Summarized Photo Tips */}
            <View style={[styles.summaryTipsContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.summaryTipsHeader}>
                <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                <Text style={[styles.summaryTipsTitle, { color: colors.text }]}>
                  Photo Tips
                </Text>
              </View>
              <Text style={[styles.summaryTipsText, { color: colors.textSecondary }]}>
               • Good lighting • Face clean • Different poses
              </Text>
            </View>

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
                  onPress={showPhotoOptions}
                >
                  <Text style={[styles.addMoreText, { color: colors.textSecondary }]}>
                    +
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        </ScrollView>
      </SafeAreaView>

      {/* Bottom Tab with Buttons */}
      <BottomTab
        showProgress={isUploading}
        progress={uploadProgress}
        progressTitle="Uploading photos..."
      >
        {/* Upload Buttons - Show when no photos selected */}
        {selectedPhotos.length === 0 && (
          <View style={styles.bottomButtonsContainer}>
            <Button
              title="Choose from Gallery"
              onPress={pickImage}
              variant="primary"
              icon="images-outline"
            />
            <Button
              title="Take Photo Now"
              onPress={takePhoto}
              variant="secondary"
              icon="camera-outline"
            />
          </View>
        )}

        {/* Upload & Continue Button - Show when photos are selected */}
        {selectedPhotos.length > 0 && (
          <Button
            title={isRegenerateFlow ? 'Upload & Continue' : 'Upload & Continue'}
            onPress={handleNext}
            disabled={selectedPhotos.length < 5 || isUploading}
            loading={isUploading}
            variant={selectedPhotos.length >= 5 && !isUploading ? 'primary' : 'disabled'}
          />
        )}
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'flex-start',
    paddingTop: 40,
    marginBottom: 10,
  },
  title: {
    marginBottom: 20,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'left',
    lineHeight: 22,
    marginBottom: 20,
  },
  tipsContainer: {
    marginBottom: 30,
  },
  tipsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  tipCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 20,
    marginBottom: 10,
  },
  tipIconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
  uploadButtonsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  uploadButton: {
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  photosContainer: {
    marginBottom: 30,
  },
  photosTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 15,
  },
  summaryTipsContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  summaryTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  summaryTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  summaryTipsText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 16,
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
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
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
    fontFamily: 'Poppins-Regular',
  },
  bottomButtonsContainer: {
    flexDirection: 'column',
    gap: 12,
  },
});