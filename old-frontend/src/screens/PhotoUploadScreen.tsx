import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import type { Photo } from '@/types';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { useDispatch } from 'react-redux';
import { addUploadedImage } from '@/store/photosSlice';
import { useAuth } from '@/contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoUpload'>;

const PhotoUploadScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const { uploadMultiplePhotos, uploadProgress, isUploading } = usePhotoUpload();
  const { user, login } = useAuth();
  const dispatch = useDispatch();

  // For demo purposes, create a temporary user if not logged in
  React.useEffect(() => {
    if (!user) {
      login('demo-token', { userId: 'demo-user', email: 'demo@example.com' });
    }
  }, [user, login]);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photo library to upload images.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const pickImages = async (): Promise<void> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      const newPhotos: Photo[] = result.assets.map((asset, index) => ({
        id: (Date.now() + index).toString(),
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      }));
      setSelectedPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const takePhoto = async (): Promise<void> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (!asset?.uri) return;
      
      const newPhoto: Photo = {
        id: Date.now().toString(),
        uri: asset.uri,
        ...(asset.width && { width: asset.width }),
        ...(asset.height && { height: asset.height }),
      };
      setSelectedPhotos(prev => [...prev, newPhoto]);
    }
  };

  const removePhoto = (photoId: string): void => {
    setSelectedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const canProceed = selectedPhotos.length >= 3;

  const handleUploadAndProceed = async () => {
    if (!canProceed || isUploading) return;

    try {
      // Convert Photo objects to upload format
      const uploadPhotos = selectedPhotos.map(photo => ({
        uri: photo.uri,
        fileName: `photo_${photo.id}.jpg`,
        contentType: 'image/jpeg',
      }));

      // Upload all photos
      const results = await uploadMultiplePhotos(uploadPhotos);
      
      // Store results in Redux
      results.forEach((result, index) => {
        const userImage = {
          id: result.imageId,
          userId: user?.userId || 'demo-user',
          originalFileName: uploadPhotos[index]!.fileName,
          s3Key: '', // Will be populated by server response
          s3Url: '', // Will be populated by server response
          contentType: uploadPhotos[index]!.contentType,
          sizeBytes: '0', // Will be calculated
          createdAt: new Date(),
          updatedAt: new Date(),
          downloadUrl: selectedPhotos[index]!.uri, // Use local URI for now
        };
        dispatch(addUploadedImage(userImage));
      });

      // Navigate to scenario selection with uploaded image IDs
      const imageIds = results.map(r => r.imageId);
      navigation.navigate('ScenarioSelection', { 
        photos: selectedPhotos,
        uploadedImageIds: imageIds,
        suggestions: results.flatMap(r => r.suggestions),
      });
    } catch (error) {
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Failed to upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderPhotoItem = ({ item }: { item: Photo }) => (
    <View style={styles.photoItem}>
      <Image source={{ uri: item.uri }} style={styles.uploadedPhoto} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removePhoto(item.id)}
      >
        <Ionicons name="close-circle" size={24} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Upload Your Photos</Text>
          <Text style={styles.subtitle}>
            Upload at least 3 clear photos of yourself for the best AI results
          </Text>
        </View>

        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Tips for Best Results:</Text>
          <Text style={styles.tipItem}>• Use clear, well-lit photos</Text>
          <Text style={styles.tipItem}>• Include different angles and expressions</Text>
          <Text style={styles.tipItem}>• Avoid group photos or sunglasses</Text>
          <Text style={styles.tipItem}>• Higher resolution photos work better</Text>
        </View>

        <View style={styles.uploadSection}>
          <TouchableOpacity style={styles.uploadButton} onPress={pickImages}>
            <Ionicons name="images" size={32} color="#4A90E2" />
            <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color="#4A90E2" />
            <Text style={styles.uploadButtonText}>Take a Photo</Text>
          </TouchableOpacity>
        </View>

        {selectedPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.photosTitle}>
              Selected Photos ({selectedPhotos.length})
            </Text>
            <FlatList
              data={selectedPhotos}
              renderItem={renderPhotoItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.photoRow}
              scrollEnabled={false}
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!canProceed || isUploading) && styles.continueButtonDisabled,
          ]}
          onPress={handleUploadAndProceed}
          disabled={!canProceed || isUploading}
        >
          <Text style={styles.continueButtonText}>
            {isUploading ? `Uploading... ${uploadProgress.progress}%` : 'Upload & Continue'}
          </Text>
        </TouchableOpacity>

        {uploadProgress.error && (
          <Text style={styles.errorText}>
            {uploadProgress.error}
          </Text>
        )}

        {!canProceed && !isUploading && (
          <Text style={styles.requirementText}>
            Please upload at least 3 photos to continue
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  tipsSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  uploadSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  uploadButton: {
    flex: 0.48,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  photosSection: {
    marginBottom: 24,
  },
  photosTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  photoRow: {
    justifyContent: 'space-between',
  },
  photoItem: {
    position: 'relative',
    marginBottom: 12,
    width: '48%',
  },
  uploadedPhoto: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  continueButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  requirementText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
});

export default PhotoUploadScreen;