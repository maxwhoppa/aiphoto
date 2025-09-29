import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequestJson } from '../../services/authHandler';
import { BackButton } from '../../components/BackButton';

interface PaywallScreenProps {
  onPaymentSuccess: (paymentId?: string) => void;
  onPaymentCancel: () => void;
  selectedScenarios: string[];
  photoCount: number;
  navigation?: any;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({
  onPaymentSuccess,
  onPaymentCancel,
  selectedScenarios,
  photoCount,
  navigation,
}) => {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const [showWebView, setShowWebView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  const totalPhotos = photoCount * selectedScenarios.length;

  const features = [
    {
      icon: '📸',
      title: 'High-Resolution Photos',
      description: `Get ${totalPhotos} professional-quality photos in full resolution`,
    },
    {
      icon: '🎨',
      title: 'Multiple Scenarios',
      description: `${selectedScenarios.length} different scenarios to showcase your personality`,
    },
    {
      icon: '⚡',
      title: 'Instant Download',
      description: 'Download all photos immediately after generation',
    },
    {
      icon: '💎',
      title: 'Premium Quality',
      description: 'AI-enhanced photos that get you more matches',
    },
    {
      icon: '🔄',
      title: 'Generate Again Option',
      description: 'Option to generate new photos with different scenarios',
    },
    {
      icon: '📱',
      title: 'Mobile Optimized',
      description: 'Photos optimized for dating apps and social media',
    },
  ];

  const handlePayment = async () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to continue with payment.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Creating Stripe checkout session...');
      
      // Call the server's TRPC endpoint to create or get checkout session
      const response = await apiRequestJson('/trpc/payments.getOrCreateCheckout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {}, // TRPC expects a json wrapper for mutations
        }),
      });
      
      console.log('Checkout response:', response);
      
      if (response.result?.data?.hasUnredeemedPayment) {
        // User already has an unredeemed payment, get the payment ID
        const existingPaymentId = response.result?.data?.paymentId;
        Alert.alert(
          'Payment Already Exists',
          'You already have an unredeemed payment. You can proceed to generate your photos without paying again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed', onPress: () => onPaymentSuccess(existingPaymentId) }
          ]
        );
        return;
      }
      
      if (response.result?.data?.checkoutUrl) {
        // Store payment ID for later redemption
        setCurrentPaymentId(response.result?.data?.paymentId);
        setCheckoutUrl(response.result.data.checkoutUrl);
        setShowWebView(true);
      } else {
        throw new Error('No checkout URL received from server');
      }
      
    } catch (error: any) {
      console.error('Failed to create checkout session:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to create payment session. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebViewMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    
    if (data.type === 'payment_success') {
      setShowWebView(false);
      onPaymentSuccess(currentPaymentId || undefined);
    } else if (data.type === 'payment_cancel') {
      setShowWebView(false);
      onPaymentCancel();
    }
  };

  if (showWebView) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.webViewHeader}>
          <Text style={[styles.webViewTitle, { color: colors.text }]}>
            Secure Payment
          </Text>
        </View>
        
        <WebView
          source={{
            uri: checkoutUrl || 'about:blank',
          }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onNavigationStateChange={(navState) => {
            console.log('WebView navigation:', navState.url);
            
            // Check if we've returned from successful payment
            if (navState.url.includes('/payment-success')) {
              setShowWebView(false);
              onPaymentSuccess(currentPaymentId || undefined);
            } else if (navState.url.includes('/payment-cancelled')) {
              setShowWebView(false);
              onPaymentCancel();
            }
          }}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                Loading secure payment...
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {navigation && (
        <BackButton onPress={() => navigation.goBack()} />
      )}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Unlock Your Photos
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Get access to all your AI-generated photos in high resolution
          </Text>
        </View>

        <View style={styles.pricingCard}>
          <View style={[styles.pricingHeader, { backgroundColor: colors.primary }]}>
            <Text style={[styles.pricingTitle, { color: colors.background }]}>
              Premium Access
            </Text>
            <Text style={[styles.pricingSubtitle, { color: colors.background }]}>
              One-time payment
            </Text>
          </View>
          
          <View style={[styles.pricingBody, { backgroundColor: colors.surface }]}>
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: colors.text }]}>$99.99</Text>
              <Text style={[styles.priceNote, { color: colors.textSecondary }]}>
                {(99.99 / totalPhotos).toFixed(2)} per photo
              </Text>
            </View>
            
            <View style={styles.photosInfo}>
              <Text style={[styles.photosCount, { color: colors.primary }]}>
                {totalPhotos} High-Resolution Photos
              </Text>
              <Text style={[styles.photosBreakdown, { color: colors.textSecondary }]}>
                {photoCount} photos × {selectedScenarios.length} scenarios
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={[styles.featuresTitle, { color: colors.text }]}>
            What You Get
          </Text>
          
          {features.map((feature, index) => (
            <View key={index} style={[styles.featureCard, { backgroundColor: colors.surface }]}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.guarantee}>
          <Text style={[styles.guaranteeTitle, { color: colors.success }]}>
            💯 Satisfaction Guaranteed
          </Text>
          <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
            Not happy with your photos? Get a full refund within 30 days.
          </Text>
        </View>

        <View style={styles.security}>
          <Text style={[styles.securityText, { color: colors.textSecondary }]}>
            🔒 Secure payment powered by Stripe
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: colors.primary }]}
          onPress={handlePayment}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Text style={[styles.payButtonText, { color: colors.background }]}>
                Get My Photos - $99.99
              </Text>
              <Text style={[styles.payButtonSubtext, { color: colors.background }]}>
                Safe & Secure Payment
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelPaymentButton}
          onPress={onPaymentCancel}
        >
          <Text style={[styles.cancelPaymentText, { color: colors.textSecondary }]}>
            Maybe Later
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  pricingCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pricingHeader: {
    padding: 20,
    alignItems: 'center',
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pricingSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  pricingBody: {
    padding: 20,
    alignItems: 'center',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  priceNote: {
    fontSize: 14,
  },
  photosInfo: {
    alignItems: 'center',
  },
  photosCount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  photosBreakdown: {
    fontSize: 14,
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  guarantee: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  guaranteeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  guaranteeText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  security: {
    alignItems: 'center',
    marginBottom: 20,
  },
  securityText: {
    fontSize: 14,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  payButton: {
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  payButtonSubtext: {
    fontSize: 12,
    opacity: 0.9,
  },
  cancelPaymentButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelPaymentText: {
    fontSize: 16,
  },
  webViewHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
});