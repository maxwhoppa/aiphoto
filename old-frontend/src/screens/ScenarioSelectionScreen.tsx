import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ImageBackground,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';
import type { ScenarioOption, Scenario } from '@/types';

const scenarios: ScenarioOption[] = [
  {
    id: 'beach',
    title: 'Beach Day',
    description: 'Relaxed beach vibes with natural lighting',
    icon: '🏖️',
    gradient: ['#FFB6C1', '#FFA07A'],
  },
  {
    id: 'gym',
    title: 'Fitness',
    description: 'Athletic and confident gym shots',
    icon: '💪',
    gradient: ['#98FB98', '#90EE90'],
  },
  {
    id: 'formal',
    title: 'Formal',
    description: 'Professional and sophisticated looks',
    icon: '👔',
    gradient: ['#87CEEB', '#6495ED'],
  },
  {
    id: 'casual',
    title: 'Casual',
    description: 'Everyday comfortable and approachable',
    icon: '👕',
    gradient: ['#DDA0DD', '#DA70D6'],
  },
  {
    id: 'nature',
    title: 'Nature',
    description: 'Outdoor adventures and hiking vibes',
    icon: '🌲',
    gradient: ['#90EE90', '#32CD32'],
  },
  {
    id: 'urban',
    title: 'Urban',
    description: 'City life and street photography style',
    icon: '🏙️',
    gradient: ['#D3D3D3', '#A9A9A9'],
  },
  {
    id: 'coffee',
    title: 'Coffee Shop',
    description: 'Cozy cafe moments and intellectual vibes',
    icon: '☕',
    gradient: ['#DEB887', '#CD853F'],
  },
  {
    id: 'travel',
    title: 'Travel',
    description: 'Wanderlust and adventure shots',
    icon: '✈️',
    gradient: ['#87CEFA', '#4682B4'],
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'ScenarioSelection'>;

const ScenarioSelectionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { photos } = route.params;
  const [selectedScenarios, setSelectedScenarios] = useState<Scenario[]>([]);

  const toggleScenario = (scenarioId: Scenario): void => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  const canProceed = selectedScenarios.length >= 3;

  const renderScenarioItem: ListRenderItem<ScenarioOption> = ({ item }) => {
    const isSelected = selectedScenarios.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.scenarioCard,
          isSelected && styles.scenarioCardSelected,
        ]}
        onPress={() => toggleScenario(item.id)}
      >
        <View style={styles.scenarioContent}>
          <Text style={styles.scenarioIcon}>{item.icon}</Text>
          <Text style={styles.scenarioTitle}>{item.title}</Text>
          <Text style={styles.scenarioDescription}>{item.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Scenarios</Text>
          <Text style={styles.subtitle}>
            Select at least 3 scenarios for your AI photoshoot. Each scenario will generate 6-8 unique photos.
          </Text>
        </View>

        <View style={styles.selectionInfo}>
          <Text style={styles.selectionText}>
            Selected: {selectedScenarios.length} scenarios
          </Text>
          <Text style={styles.estimateText}>
            Estimated photos: {selectedScenarios.length * 7}
          </Text>
        </View>

        <FlatList
          data={scenarios}
          renderItem={renderScenarioItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.scenarioRow}
          scrollEnabled={false}
          contentContainerStyle={styles.scenariosList}
        />

        <View style={styles.bottomSection}>
          <View style={styles.pricingInfo}>
            <Text style={styles.pricingTitle}>What you'll get:</Text>
            <Text style={styles.pricingItem}>• Preview all generated photos for free</Text>
            <Text style={styles.pricingItem}>• Unlock full-resolution photos for $99.99</Text>
            <Text style={styles.pricingItem}>• Download and curate your favorites</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              !canProceed && styles.continueButtonDisabled,
            ]}
            onPress={() => navigation.navigate('Loading', { 
              photos, 
              scenarios: selectedScenarios 
            })}
            disabled={!canProceed}
          >
            <Text style={styles.continueButtonText}>
              Start AI Generation
            </Text>
          </TouchableOpacity>

          {!canProceed && (
            <Text style={styles.requirementText}>
              Please select at least 3 scenarios to continue
            </Text>
          )}
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
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
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
  selectionInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  estimateText: {
    fontSize: 14,
    color: '#666',
  },
  scenariosList: {
    marginBottom: 20,
  },
  scenarioRow: {
    justifyContent: 'space-between',
  },
  scenarioCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  scenarioCardSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#f0f8ff',
  },
  scenarioContent: {
    alignItems: 'center',
  },
  scenarioIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  scenarioDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  bottomSection: {
    marginTop: 20,
  },
  pricingInfo: {
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
  pricingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  pricingItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
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
});

export default ScenarioSelectionScreen;