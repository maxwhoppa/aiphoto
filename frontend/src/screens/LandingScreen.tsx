import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const LandingScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>AI Photo Dating</Text>
            <Text style={styles.subtitle}>Transform Your Dating Profile</Text>
          </View>

          <View style={styles.heroSection}>
            <Text style={styles.heroText}>
              Get professional-quality photos for your dating profile using AI
            </Text>
            <View style={styles.featuresList}>
              <Text style={styles.featureItem}>🤳 Upload your photos</Text>
              <Text style={styles.featureItem}>🎨 Choose from multiple scenarios</Text>
              <Text style={styles.featureItem}>✨ Get 50+ AI-generated photos</Text>
              <Text style={styles.featureItem}>💝 Perfect for dating apps</Text>
            </View>
          </View>

          <View style={styles.benefitsSection}>
            <Text style={styles.sectionTitle}>Why AI Photo Dating?</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitTitle}>Professional Quality</Text>
              <Text style={styles.benefitText}>
                Get photos that look like they were taken by a professional photographer
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitTitle}>Multiple Scenarios</Text>
              <Text style={styles.benefitText}>
                Beach, gym, nature, formal - we've got every setting covered
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitTitle}>Time & Money Saver</Text>
              <Text style={styles.benefitText}>
                No expensive photoshoots or awkward poses - just great results
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('PhotoUpload')}
          >
            <Text style={styles.ctaButtonText}>Get Started</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Start for free • Premium unlock: $99.99
          </Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#f0f0f0',
    textAlign: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
  },
  featuresList: {
    alignItems: 'flex-start',
  },
  featureItem: {
    fontSize: 16,
    color: '#f0f0f0',
    marginBottom: 8,
  },
  benefitsSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  benefitItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#f0f0f0',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  disclaimer: {
    fontSize: 12,
    color: '#d0d0d0',
    textAlign: 'center',
  },
});

export default LandingScreen;