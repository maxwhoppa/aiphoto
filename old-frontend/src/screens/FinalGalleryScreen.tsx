import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Dimensions,
  Share,
  Alert,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import type { Photo } from '@/types';

const { width } = Dimensions.get('window');
const imageSize: number = (width - 60) / 2;

interface GroupedPhotos {
  [scenario: string]: Photo[];
}

type Props = NativeStackScreenProps<RootStackParamList, 'FinalGallery'>;

const FinalGalleryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { selectedPhotos } = route.params;
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const downloadAllPhotos = async (): Promise<void> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need permission to save photos to your device.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsDownloading(true);
      
      for (const photo of selectedPhotos) {
        await MediaLibrary.saveToLibraryAsync(photo.uri);
      }

      setIsDownloading(false);
      Alert.alert(
        'Success!',
        `${selectedPhotos.length} photos saved to your gallery.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setIsDownloading(false);
      Alert.alert(
        'Error',
        'Failed to save photos. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const sharePhoto = async (photoUri: string): Promise<void> => {
    try {
      await Share.share({
        url: photoUri,
        message: 'Check out my new AI-generated photo!',
      });
    } catch (error) {
      console.error('Error sharing photo:', error);
    }
  };

  const startNewGeneration = (): void => {
    Alert.alert(
      'New Generation',
      'Start a new AI photo generation for $99.99?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start New', 
          onPress: () => navigation.navigate('Landing') 
        }
      ]
    );
  };

  const renderPhoto: ListRenderItem<Photo> = ({ item, index }) => (
    <TouchableOpacity
      style={styles.photoContainer}
      onPress={() => Alert.alert(
        'Photo Options',
        'What would you like to do with this photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share', onPress: () => sharePhoto(item.uri) },
          { text: 'View Full Size', onPress: () => {/* TODO: Implement full size view */} }
        ]
      )}
    >
      <Image source={{ uri: item.uri }} style={styles.photo} />
      <View style={styles.photoOverlay}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => sharePhoto(item.uri)}
        >
          <Ionicons name="share-outline" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.scenarioTag}>
        <Text style={styles.scenarioTagText}>
          {item.scenario ? item.scenario.charAt(0).toUpperCase() + item.scenario.slice(1) : 'Other'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const groupedPhotos: GroupedPhotos = selectedPhotos.reduce((acc: GroupedPhotos, photo) => {
    const scenario = photo.scenario || 'other';
    if (!acc[scenario]) {
      acc[scenario] = [];
    }
    acc[scenario].push(photo);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Final Gallery</Text>
        <Text style={styles.subtitle}>
          {selectedPhotos.length} curated photos ready for your dating profile
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
          onPress={downloadAllPhotos}
          disabled={isDownloading}
        >
          <Ionicons 
            name={isDownloading ? "hourglass" : "download"} 
            size={18} 
            color="#fff" 
            style={styles.buttonIcon} 
          />
          <Text style={styles.downloadButtonText}>
            {isDownloading ? 'Downloading...' : 'Download All'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.newGenerationButton}
          onPress={startNewGeneration}
        >
          <Ionicons name="add-circle" size={18} color="#4A90E2" style={styles.buttonIcon} />
          <Text style={styles.newGenerationButtonText}>New Generation</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.tipsCard}>
          <Ionicons name="lightbulb" size={20} color="#FF9500" />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Pro Tips for Dating Apps:</Text>
            <Text style={styles.tipText}>• Use 3-6 photos for best results</Text>
            <Text style={styles.tipText}>• Mix different scenarios (casual, formal, etc.)</Text>
            <Text style={styles.tipText}>• Make your first photo a clear face shot</Text>
            <Text style={styles.tipText}>• Show your personality through variety</Text>
          </View>
        </View>

        {Object.entries(groupedPhotos).map(([scenario, scenarioPhotos]) => (
          <View key={scenario} style={styles.scenarioSection}>
            <Text style={styles.scenarioTitle}>
              {scenario.charAt(0).toUpperCase() + scenario.slice(1)} ({scenarioPhotos.length})
            </Text>
            
            <FlatList
              data={scenarioPhotos}
              renderItem={renderPhoto}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.photoRow}
              scrollEnabled={false}
            />
          </View>
        ))}

        <View style={styles.satisfactionCard}>
          <Text style={styles.satisfactionTitle}>How did we do?</Text>
          <Text style={styles.satisfactionText}>
            Your feedback helps us improve our AI photo generation.
          </Text>
          <View style={styles.ratingButtons}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                style={styles.ratingButton}
                onPress={() => Alert.alert('Thank you!', 'Your feedback has been recorded.')}
              >
                <Ionicons name="star-outline" size={24} color="#FFD700" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>Ready for More?</Text>
          <Text style={styles.nextStepsText}>
            Generate new photos with different scenarios or styles for just $99.99
          </Text>
          <TouchableOpacity
            style={styles.generateMoreButton}
            onPress={startNewGeneration}
          >
            <Text style={styles.generateMoreButtonText}>Generate More Photos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  newGenerationButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  newGenerationButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  buttonIcon: {
    marginRight: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipsContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  scenarioSection: {
    marginBottom: 24,
  },
  scenarioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  photoRow: {
    justifyContent: 'space-between',
  },
  photoContainer: {
    width: imageSize,
    height: imageSize * 1.3,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  shareButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 6,
  },
  scenarioTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scenarioTagText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  satisfactionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  satisfactionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  satisfactionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingButton: {
    padding: 4,
  },
  nextStepsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  nextStepsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  generateMoreButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  generateMoreButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default FinalGalleryScreen;