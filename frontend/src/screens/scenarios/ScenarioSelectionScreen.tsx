import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BackButton } from '../../components/BackButton';

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPopular?: boolean;
  isForceSelected?: boolean;
}

interface ScenarioSelectionScreenProps {
  onNext: (selectedScenarios: string[]) => void;
  photos: string[];
  navigation?: any;
}

export const ScenarioSelectionScreen: React.FC<ScenarioSelectionScreenProps> = ({
  onNext,
  photos,
  navigation,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  
  const scenarios: Scenario[] = [
    {
      id: 'photoshoot',
      name: 'Photoshoot',
      description: 'Professional studio photos',
      icon: '📸',
      isPopular: true,
    },
    {
      id: 'gym',
      name: 'Gym',
      description: 'Athletic and fit lifestyle',
      icon: '💪',
      isPopular: true,
    },
    {
      id: 'beach',
      name: 'Beach',
      description: 'Relaxed beach vibes',
      icon: '🏖️',
      isPopular: true,
    },
    {
      id: 'rooftop',
      name: 'Rooftop',
      description: 'Urban city views',
      icon: '🏙️',
      isPopular: true,
    },
    {
      id: 'nature',
      name: 'Nature',
      description: 'Outdoor adventure',
      icon: '🌲',
    },
    {
      id: 'coffee',
      name: 'Coffee Shop',
      description: 'Casual coffee date',
      icon: '☕',
    },
    {
      id: 'formal',
      name: 'Formal',
      description: 'Business professional',
      icon: '🤵',
    },
    {
      id: 'casual',
      name: 'Casual',
      description: 'Everyday comfortable',
      icon: '👕',
    },
    {
      id: 'travel',
      name: 'Travel',
      description: 'Adventure explorer',
      icon: '✈️',
    },
    {
      id: 'restaurant',
      name: 'Restaurant',
      description: 'Fine dining experience',
      icon: '🍽️',
    },
    {
      id: 'art',
      name: 'Art Gallery',
      description: 'Cultural and sophisticated',
      icon: '🎨',
    },
    {
      id: 'music',
      name: 'Music Event',
      description: 'Concert or festival vibes',
      icon: '🎵',
    },
    {
      id: 'sports',
      name: 'Sports',
      description: 'Athletic activities',
      icon: '⚽',
    },
    {
      id: 'home',
      name: 'At Home',
      description: 'Comfortable home setting',
      icon: '🏠',
    },
    {
      id: 'winter',
      name: 'Winter',
      description: 'Cozy winter activities',
      icon: '❄️',
    },
  ];

  // Default select photoshoot but allow deselection
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['photoshoot']);

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      } else {
        if (prev.length >= 6) {
          return prev; // Max 6 scenarios
        }
        return [...prev, scenarioId];
      }
    });
  };

  const handleNext = () => {
    onNext(selectedScenarios);
  };

  const renderScenario = (scenario: Scenario) => {
    const isSelected = selectedScenarios.includes(scenario.id);
    const isDisabled = !isSelected && selectedScenarios.length >= 6;

    return (
      <TouchableOpacity
        key={scenario.id}
        style={[
          styles.scenarioCard,
          {
            backgroundColor: isSelected ? colors.primary : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            opacity: isDisabled ? 0.5 : 1,
          }
        ]}
        onPress={() => toggleScenario(scenario.id)}
        disabled={isDisabled}
      >
        {scenario.isPopular && (
          <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.popularText, { color: colors.background }]}>
              POPULAR
            </Text>
          </View>
        )}
        

        <View style={styles.scenarioContent}>
          <Text style={styles.scenarioIcon}>{scenario.icon}</Text>
          <Text
            style={[
              styles.scenarioName,
              { color: isSelected ? colors.background : colors.text }
            ]}
          >
            {scenario.name}
          </Text>
          <Text
            style={[
              styles.scenarioDescription,
              { color: isSelected ? colors.background : colors.textSecondary }
            ]}
          >
            {scenario.description}
          </Text>
        </View>

        {isSelected && (
          <View style={[styles.selectedIndicator, { backgroundColor: colors.background }]}>
            <Text style={[styles.selectedText, { color: colors.primary }]}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {navigation && (
        <BackButton onPress={() => navigation.goBack()} />
      )}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Choose Your Scenarios
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select 6 scenarios for your AI photo generation
        </Text>
        <Text style={[styles.counter, { color: colors.primary }]}>
          {selectedScenarios.length}/6 selected
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.info}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            💡 Professional photoshoot is recommended for the best results
          </Text>
        </View>

        <View style={styles.scenariosGrid}>
          {scenarios.map(renderScenario)}
        </View>

        <View style={styles.fatigueTip}>
          <Text style={[styles.fatigueTitle, { color: colors.text }]}>
            Reduce Decision Fatigue
          </Text>
          <Text style={[styles.fatigueText, { color: colors.textSecondary }]}>
            We've pre-selected popular scenarios and marked others to help you decide quickly.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.generateButton,
            {
              backgroundColor: selectedScenarios.length === 6 ? colors.primary : colors.border,
            },
          ]}
          onPress={handleNext}
          disabled={selectedScenarios.length !== 6}
        >
          <Text
            style={[
              styles.generateButtonText,
              {
                color: selectedScenarios.length === 6 ? colors.background : colors.textSecondary,
              },
            ]}
          >
            Generate Photos ({photos.length} photos × {selectedScenarios.length} scenarios)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
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
    marginBottom: 12,
  },
  counter: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  info: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scenariosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  scenarioCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 15,
    position: 'relative',
    marginBottom: 12,
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  forceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  forceText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  scenarioContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scenarioIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  scenarioDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  fatigueTip: {
    marginTop: 30,
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
  },
  fatigueTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  fatigueText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  generateButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});