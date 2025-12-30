import React, { useState, useRef, useEffect } from 'react';
import {
  View,
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
import { Button } from '../../components/Button';
import { BottomTab } from '../../components/BottomTab';
import { Text } from '../../components/Text';
import { getScenarioImages } from '../../utils/scenarioImages';
import { ButtonWithFreeBadge } from '../../components/ButtonWithFreeBadge';

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
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  const scenarios: Scenario[] = [
        {
      id: 'pinterest_thirst',
      name: 'Pinterest Thirst',
      description: 'Pinterest-style thirst trap photo',
      icon: 'heart-outline',
      isPopular: true,
      images: getScenarioImages('pinterest_thirst'),
    },
    {
      id: 'white_photoshoot',
      name: 'White Photoshoot',
      description: 'Clean studio backdrop with accessories',
      icon: 'glasses-outline',
      isPopular: true,
      images: getScenarioImages('white_photoshoot'),
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Ultra-realistic corporate portrait',
      icon: 'briefcase-outline',
      images: getScenarioImages('professional'),
    },
    {
      id: 'casual_fitting_room',
      name: 'Casual Fitting Room',
      description: 'Luxury designer fitting room selfie',
      icon: 'shirt-outline',
      images: getScenarioImages('casual_fitting_room'),
    },
    {
      id: 'editorial_photoshoot',
      name: 'Editorial Photoshoot',
      description: 'Contemporary studio portrait',
      icon: 'camera-outline',
      images: getScenarioImages('editorial_photoshoot'),
    },
    {
      id: 'hotel_bathroom',
      name: 'Hotel Bathroom',
      description: 'Luxury hotel bathroom mirror selfie',
      icon: 'bed-outline',
      images: getScenarioImages('hotel_bathroom'),
    },
    {
      id: 'coffee_new',
      name: 'Coffee',
      description: 'Trendy café with fresh coffee',
      icon: 'cafe-outline',
      images: getScenarioImages('coffee_new'),
    },
    {
      id: 'photoshoot',
      name: 'Photoshoot',
      description: 'Professional studio photos',
      icon: 'camera-outline',
      images: getScenarioImages('photoshoot'),
    },
    {
      id: 'rooftop',
      name: 'Rooftop',
      description: 'Urban city views',
      icon: 'business-outline',
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

  // Default select popular scenarios but allow deselection
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['pinterest_thirst', 'white_photoshoot']);

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

  const handleScrollIndicatorPress = () => {
    scrollViewRef.current?.scrollTo({
      y: 200, // Scroll down 200 pixels
      animated: true,
    });
  };

  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    // Hide scroll indicator when user has scrolled down
    setShowScrollIndicator(contentOffset.y < 50);
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {navigation && (
          <BackButton onPress={() => navigation.goBack()} />
        )}
        <View style={styles.header}>
          <Text variant="title" style={[styles.title, { color: colors.text }]}>
            Choose your{'\n'}scenarios
          </Text>
          <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose up to 6 scenarios for your generation
          </Text>
          <Text variant="label" style={[styles.counter, { color: colors.primary }]}>
            {selectedScenarios.length}/6 selected
          </Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
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
        </ScrollView>
      </SafeAreaView>

      <BottomTab
        showScrollIndicator={showScrollIndicator}
        onScrollIndicatorPress={handleScrollIndicatorPress}
      >
        <ButtonWithFreeBadge
          title="Generate photos"
          onPress={handleNext}
          disabled={selectedScenarios.length !== 6}
          variant={selectedScenarios.length === 6 ? 'primary' : 'disabled'}
        />
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
  header: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  title: {
    marginBottom: 20,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'left',
    lineHeight: 22,
    marginBottom: 20,
  },
  counter: {
    fontSize: 18,
    textAlign: 'left',
    marginBottom: 20,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120, // Increased to account for BottomTab height + safe area
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
});