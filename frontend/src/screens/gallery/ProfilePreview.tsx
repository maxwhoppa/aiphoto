import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
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
  onViewAllPhotos: () => void;
  isDownloading?: boolean;
  downloadingPhotos?: Set<string>;
}

export const ProfilePreview: React.FC<ProfilePreviewProps> = ({
  selectedPhotos,
  onDownloadAll,
  onReselect,
  onViewAllPhotos,
  isDownloading = false,
  downloadingPhotos = new Set(),
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth - 40;
  const imageHeight = cardWidth * 1.2; // Aspect ratio similar to dating apps

  // Sort photos by selectedProfileOrder
  const sortedPhotos = [...selectedPhotos].sort((a, b) => {
    const orderA = a.selectedProfileOrder ?? 999;
    const orderB = b.selectedProfileOrder ?? 999;
    return orderA - orderB;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header with Action Buttons */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.secondary }]}
          onPress={onDownloadAll}
          disabled={downloadingPhotos.size > 0}
        >
          <Ionicons name="download-outline" size={18} color={colors.background} />
          <Text variant="button" style={[styles.headerButtonText, { color: colors.background }]}>
            {downloadingPhotos.size > 0 ? 'Downloading...' : 'Download'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.accent }]}
          onPress={onReselect}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.background} />
          <Text variant="button" style={[styles.headerButtonText, { color: colors.background }]}>
            Reselect
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.primary }]}
          onPress={onViewAllPhotos}
        >
          <Ionicons name="grid-outline" size={18} color={colors.background} />
          <Text variant="button" style={[styles.headerButtonText, { color: colors.background }]}>
            All Photos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Preview Title */}
      <View style={styles.titleSection}>
        <Text variant="title" style={[styles.title, { color: colors.text }]}>Your Profile Preview</Text>
        <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
          Swipe to see how your profile looks
        </Text>
      </View>

      {/* Profile Cards */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sortedPhotos.map((photo, index) => (
          <View key={photo.id} style={styles.profileCard}>
            {/* Photo */}
            <View style={[styles.imageContainer, { width: cardWidth, height: imageHeight }]}>
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
            </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    gap: 10,
  },
  headerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingBottom: 15,
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
    paddingBottom: 30,
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