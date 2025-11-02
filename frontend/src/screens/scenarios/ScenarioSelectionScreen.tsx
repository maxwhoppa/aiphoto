import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BackButton } from '../../components/BackButton';
import { ScenarioCard } from '../../components/ScenarioCard';

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPopular?: boolean;
  isForceSelected?: boolean;
  images: string[];
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
  
  const getScenarioImages = (scenarioId: string) => {
    const baseUrl = 'https://picsum.photos/400/400?random='; // Square images
    return Array.from({ length: 5 }, (_, i) => `${baseUrl}${scenarioId}_${i}`);
  };

  const scenarios: Scenario[] = [
    {
      id: 'photoshoot',
      name: 'Photoshoot',
      description: 'Professional studio photos',
      icon: 'camera-outline',
      isPopular: true,
      images: getScenarioImages('photoshoot'),
    },
    {
      id: 'gym',
      name: 'Gym',
      description: 'Athletic and fit lifestyle',
      icon: 'barbell-outline',
      isPopular: true,
      images: getScenarioImages('gym'),
    },
    {
      id: 'beach',
      name: 'Beach',
      description: 'Relaxed beach vibes',
      icon: 'sunny-outline',
      isPopular: true,
      images: getScenarioImages('beach'),
    },
    {
      id: 'rooftop',
      name: 'Rooftop',
      description: 'Urban city views',
      icon: 'business-outline',
      isPopular: true,
      images: getScenarioImages('rooftop'),
    },
    {
      id: 'nature',
      name: 'Nature',
      description: 'Outdoor adventure',
      icon: 'leaf-outline',
      images: getScenarioImages('nature'),
    },
    {
      id: 'coffee',
      name: 'Coffee Shop',
      description: 'Casual coffee date',
      icon: 'cafe-outline',
      images: getScenarioImages('coffee'),
    },
    {
      id: 'formal',
      name: 'Formal',
      description: 'Business professional',
      icon: 'shirt-outline',
      images: getScenarioImages('formal'),
    },
    {
      id: 'casual',
      name: 'Casual',
      description: 'Everyday comfortable',
      icon: 'shirt-outline',
      images: getScenarioImages('casual'),
    },
    {
      id: 'travel',
      name: 'Travel',
      description: 'Adventure explorer',
      icon: 'airplane-outline',
      images: getScenarioImages('travel'),
    },
    {
      id: 'restaurant',
      name: 'Restaurant',
      description: 'Fine dining experience',
      icon: 'restaurant-outline',
      images: getScenarioImages('restaurant'),
    },
    {
      id: 'art',
      name: 'Art Gallery',
      description: 'Cultural and sophisticated',
      icon: 'color-palette-outline',
      images: getScenarioImages('art'),
    },
    {
      id: 'music',
      name: 'Music Event',
      description: 'Concert or festival vibes',
      icon: 'musical-notes-outline',
      images: getScenarioImages('music'),
    },
    {
      id: 'sports',
      name: 'Sports',
      description: 'Athletic activities',
      icon: 'football-outline',
      images: getScenarioImages('sports'),
    },
    {
      id: 'home',
      name: 'At Home',
      description: 'Comfortable home setting',
      icon: 'home-outline',
      images: getScenarioImages('home'),
    },
    {
      id: 'winter',
      name: 'Winter',
      description: 'Cozy winter activities',
      icon: 'snow-outline',
      images: getScenarioImages('winter'),
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


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.info}>
            <View style={styles.infoContent}>
              <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Professional photoshoot is recommended for the best results
              </Text>
            </View>
          </View>

          <View style={styles.scenariosList}>
            {scenarios.map((scenario) => {
              const isSelected = selectedScenarios.includes(scenario.id);
              const isDisabled = !isSelected && selectedScenarios.length >= 6;

              return (
                <ScenarioCard
                  key={scenario.id}
                  id={scenario.id}
                  name={scenario.name}
                  description={scenario.description}
                  icon={scenario.icon}
                  images={scenario.images}
                  isPopular={scenario.isPopular}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  onToggle={() => toggleScenario(scenario.id)}
                />
              );
            })}
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
      </SafeAreaView>

      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
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
            Continue to Payment
          </Text>
        </TouchableOpacity>
      </View>
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
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  info: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scenariosList: {
    marginBottom: 20,
  },
  fatigueTip: {
    marginTop: 10,
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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