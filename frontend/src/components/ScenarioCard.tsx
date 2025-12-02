import React, { useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Text } from './Text';

interface ScenarioCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  images: any[];
  isPopular?: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({
  id,
  name,
  description,
  icon,
  images,
  isPopular,
  isSelected,
  isDisabled,
  onToggle,
}) => {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const imageWidth = (screenWidth - 40) / 4.5; // Even smaller images, showing ~4.8 at a time

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.accent + '20' : colors.surface,
          borderColor: isSelected ? colors.accent : colors.border,
          opacity: isDisabled ? 0.5 : 1,
        }
      ]}
      onPress={onToggle}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.imageScrollContainer}
        decelerationRate="fast"
      >
        {images.map((image, index) => (
          <View
            key={index}
            style={[
              styles.imageContainer,
              {
                width: imageWidth,
                height: imageWidth, // Make container square
                marginLeft: index === 0 ? -imageWidth * 0.5 : 0, // First image 50% off-screen
                marginRight: index === images.length - 1 ? -imageWidth * 0.2 : 8, // Last image 20% off-screen
              }
            ]}
          >
            <Image
              source={typeof image === 'string' ? { uri: image } : image}
              style={[styles.image, { width: imageWidth, height: imageWidth }]}
              resizeMode="cover"
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.header}>
        <View style={styles.textContainer}>
          <View style={styles.popularLabelContainer}>
            {isPopular ? (
              <Text variant="caption" weight="bold" style={[styles.popularLabel, { color: colors.accent, fontSize: 14, lineHeight: 17 }]}>
                MOST POPULAR
              </Text>
            ) : (
              <View style={styles.popularLabelPlaceholder} />
            )}
          </View>
          <Text variant="subtitle" weight="bold" style={{ color: colors.text, fontSize: 20, lineHeight: 24 }}>
            {name}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  popularLabelContainer: {
    height: 23, // Fixed height to accommodate the label (17 line height + 6 margin)
    marginBottom: 6,
    justifyContent: 'flex-start',
  },
  popularLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popularLabelPlaceholder: {
    height: 17, // Same as the line height of the popular label
  },
  imageScrollContainer: {
    paddingLeft: 0,
    paddingRight: 0, // Remove padding so images can be partially off-screen
    paddingBottom: 8,
    paddingTop: 16,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
});