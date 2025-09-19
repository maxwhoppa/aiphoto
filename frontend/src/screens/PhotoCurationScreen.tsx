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
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import type { Photo } from '@/types';

const { width } = Dimensions.get('window');
const imageSize: number = (width - 60) / 2;

interface GroupedPhotos {
  [scenario: string]: Photo[];
}

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoCuration'>;

const PhotoCurationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { photos } = route.params;
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  const togglePhotoSelection = (photoId: string): void => {
    setSelectedPhotos(prev => 
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const selectAllPhotos = (): void => {
    if (selectedPhotos.length === photos.length) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(photos.map(photo => photo.id));
    }
  };

  const canProceed = selectedPhotos.length > 0;

  const renderPhoto: ListRenderItem<Photo> = ({ item }) => {
    const isSelected = selectedPhotos.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.photoContainer,
          isSelected && styles.photoContainerSelected,
        ]}
        onPress={() => togglePhotoSelection(item.id)}
      >
        <Image source={{ uri: item.uri }} style={styles.photo} />
        <View style={styles.selectionOverlay}>
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
            </View>
          )}
        </View>
        <View style={styles.scenarioTag}>
          <Text style={styles.scenarioTagText}>
            {item.scenario ? item.scenario.charAt(0).toUpperCase() + item.scenario.slice(1) : 'Other'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const groupedPhotos: GroupedPhotos = photos.reduce((acc: GroupedPhotos, photo) => {
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
        <Text style={styles.title}>Select Your Favorites</Text>
        <Text style={styles.subtitle}>
          Choose your best photos to create your final gallery
        </Text>
      </View>

      <View style={styles.selectionStats}>
        <View style={styles.statsContainer}>
          <Text style={styles.selectedCount}>
            {selectedPhotos.length} of {photos.length} selected
          </Text>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={selectAllPhotos}
          >
            <Text style={styles.selectAllText}>
              {selectedPhotos.length === photos.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {Object.entries(groupedPhotos).map(([scenario, scenarioPhotos]) => (
          <View key={scenario} style={styles.scenarioSection}>
            <View style={styles.scenarioHeader}>
              <Text style={styles.scenarioTitle}>
                {scenario.charAt(0).toUpperCase() + scenario.slice(1)} ({scenarioPhotos.length})
              </Text>
              <TouchableOpacity
                style={styles.scenarioSelectButton}
                onPress={() => {
                  const scenarioPhotoIds = scenarioPhotos.map(p => p.id);
                  const allSelected = scenarioPhotoIds.every(id => selectedPhotos.includes(id));
                  
                  if (allSelected) {
                    setSelectedPhotos(prev => prev.filter(id => !scenarioPhotoIds.includes(id)));
                  } else {
                    setSelectedPhotos(prev => [...new Set([...prev, ...scenarioPhotoIds])]);
                  }
                }}
              >
                <Text style={styles.scenarioSelectText}>
                  {scenarioPhotos.every(p => selectedPhotos.includes(p.id)) ? 'Deselect' : 'Select'} All
                </Text>
              </TouchableOpacity>
            </View>
            
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
      </ScrollView>

      <View style={styles.bottomSection}>
        <View style={styles.recommendationCard}>
          <Ionicons name="lightbulb" size={20} color="#FF9500" />
          <Text style={styles.recommendationText}>
            Tip: Select 8-12 photos for the best dating profile variety
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            !canProceed && styles.continueButtonDisabled,
          ]}
          onPress={() => navigation.navigate('FinalGallery', { 
            selectedPhotos: photos.filter(photo => selectedPhotos.includes(photo.id))
          })}
          disabled={!canProceed}
        >
          <Text style={styles.continueButtonText}>
            Create Final Gallery ({selectedPhotos.length})
          </Text>
        </TouchableOpacity>
      </View>
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
  selectionStats: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 20,
  },
  selectAllText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scenarioSection: {
    marginBottom: 24,
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scenarioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scenarioSelectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  scenarioSelectText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoContainerSelected: {
    borderColor: '#4A90E2',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  selectedIndicator: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
  bottomSection: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  recommendationText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  continueButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default PhotoCurationScreen;