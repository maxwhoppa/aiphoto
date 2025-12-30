import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BackButton } from '../../components/BackButton';
import { Button } from '../../components/Button';
import { BottomTab } from '../../components/BottomTab';
import { Text } from '../../components/Text';
import {
  validateSingleImage,
  bypassValidation,
  getUploadUrls,
  recordUploadedImages,
  replaceImage,
  getMyImages,
  SamplePhotoImage,
} from '../../services/api';

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface ImageData {
  id: string;
  uri: string;
  validationStatus: 'pending' | 'validating' | 'validated' | 'failed' | 'bypassed';
  warnings: string[];
}

export interface SamplePhotos {
  photos: SamplePhotoImage[];
  isGenerating: boolean;
  error?: string;
}

interface PhotoValidationScreenProps {
  imageIds: string[];
  onNext: (imageIds: string[], samplePhotos?: SamplePhotos) => void;
  onBack: () => void;
  navigation?: any;
}

const WARNING_INFO: Record<string, { icon: string; title: string; description: string }> = {
  multiple_faces: {
    icon: 'people-outline',
    title: 'Multiple Faces Detected',
    description: 'This photo has multiple clear faces visible. For best results, use photos where only your face is clearly visible.',
  },
  face_covered_or_blurred: {
    icon: 'eye-off-outline',
    title: 'Face Not Clearly Visible',
    description: 'Your face appears to be covered or blurry in this photo. A clear face helps generate better results.',
  },
  poor_lighting: {
    icon: 'sunny-outline',
    title: 'Low Lighting Detected',
    description: 'This photo seems to have poor lighting. Well-lit photos produce the best AI generations.',
  },
  is_screenshot: {
    icon: 'phone-portrait-outline',
    title: 'Screenshot Detected',
    description: 'This appears to be a screenshot. Please upload the original photo for best results.',
  },
  face_partially_covered: {
    icon: 'hand-left-outline',
    title: 'Face Partially Covered',
    description: 'Part of your face (eyes, nose, mouth, chin, or forehead) appears to be covered or cut off. Use photos where your full face is visible.',
  },
};

