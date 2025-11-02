import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ScenarioCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  images: string[];
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
  const imageWidth = (screenWidth - 40 - 40) / 4.5; // Show 4-5 images, accounting for padding

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
          opacity: isDisabled ? 0.5 : 1,
        }
      ]}
      onPress={onToggle}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: isSelected ? colors.primary : colors.background }]}>
            <Ionicons
              name={icon as any}
              size={24}
              color={isSelected ? colors.background : colors.primary}
            />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.name, { color: colors.text }]}>
                {name}
              </Text>
              {/* {isPopular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.popularText, { color: colors.background }]}>
                    POPULAR
                  </Text>
                </View>
              )} */}
            </View>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {description}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {isSelected ? (
            <View style={[styles.checkbox, styles.checkboxSelected, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Ionicons name="checkmark" size={16} color={colors.background} />
            </View>
          ) : (
            <View style={[styles.checkbox, { borderColor: colors.border }]} />
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.imageScrollContainer}
        decelerationRate="fast"
      >
        {images.map((image, index) => (
          <View key={index} style={[styles.imageContainer, { width: imageWidth }]}>
            <Image
              source={{ uri: image }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        ))}
      </ScrollView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    marginLeft: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
  },
  popularBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderWidth: 0,
  },
  imageScrollContainer: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
  },
  imageContainer: {
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1, // Makes the image square
    backgroundColor: '#f0f0f0',
  },
});