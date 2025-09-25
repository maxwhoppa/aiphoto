import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  name: string;
  text: string;
  rating: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const PaywallScreen: React.FC<Props> = ({ route, navigation }) => {
  const { photos } = route.params;
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handlePurchase = async (): Promise<void> => {
    setIsProcessing(true);
    
    try {
      setTimeout(() => {
        setIsProcessing(false);
        Alert.alert(
          'Payment Successful!',
          'Your full-resolution photos are now available.',
          [
            {
              text: 'View Gallery',
              onPress: () => navigation.navigate('PhotoCuration', { photos })
            }
          ]
        );
      }, 2000);
    } catch (error) {
      setIsProcessing(false);
      Alert.alert(
        'Payment Failed',
        'There was an issue processing your payment. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const features: Feature[] = [
    {
      icon: 'images-outline',
      title: 'Full Resolution Photos',
      description: 'Download all photos in high quality without watermarks'
    },
    {
      icon: 'download-outline',
      title: 'Instant Download',
      description: 'Access your photos immediately after purchase'
    },
    {
      icon: 'heart-outline',
      title: 'Curate Your Favorites',
      description: 'Select and organize your best photos'
    },
    {
      icon: 'phone-portrait-outline',
      title: 'Perfect for Dating Apps',
      description: 'Optimized for Tinder, Bumble, Hinge and more'
    },
    {
      icon: 'infinite-outline',
      title: 'Lifetime Access',
      description: 'Keep your photos forever, no subscription needed'
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Secure & Private',
      description: 'Your photos are processed securely and privately'
    }
  ];

  const testimonials: Testimonial[] = [
    {
      name: 'Sarah, 28',
      text: 'Got 3x more matches after using these photos!',
      rating: 5
    },
    {
      name: 'Mike, 32',
      text: 'Saved me hundreds on a professional photoshoot.',
      rating: 5
    },
    {
      name: 'Emma, 25',
      text: 'The quality is incredible, looks so natural!',
      rating: 5
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={['#4A90E2', '#667eea']}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Unlock Your Gallery</Text>
            <Text style={styles.headerSubtitle}>
              {photos.length} professional AI photos ready for download
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.pricingCard}>
          <View style={styles.priceSection}>
            <Text style={styles.originalPrice}>Professional photoshoot: $300+</Text>
            <View style={styles.currentPriceContainer}>
              <Text style={styles.currentPrice}>$99.99</Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>Save 67%</Text>
              </View>
            </View>
            <Text style={styles.priceDescription}>One-time payment • No subscription</Text>
          </View>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>What You Get</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={24} color="#4A90E2" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.testimonialsSection}>
          <Text style={styles.sectionTitle}>What Others Say</Text>
          {testimonials.map((testimonial, index) => (
            <View key={index} style={styles.testimonialItem}>
              <View style={styles.starsContainer}>
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Ionicons key={i} name="star" size={16} color="#FFD700" />
                ))}
              </View>
              <Text style={styles.testimonialText}>"{testimonial.text}"</Text>
              <Text style={styles.testimonialName}>- {testimonial.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.guaranteeSection}>
          <View style={styles.guaranteeIcon}>
            <Ionicons name="shield-checkmark" size={32} color="#4CAF50" />
          </View>
          <Text style={styles.guaranteeTitle}>30-Day Money Back Guarantee</Text>
          <Text style={styles.guaranteeText}>
            Not satisfied? Get a full refund within 30 days, no questions asked.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.purchaseButton, isProcessing && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="#fff" style={styles.purchaseIcon} />
              <Text style={styles.purchaseButtonText}>
                Unlock Gallery - $99.99
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.laterButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.laterButtonText}>Maybe Later</Text>
        </TouchableOpacity>

        <Text style={styles.secureText}>
          <Ionicons name="lock-closed" size={12} color="#999" /> Secure payment powered by Stripe
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 200,
  },
  headerGradient: {
    marginBottom: 20,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#f0f0f0',
    textAlign: 'center',
  },
  pricingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 24,
  },
  priceSection: {
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 8,
  },
  currentPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginRight: 12,
  },
  savingsBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceDescription: {
    fontSize: 14,
    color: '#666',
  },
  featuresSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  testimonialsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  testimonialItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  testimonialText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    marginBottom: 4,
    lineHeight: 18,
  },
  testimonialName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  guaranteeSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  guaranteeIcon: {
    marginBottom: 12,
  },
  guaranteeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  guaranteeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  purchaseButton: {
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
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseIcon: {
    marginRight: 8,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  laterButtonText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  secureText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default PaywallScreen;