export const PhotoValidationScreen: React.FC<PhotoValidationScreenProps> = ({
  imageIds: initialImageIds,
  onNext,
  onBack,
  navigation,
}) => {
  const { colors } = useTheme();
  const [images, setImages] = useState<ImageData[]>([]);
  const [isValidating, setIsValidating] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showPhotoOptionsModal, setShowPhotoOptionsModal] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);

  // Sample generation is now handled by the server automatically
  const [sampleGenerationStarted, setSampleGenerationStarted] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const photoSize = (screenWidth - 60) / 3;
  const MAX_PHOTOS = 10;

  // Fetch image data and start validation on mount
  useEffect(() => {
    fetchImagesAndValidate();
  }, []);

  const fetchImagesAndValidate = async () => {
    try {
      // Fetch the user's images to get URIs and existing validation status
      const myImagesResponse = await getMyImages();

      // Handle various response formats - ensure we have an array
      const myImages = Array.isArray(myImagesResponse)
        ? myImagesResponse
        : (myImagesResponse?.result?.data || myImagesResponse?.data || []);

      console.log('PhotoValidationScreen: Fetched images:', myImages?.length || 0);

      // Map initial image IDs to image data, using stored validation status
      const imageDataList: ImageData[] = initialImageIds.map(id => {
        const imageInfo = Array.isArray(myImages)
          ? myImages.find((img: any) => img.id === id)
          : null;

        // Parse stored validation warnings if available
        let storedWarnings: string[] = [];
        if (imageInfo?.validationWarnings) {
          try {
            storedWarnings = JSON.parse(imageInfo.validationWarnings);
          } catch {
            storedWarnings = [];
          }
        }

        // Map stored status to our local status type
        const storedStatus = imageInfo?.validationStatus;
        let localStatus: ImageData['validationStatus'] = 'validating';
        if (storedStatus === 'validated') {
          localStatus = 'validated';
        } else if (storedStatus === 'bypassed') {
          localStatus = 'bypassed';
        } else if (storedStatus === 'failed') {
          localStatus = 'failed';
        }
        // 'pending' or unknown status will stay as 'validating' and get validated

        return {
          id,
          uri: imageInfo?.downloadUrl || imageInfo?.s3Url || '',
          validationStatus: localStatus,
          warnings: storedWarnings,
        };
      });

      setImages(imageDataList);

      // Only validate images that haven't been validated yet (still 'validating' status)
      const imagesToValidate = imageDataList.filter(img => img.validationStatus === 'validating');

      console.log('PhotoValidationScreen: Images needing validation:', imagesToValidate.length, 'of', imageDataList.length);

      if (imagesToValidate.length === 0) {
        // All images already validated, nothing to do
        console.log('PhotoValidationScreen: All images already validated, skipping validation');
        setIsValidating(false);
        return;
      }

      // Validate each image individually - server will trigger sample generation automatically
      for (const img of imagesToValidate) {
        try {
          console.log('PhotoValidationScreen: Validating image:', img.id);
          const result = await validateSingleImage(img.id);

          // Track if sample generation was started
          if (result.sampleGenerationStarted && !sampleGenerationStarted) {
            setSampleGenerationStarted(true);
            console.log('PhotoValidationScreen: Sample generation started by server');
          }

          // Update this image's status immediately
          setImages(prevImages =>
            prevImages.map(prevImg =>
              prevImg.id === img.id
                ? {
                    ...prevImg,
                    validationStatus: result.isValid ? 'validated' : 'failed',
                    warnings: result.warnings || [],
                  }
                : prevImg
            )
          );

          console.log('PhotoValidationScreen: Image validated:', img.id, 'isValid:', result.isValid);
        } catch (error) {
          console.error('PhotoValidationScreen: Failed to validate image:', img.id, error);
          // Mark as validated on error to allow proceeding
          setImages(prevImages =>
            prevImages.map(prevImg =>
              prevImg.id === img.id
                ? { ...prevImg, validationStatus: 'validated', warnings: [] }
                : prevImg
            )
          );
        }
      }
    } catch (error) {
      console.error('Validation failed:', error);
      Alert.alert('Validation Error', 'Failed to validate photos. Please try again.');
      // Mark all as validated on error to allow proceeding
      setImages(prevImages =>
        prevImages.map(img => ({ ...img, validationStatus: 'validated', warnings: [] }))
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleImagePress = (image: ImageData) => {
    setSelectedImage(image);
    if (image.validationStatus === 'failed' && image.warnings.length > 0) {
      setShowWarningModal(true);
    } else {
      // For validated/bypassed photos, show options modal
      setShowPhotoOptionsModal(true);
    }
  };

  const handleBypass = async () => {
    if (!selectedImage) return;

    try {
      await bypassValidation([selectedImage.id]);

      setImages(prevImages =>
        prevImages.map(img =>
          img.id === selectedImage.id
            ? { ...img, validationStatus: 'bypassed' }
            : img
        )
      );

      setShowWarningModal(false);
      setSelectedImage(null);
    } catch (error) {
      console.error('Bypass failed:', error);
      Alert.alert('Error', 'Failed to bypass validation. Please try again.');
    }
  };

  const handleReplace = async () => {
    if (!selectedImage) return;

    const imageIdToReplace = selectedImage.id;

    setShowWarningModal(false);
    setShowPhotoOptionsModal(false);
    setReplacingImageId(imageIdToReplace);

    // Show photo picker options
    Alert.alert(
      'Replace Photo',
      'Choose how you want to add a new photo',
      [
        {
          text: 'Choose from gallery',
          onPress: () => pickReplacementImage('gallery', imageIdToReplace),
        },
        {
          text: 'Take photo',
          onPress: () => pickReplacementImage('camera', imageIdToReplace),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setReplacingImageId(null);
            setSelectedImage(null);
          },
        },
      ]
    );
  };

  const handleAddPhoto = () => {
    if (images.length >= MAX_PHOTOS) {
      Alert.alert('Maximum photos reached', `You can have up to ${MAX_PHOTOS} photos.`);
      return;
    }

    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        {
          text: 'Choose from gallery',
          onPress: () => pickNewImage('gallery'),
        },
        {
          text: 'Take photo',
          onPress: () => pickNewImage('camera'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const pickNewImage = async (source: 'gallery' | 'camera') => {
    try {
      let result;

      if (source === 'gallery') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'We need photo library permissions.');
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: MAX_PHOTOS - images.length,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'We need camera permissions.');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsAddingPhoto(true);
        for (const asset of result.assets) {
          if (images.length >= MAX_PHOTOS) break;
          await uploadNewPhoto(asset.uri);
        }
        setIsAddingPhoto(false);
      }
    } catch (error) {
      console.error('Pick new image failed:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setIsAddingPhoto(false);
    }
  };

  const uploadNewPhoto = async (photoUri: string) => {
    try {
      // Get file info
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const uniqueId = generateUUID();

      const fileInfo = {
        fileName: `${uniqueId}.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: blob.size,
      };

      // Get upload URL
      const uploadUrlsResponse = await getUploadUrls([fileInfo]);
      const uploadUrls = uploadUrlsResponse?.uploadUrls ||
                        uploadUrlsResponse?.result?.data?.uploadUrls || [];

      if (uploadUrls.length === 0) {
        throw new Error('Failed to get upload URL');
      }

      const uploadData = uploadUrls[0];

      // Upload to S3
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': uploadData.contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      // Record the new image
      const recordResponse = await recordUploadedImages([{
        fileName: uploadData.fileName,
        contentType: uploadData.contentType,
        sizeBytes: uploadData.sizeBytes,
        s3Key: uploadData.s3Key,
        s3Url: uploadData.s3Url,
      }]);

      const newImages = recordResponse?.images ||
                       recordResponse?.result?.data?.images || [];

      if (newImages.length === 0) {
        throw new Error('Failed to record image');
      }

      const newImageId = newImages[0].id;

      // Add to local state with validating status
      setImages(prevImages => [
        ...prevImages,
        {
          id: newImageId,
          uri: photoUri,
          validationStatus: 'validating' as const,
          warnings: [],
        },
      ]);

      // Validate the new image - server will trigger sample generation if needed
      const validationResult = await validateSingleImage(newImageId);

      if (validationResult.sampleGenerationStarted && !sampleGenerationStarted) {
        setSampleGenerationStarted(true);
        console.log('PhotoValidationScreen: Sample generation started by server (new photo)');
      }

      setImages(prevImages =>
        prevImages.map(img =>
          img.id === newImageId
            ? {
                ...img,
                validationStatus: validationResult?.isValid ? 'validated' : 'failed',
                warnings: validationResult?.warnings || [],
              }
            : img
        )
      );
    } catch (error) {
      console.error('Upload new photo failed:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  const pickReplacementImage = async (source: 'gallery' | 'camera', imageIdToReplace: string) => {
    try {
      let result;

      if (source === 'gallery') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'We need photo library permissions.');
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: false,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'We need camera permissions.');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets && result.assets[0] && imageIdToReplace) {
        setIsReplacing(true);
        await uploadReplacementPhoto(result.assets[0].uri, imageIdToReplace);
      }
    } catch (error) {
      console.error('Pick image failed:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setReplacingImageId(null);
      setSelectedImage(null);
    }
  };

  const uploadReplacementPhoto = async (photoUri: string, oldImageId: string) => {
    try {
      // Get file info
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const uniqueId = generateUUID();

      const fileInfo = {
        fileName: `${uniqueId}.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: blob.size,
      };

      // Get upload URL
      const uploadUrlsResponse = await getUploadUrls([fileInfo]);
      const uploadUrls = uploadUrlsResponse?.uploadUrls ||
                        uploadUrlsResponse?.result?.data?.uploadUrls || [];

      if (uploadUrls.length === 0) {
        throw new Error('Failed to get upload URL');
      }

      const uploadData = uploadUrls[0];

      // Upload to S3
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': uploadData.contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      // Replace image in database
      const replaceResponse = await replaceImage(oldImageId, {
        fileName: uploadData.fileName,
        contentType: uploadData.contentType,
        sizeBytes: uploadData.sizeBytes,
        s3Key: uploadData.s3Key,
        s3Url: uploadData.s3Url,
      });

      const newImageId = replaceResponse?.newImage?.id || replaceResponse?.result?.data?.newImage?.id;

      if (!newImageId) {
        throw new Error('Failed to get new image ID');
      }

      // Update local state with new image
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === oldImageId
            ? {
                id: newImageId,
                uri: photoUri,
                validationStatus: 'validating' as const,
                warnings: [],
              }
            : img
        )
      );

      // Validate the new image - server will trigger sample generation if needed
      const validationResult = await validateSingleImage(newImageId);

      if (validationResult.sampleGenerationStarted && !sampleGenerationStarted) {
        setSampleGenerationStarted(true);
        console.log('PhotoValidationScreen: Sample generation started by server (replacement photo)');
      }

      setImages(prevImages =>
        prevImages.map(img =>
          img.id === newImageId
            ? {
                ...img,
                validationStatus: validationResult?.isValid ? 'validated' : 'failed',
                warnings: validationResult?.warnings || [],
              }
            : img
        )
      );
    } catch (error) {
      console.error('Replace failed:', error);
      Alert.alert('Error', 'Failed to replace photo. Please try again.');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleContinue = () => {
    const validImageIds = images
      .filter(img => img.validationStatus === 'validated' || img.validationStatus === 'bypassed')
      .map(img => img.id);

    // Pass samplePhotos as generating if sample generation was started
    // The SamplePreviewScreen will poll for the actual photos
    onNext(validImageIds, sampleGenerationStarted ? { photos: [], isGenerating: true } : undefined);
  };

  // Calculate progress stats
  const validatedCount = images.filter(img => img.validationStatus === 'validated').length;
  const bypassedCount = images.filter(img => img.validationStatus === 'bypassed').length;
  const failedCount = images.filter(img => img.validationStatus === 'failed').length;
  const processingCount = images.filter(img =>
    img.validationStatus === 'validating' || img.validationStatus === 'pending'
  ).length;

  const allProcessed = processingCount === 0 && !isReplacing;
  const hasAtLeastOneClean = validatedCount >= 1;
  const canContinue = allProcessed && hasAtLeastOneClean && failedCount === 0;

  const getStatusIcon = (status: string, warnings: string[]) => {
    switch (status) {
      case 'validated':
        return <Ionicons name="checkmark-circle" size={24} color={colors.success || '#4CAF50'} />;
      case 'failed':
        return <Ionicons name="warning" size={24} color={colors.warning || '#FF9800'} />;
      case 'bypassed':
        return <Ionicons name="checkmark-circle-outline" size={24} color={colors.textSecondary} />;
      default:
        return <ActivityIndicator size="small" color={colors.primary} />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BackButton onPress={onBack} />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text variant="title" style={[styles.title, { color: colors.text }]}>
              Validating your photos
            </Text>
            <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
              We're checking each photo to ensure the best results
            </Text>
          </View>

          {/* Progress Summary */}
          <View style={[styles.progressCard, { backgroundColor: colors.surface }]}>
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <Text style={[styles.progressNumber, { color: colors.text }]}>
                  {images.length}
                </Text>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  Total
                </Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={[styles.progressNumber, { color: colors.success || '#4CAF50' }]}>
                  {validatedCount + bypassedCount}
                </Text>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  Ready
                </Text>
              </View>
              <View style={styles.progressItem}>
                <Text style={[styles.progressNumber, { color: failedCount > 0 ? (colors.warning || '#FF9800') : colors.textSecondary }]}>
                  {failedCount}
                </Text>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  Issues
                </Text>
              </View>
              <View style={styles.progressItem}>
                {processingCount > 0 ? (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.progressSpinner} />
                ) : (
                  <Text style={[styles.progressNumber, { color: colors.textSecondary }]}>
                    {processingCount}
                  </Text>
                )}
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  Checking
                </Text>
              </View>
            </View>
          </View>

          {/* Requirement Notice */}
          {allProcessed && !hasAtLeastOneClean && (
            <View style={[styles.noticeCard, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[styles.noticeText, { color: colors.error }]}>
                At least one photo must pass validation. Please replace a photo or fix the issues.
              </Text>
            </View>
          )}

          {/* Photos Grid */}
          <View style={styles.photosGrid}>
            {images.map((image) => (
              <TouchableOpacity
                key={image.id}
                style={[styles.photoContainer, { width: photoSize, height: photoSize }]}
                onPress={() => handleImagePress(image)}
                disabled={image.validationStatus === 'validating'}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
                  {getStatusIcon(image.validationStatus, image.warnings)}
                </View>
                {image.validationStatus === 'failed' && (
                  <View style={[styles.tapHint, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <Text style={styles.tapHintText}>Tap to fix</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {/* Add Photo Placeholder */}
            {images.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={[
                  styles.addPhotoContainer,
                  {
                    width: photoSize,
                    height: photoSize,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }
                ]}
                onPress={handleAddPhoto}
                disabled={isAddingPhoto || isReplacing}
              >
                {isAddingPhoto ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="add" size={32} color={colors.textSecondary} />
                    <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>
                      Add
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Tab */}
      <BottomTab
        showProgress={isValidating || isReplacing || isAddingPhoto}
        progress={isValidating ? 50 : 80}
        progressTitle={isValidating ? 'Validating photos...' : isAddingPhoto ? 'Adding photo...' : 'Replacing photo...'}
      >
        <Button
          title={canContinue ? 'Continue' : failedCount > 0 ? `Fix ${failedCount} photo${failedCount > 1 ? 's' : ''}` : 'Validating...'}
          onPress={handleContinue}
          disabled={!canContinue}
          variant={canContinue ? 'primary' : 'disabled'}
        />
      </BottomTab>

      {/* Warning Modal */}
      <Modal
        visible={showWarningModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text variant="subtitle" style={{ color: colors.text }}>
                Photo Issues Detected
              </Text>
              <TouchableOpacity onPress={() => setShowWarningModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <>
                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                >
                  <Image
                    source={{ uri: selectedImage.uri }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />

                  <View style={styles.warningsList}>
                    {selectedImage.warnings.map((warning, index) => {
                      const info = WARNING_INFO[warning];
                      if (!info) return null;

                      return (
                        <View key={index} style={[styles.warningItem, { backgroundColor: colors.surface }]}>
                          <Ionicons name={info.icon as any} size={24} color={colors.warning || '#FF9800'} />
                          <View style={styles.warningTextContainer}>
                            <Text style={[styles.warningTitle, { color: colors.text }]}>
                              {info.title}
                            </Text>
                            <Text style={[styles.warningDescription, { color: colors.textSecondary }]}>
                              {info.description}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={styles.modalButtons}>
                  <Button
                    title="Replace Photo"
                    onPress={handleReplace}
                    variant="primary"
                    icon="camera-outline"
                  />
                  <Button
                    title="Keep Anyway"
                    onPress={handleBypass}
                    variant="outline"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Photo Options Modal (for validated/bypassed photos) */}
      <Modal
        visible={showPhotoOptionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text variant="subtitle" style={{ color: colors.text }}>
                Photo Options
              </Text>
              <TouchableOpacity onPress={() => {
                setShowPhotoOptionsModal(false);
                setSelectedImage(null);
              }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <>
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />

                <View style={[styles.statusInfo, { backgroundColor: colors.surface }]}>
                  <Ionicons
                    name={selectedImage.validationStatus === 'validated' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={24}
                    color={selectedImage.validationStatus === 'validated' ? (colors.success || '#4CAF50') : colors.textSecondary}
                  />
                  <Text style={[styles.statusInfoText, { color: colors.text }]}>
                    {selectedImage.validationStatus === 'validated'
                      ? 'This photo passed validation'
                      : 'This photo was kept with warnings'}
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <Button
                    title="Replace Photo"
                    onPress={handleReplace}
                    variant="primary"
                    icon="camera-outline"
                  />
                  <Button
                    title="Cancel"
                    onPress={() => {
                      setShowPhotoOptionsModal(false);
                      setSelectedImage(null);
                    }}
                    variant="outline"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 120,
  },
  header: {
    alignItems: 'flex-start',
    paddingTop: 40,
    marginBottom: 20,
  },
  title: {
    marginBottom: 10,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'left',
    lineHeight: 22,
  },
  progressCard: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  progressNumber: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
    lineHeight: 32,
    includeFontPadding: false,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
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
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 12,
    padding: 2,
  },
  tapHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tapHintText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalScrollView: {
    flexGrow: 0,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  warningsList: {
    gap: 12,
  },
  warningItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  warningDescription: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    lineHeight: 18,
  },
  modalButtons: {
    gap: 12,
  },
  addPhotoContainer: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    marginTop: 4,
  },
  progressSpinner: {
    height: 32, // Match the lineHeight of progressNumber for alignment
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
    marginBottom: 20,
  },
  statusInfoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
});
