import React, { useState, useEffect } from 'react';
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
  Alert,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import type { Photo, Scenario } from '@/types';

const { width } = Dimensions.get('window');
const imageSize: number = (width - 60) / 2;

interface ScenarioFilter {
  id: string;
  title: string;
  count: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'PreviewGallery'>;

const PreviewGalleryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { photos, scenarios } = route.params;
  const [generatedPhotos, setGeneratedPhotos] = useState<Photo[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('all');

  useEffect(() => {
    const mockGeneratedPhotos: Photo[] = [];
    scenarios.forEach((scenario: Scenario) => {
      for (let i = 0; i < 7; i++) {
        mockGeneratedPhotos.push({
          id: `${scenario}-${i}`,
          scenario,
          uri: `https://picsum.photos/400/600?random=${Math.random()}`,
          watermarked: true,
          premium: true,
        });
      }
    });
    setGeneratedPhotos(mockGeneratedPhotos);
  }, [scenarios]);

  const filteredPhotos = selectedScenario === 'all' 
    ? generatedPhotos 
    : generatedPhotos.filter(photo => photo.scenario === selectedScenario);

  const scenarioOptions: ScenarioFilter[] = [
    { id: 'all', title: 'All Photos', count: generatedPhotos.length },
    ...scenarios.map((scenario: Scenario) => ({
      id: scenario,
      title: scenario.charAt(0).toUpperCase() + scenario.slice(1),
      count: generatedPhotos.filter(p => p.scenario === scenario).length,
    }))
  ];

  const renderPhoto: ListRenderItem<Photo> = ({ item }) => (
    <TouchableOpacity 
      style={styles.photoContainer}
      onPress={() => Alert.alert(
        'Premium Feature',
        'Unlock full-resolution photos for $99.99',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unlock Now', onPress: () => navigation.navigate('Paywall', { photos: generatedPhotos }) }
        ]
      )}
    >
      <Image source={{ uri: item.uri }} style={styles.previewImage} />
      <View style={styles.watermarkOverlay}>
        <Text style={styles.watermarkText}>PREVIEW</Text>
      </View>
      <View style={styles.premiumBadge}>
        <Ionicons name="lock-closed" size={16} color="#FFD700" />
      </View>
    </TouchableOpacity>
  );

  const renderScenarioFilter: ListRenderItem<ScenarioFilter> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedScenario === item.id && styles.filterButtonActive,
      ]}
      onPress={() => setSelectedScenario(item.id)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedScenario === item.id && styles.filterButtonTextActive,
      ]}>
        {item.title} ({item.count})
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your AI Photos</Text>
        <Text style={styles.subtitle}>
          {generatedPhotos.length} photos generated • Previews only
        </Text>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          data={scenarioOptions}
          renderItem={renderScenarioFilter}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      <View style={styles.previewNotice}>
        <Ionicons name="information-circle" size={20} color="#4A90E2" />
        <Text style={styles.previewNoticeText}>
          These are watermarked previews. Unlock full-resolution photos below.
        </Text>
      </View>

      <FlatList
        data={filteredPhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.photoRow}
        contentContainerStyle={styles.galleryContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomSection}>
        <View style={styles.valueProposition}>
          <View style={styles.valueItem}>
            <Text style={styles.valueNumber}>{generatedPhotos.length}</Text>
            <Text style={styles.valueLabel}>Professional Photos</Text>
          </View>
          <View style={styles.valueDivider} />
          <View style={styles.valueItem}>
            <Text style={styles.valueNumber}>$99.99</Text>
            <Text style={styles.valueLabel}>One-time Payment</Text>
          </View>
          <View style={styles.valueDivider} />
          <View style={styles.valueItem}>
            <Text style={styles.valueNumber}>HD</Text>
            <Text style={styles.valueLabel}>High Resolution</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.unlockButton}
          onPress={() => navigation.navigate('Paywall', { photos: generatedPhotos })}
        >
          <Ionicons name="unlock" size={20} color="#fff" style={styles.unlockIcon} />
          <Text style={styles.unlockButtonText}>
            Unlock Full Gallery - $99.99
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Landing')}
        >
          <Text style={styles.secondaryButtonText}>
            Start New Generation
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
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filtersList: {
    paddingVertical: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  previewNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewNoticeText: {
    fontSize: 14,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
  },
  galleryContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  watermarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    transform: [{ rotate: '-45deg' }],
    opacity: 0.8,
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  bottomSection: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  valueProposition: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  valueItem: {
    alignItems: 'center',
    flex: 1,
  },
  valueNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  valueLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  valueDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  unlockButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  unlockIcon: {
    marginRight: 8,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
});

export default PreviewGalleryScreen;