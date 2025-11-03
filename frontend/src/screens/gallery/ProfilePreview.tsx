import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BottomTab } from '../../components/BottomTab';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
  selectedProfileOrder?: number | null;
}

interface ProfilePreviewProps {
  selectedPhotos: GeneratedPhoto[];
  onDownloadAll: () => void;
  onReselect: () => void;
  onGenerateAgain: () => void;
  onViewAllPhotos: () => void;
  onSinglePhotoReplace?: (photoIndex: number, currentPhoto: GeneratedPhoto) => void;
  isDownloading?: boolean;
  downloadingPhotos?: Set<string>;
  isNewGeneration?: boolean;
}

export const ProfilePreview: React.FC<ProfilePreviewProps> = ({
  selectedPhotos,
  onDownloadAll,
  onReselect,
  onGenerateAgain,
  onViewAllPhotos,
  onSinglePhotoReplace,
  isDownloading = false,
  downloadingPhotos = new Set(),
  isNewGeneration = false,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth - 40;
  const imageHeight = cardWidth * 1.2; // Aspect ratio similar to dating apps
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Create bouncing animation for the notification dot
  useEffect(() => {
    if (isNewGeneration) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -5,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isNewGeneration, bounceAnim]);

  // Sort photos by selectedProfileOrder
  const sortedPhotos = [...selectedPhotos].sort((a, b) => {
    const orderA = a.selectedProfileOrder ?? 999;
    const orderB = b.selectedProfileOrder ?? 999;
    return orderA - orderB;
  });

  const handleScrollIndicatorPress = () => {
    scrollViewRef.current?.scrollTo({
      y: 300, // Scroll down 300 pixels
      animated: true,
    });
  };

  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    // Hide scroll indicator when user has scrolled down
    setShowScrollIndicator(contentOffset.y < 50);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Profile Preview Title */}
      <View style={styles.titleSection}>
        <Text variant="title" style={[styles.title, { color: colors.text }]}>Your profile preview</Text>
        <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
          Swipe to see how your profile looks
        </Text>
      </View>

      {/* Profile Cards */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {sortedPhotos.map((photo, index) => (
          <View key={photo.id} style={styles.profileCard}>
            {/* Photo */}
            <TouchableOpacity
              style={[styles.imageContainer, { width: cardWidth, height: imageHeight }]}
              onPress={() => {
                if (onSinglePhotoReplace) {
                  onSinglePhotoReplace(index, photo);
                } else {
                  onReselect();
                }
              }}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: photo.downloadUrl || photo.uri }}
                style={styles.profileImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />

              {/* Photo Number Badge */}
              <View style={[styles.photoBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.photoBadgeText, { color: colors.background }]}>
                  Photo {index + 1}
                </Text>
              </View>

              {/* Scenario Badge */}
              <View style={[styles.scenarioBadge, { backgroundColor: colors.background }]}>
                <Text style={[styles.scenarioBadgeText, { color: colors.text }]}>
                  {photo.scenario.charAt(0).toUpperCase() + photo.scenario.slice(1)}
                </Text>
              </View>

              {/* Download Loading Overlay */}
              {downloadingPhotos.has(photo.id) && (
                <View style={styles.downloadingOverlay}>
                  <View style={[styles.downloadingModal, { backgroundColor: colors.surface }]}>
                    <ActivityIndicator
                      size="large"
                      color={colors.primary}
                      style={styles.spinner}
                    />
                    <Text style={[styles.downloadingLabel, { color: colors.text }]}>
                      Saving...
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Mock Profile Info (like dating apps) */}
            {index === 0 && (
              <View style={[styles.profileInfo, { backgroundColor: colors.surface }]}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  Your Name, 25
                </Text>
                <View style={styles.profileDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      2 miles away
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="school-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      University
                    </Text>
                  </View>
                </View>
                <Text style={[styles.profileBio, { color: colors.text }]}>
                  This is how your profile will look with these amazing AI-generated photos!
                </Text>
              </View>
            )}

            {/* Mock Prompt/Question (like Hinge) */}
            {index === 1 && (
              <View style={[styles.promptCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.promptQuestion, { color: colors.primary }]}>
                  My simple pleasures
                </Text>
                <Text style={[styles.promptAnswer, { color: colors.text }]}>
                  Coffee in the morning, sunset walks, and a good book
                </Text>
              </View>
            )}

            {index === 3 && (
              <View style={[styles.promptCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.promptQuestion, { color: colors.primary }]}>
                  I'm looking for
                </Text>
                <Text style={[styles.promptAnswer, { color: colors.text }]}>
                  Someone who loves adventures and deep conversations
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* Add More Photos Card if less than 6 */}
        {sortedPhotos.length < 6 && (
          <TouchableOpacity
            style={[styles.addMoreCard, { borderColor: colors.primary }]}
            onPress={onReselect}
          >
            <Ionicons name="add-circle-outline" size={48} color={colors.primary} />
            <Text style={[styles.addMoreText, { color: colors.primary }]}>
              Add More Photos
            </Text>
            <Text style={[styles.addMoreSubtext, { color: colors.textSecondary }]}>
              You can add up to {6 - sortedPhotos.length} more photos
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Bottom Tab with Buttons */}
      <BottomTab
        showScrollIndicator={showScrollIndicator}
        onScrollIndicatorPress={handleScrollIndicatorPress}
        scrollIndicatorOffset={180} // Higher offset for multi-button layout
      >
        {/* Main Download Button */}
        <Button
          title={downloadingPhotos.size > 0 ? 'Downloading...' : 'Download pictures'}
          onPress={onDownloadAll}
          disabled={downloadingPhotos.size > 0}
          variant={downloadingPhotos.size > 0 ? 'disabled' : 'primary'}
          icon="download-outline"
          loading={downloadingPhotos.size > 0}
        />

        {/* Side by side buttons */}
        <View style={styles.sideBySideButtons}>
          <TouchableOpacity
            style={styles.sideButton}
            onPress={onGenerateAgain}
          >
            <Ionicons name="refresh-outline" size={24} color="#000000" />
            <Text style={styles.sideButtonText}>
              Generate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideButton}
            onPress={onViewAllPhotos}
          >
            <Ionicons name="grid-outline" size={24} color="#000000" />
            <Text style={styles.sideButtonText}>
              All Photos
            </Text>
            {isNewGeneration && (
              <Animated.View
                style={[
                  styles.notificationDot,
                  {
                    transform: [
                      {
                        translateY: bounceAnim,
                      },
                    ],
                  },
                ]}
              />
            )}
          </TouchableOpacity>
        </View>
      </BottomTab>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 10,
  },
  sideBySideButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  sideButton: {
    flex: 1,
    height: 40, // Reduced from 56 to 40
    borderRadius: 20, // Reduced from 28 to 20
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12, // Added padding
    gap: 8, // Added gap between icon and text
    backgroundColor: '#EAEAEA', // Fixed background color
  },
  sideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: '#1E1E1E', // Fixed text color
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35', // Orange color
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },
  profileCard: {
    marginBottom: 20,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  photoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scenarioBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  scenarioBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileInfo: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  profileDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
  },
  profileBio: {
    fontSize: 14,
    lineHeight: 20,
  },
  promptCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  promptQuestion: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  promptAnswer: {
    fontSize: 16,
    lineHeight: 22,
  },
  addMoreCard: {
    height: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  addMoreText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  addMoreSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingModal: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  spinner: {
    marginBottom: 10,
  },
  downloadingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});