import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Text } from '../../components/Text';
import { BackButton } from '../../components/BackButton';
import Constants from 'expo-constants';
import { checkPaymentAccess } from '../../services/api';


// Conditionally import IAP service based on environment
let iapService: any;
let Product: any;

if (Constants.appOwnership === 'expo') {
  // Running in Expo Go - use mock service
  const mock = require('../../services/iapServiceMock');
  iapService = mock.iapService;
} else {
  // Running in standalone app - use real IAP
  const real = require('../../services/iapService');
  const iap = require('react-native-iap');
  iapService = real.iapService;
  Product = iap.Product;
}


interface PaywallScreenIAPProps {
  onPaymentSuccess: (paymentId?: string) => void;
  onPaymentCancel: () => void;
  selectedScenarios: string[];
  photoCount: number;
  navigation?: any;
}

export const PaywallScreenIAP: React.FC<PaywallScreenIAPProps> = ({
  onPaymentSuccess,
  onPaymentCancel,
  selectedScenarios,
  photoCount,
  navigation,
}) => {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [product, setProduct] = useState<any>(null); // Use 'any' to support both real and mock products
  const [hasExistingPurchase, setHasExistingPurchase] = useState(false);

  const totalPhotos = photoCount * selectedScenarios.length;

  useEffect(() => {
    initializeIAP();
    return () => {
      iapService.cleanup();
    };
  }, []);

  const initializeIAP = async () => {
    setIsLoading(true);
    try {
      // First, check if user has an unredeemed payment (free credit)
      try {
        const accessResult = await checkPaymentAccess();
        console.log('Payment access check result:', accessResult);

        if (accessResult?.hasAccess && accessResult?.paymentId) {
          console.log('User has unredeemed payment/credit, bypassing payment flow');
          setHasExistingPurchase(true);
          // Automatically proceed with the existing payment
          onPaymentSuccess(accessResult.paymentId);
          return;
        }
      } catch (accessError) {
        console.log('Error checking payment access, continuing with normal flow:', accessError);
        // Continue with normal IAP flow if access check fails
      }

      const initialized = await iapService.initialize();
      if (!initialized) {
        Alert.alert(
          'Store Not Available',
          'In-app purchases are not available on this device.',
          [{ text: 'OK', onPress: onPaymentCancel }]
        );
        return;
      }

      // Get available products
      const products = await iapService.getProductsForSale();
      if (products && products.length > 0) {
        setProduct(products[0]);
      } else {
        Alert.alert(
          'Products Not Available',
          'Unable to load products from the store. Please try again later.',
          [{ text: 'OK', onPress: onPaymentCancel }]
        );
      }
    } catch (error) {
      console.error('Error initializing IAP:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize purchases. Please try again.',
        [{ text: 'OK', onPress: onPaymentCancel }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!product) {
      Alert.alert('Error', 'Product information not available');
      return;
    }

    setIsPurchasing(true);
    try {
      const purchase = await iapService.makePurchase();

      if (purchase) {
        // Validate with server and get the server's payment ID
        const result = await iapService.validatePurchaseWithServer(purchase);

        if (result.valid && result.paymentId) {
          onPaymentSuccess(result.paymentId);
        } else {
          Alert.alert(
            'Validation Failed',
            'Purchase validation failed. Please contact support if the issue persists.'
          );
        }
      } else {
        // User cancelled
        console.log('Purchase cancelled by user');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      // v14 uses 'user-cancelled' instead of 'E_USER_CANCELLED'
      if (error.code !== 'user-cancelled') {
        Alert.alert(
          'Purchase Failed',
          error.message || 'Failed to complete purchase. Please try again.'
        );
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  // Restore feature removed - each generation requires new payment

  const formatPrice = (price?: string) => {
    return price || '$99.99';
  };

  if (isLoading && !product) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <BackButton onPress={onPaymentCancel} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="subtitle" style={[styles.loadingTitle, { color: colors.text }]}>
            Loading products...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <BackButton onPress={onPaymentCancel} />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
      >
            <View style={styles.header}>
              <Text variant="largeTitle" style={{ color: colors.text, textAlign: 'center' }}>
                Unlock Your AI Photos
              </Text>
              <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
                Get {totalPhotos} professionally generated photos to enhance your dating profile
              </Text>
            </View>

            <View style={[styles.pricingCard, { backgroundColor: colors.card }]}>
              <View style={styles.savingsBadge}>
                <Text style={[styles.savingsText, { color: colors.success }]}>
                  SAVE UP TO 97%
                </Text>
              </View>
              <View style={[styles.pricingHeader, { backgroundColor: colors.primary }]}>
                <Text variant="title" style={[styles.pricingTitle, { color: 'white' }]}>
                  Premium Photo Package
                </Text>
                <Text variant="body" style={[styles.pricingSubtitle, { color: 'white' }]}>
                  One generation per purchase
                </Text>
              </View>
              <View style={styles.pricingBody}>
                <View style={styles.priceContainer}>
                  <View style={styles.priceComparison}>
                    <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                      ${(50 * totalPhotos).toLocaleString()}-${(200 * totalPhotos).toLocaleString()}
                    </Text>
                    <Text variant="caption" style={[styles.comparisonLabel, { color: colors.textSecondary }]}>
                      Professional photoshoot ({totalPhotos} photos)
                    </Text>
                  </View>
                  <Text variant="largeTitle" style={[styles.price, { color: colors.primary }]}>
                    ${(99.99 / totalPhotos).toFixed(2)} per photo
                  </Text>
                  <Text variant="caption" style={[styles.priceNote, { color: colors.textSecondary }]}>
                    {formatPrice(product?.localizedPrice)} total
                  </Text>
                </View>
                <View style={styles.photosInfo}>
                  <Text variant="subtitle" style={[styles.photosCount, { color: colors.text }]}>
                    {totalPhotos} Total Photos
                  </Text>
                  <Text variant="caption" style={[styles.photosBreakdown, { color: colors.textSecondary }]}>
                    {photoCount} photos × {selectedScenarios.length} scenarios
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.featuresContainer}>
              <Text variant="title" style={[styles.featuresTitle, { color: colors.text }]}>
                What You Get
              </Text>

              <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="image-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text variant="subtitle" style={[styles.featureTitle, { color: colors.text }]}>
                    High-Quality Photos
                  </Text>
                  <Text variant="body" style={[styles.featureDescription, { color: colors.textSecondary }]}>
                    Indistinguishable from professional photoshoots
                  </Text>
                </View>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="flash-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text variant="subtitle" style={[styles.featureTitle, { color: colors.text }]}>
                    Instant Access
                  </Text>
                  <Text variant="body" style={[styles.featureDescription, { color: colors.textSecondary }]}>
                    Get your photos immediately after purchase
                  </Text>
                </View>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="download-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text variant="subtitle" style={[styles.featureTitle, { color: colors.text }]}>
                    Full Resolution Downloads
                  </Text>
                  <Text variant="body" style={[styles.featureDescription, { color: colors.textSecondary }]}>
                    Download all photos in high resolution for any platform
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.guarantee}>
              <View style={styles.guaranteeHeader}>
                <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                <Text variant="subtitle" style={[styles.guaranteeTitle, { color: colors.text }]}>
                  Satisfaction Guarantee
                </Text>
              </View>
              <Text variant="body" style={[styles.guaranteeText, { color: colors.textSecondary }]}>
                We're confident you'll love your photos. If you're not satisfied, contact support for assistance.
              </Text>
            </View>

            <View style={[styles.roiCard, { backgroundColor: colors.card, borderColor: colors.success }]}>
              <View style={styles.roiHeader}>
                <Ionicons name="trending-up" size={24} color={colors.success} />
                <Text variant="subtitle" style={[styles.roiTitle, { color: colors.text }]}>
                  It Pays for Itself
                </Text>
              </View>
              <Text variant="body" style={[styles.roiText, { color: colors.textSecondary }]}>
                One bad date costs $50-100 and hours of your time. Better photos mean better matches, fewer wasted dates, and faster connections with the right people.
              </Text>
              <Text variant="body" style={[styles.roiHighlight, { color: colors.success }]}>
                Skip just one or two bad dates and you've already made your money back.
              </Text>
            </View>

      </ScrollView>

      <View style={[styles.buttonContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: colors.primary }]}
          onPress={handlePurchase}
          disabled={isPurchasing || !product}
        >
          {isPurchasing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text variant="subtitle" style={[styles.payButtonText, { color: 'white' }]}>
                Purchase Now
              </Text>
              <Text variant="caption" style={[styles.payButtonSubtext, { color: 'white' }]}>
                {formatPrice(product?.localizedPrice)} per generation
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.security}>
          <View style={styles.securityContainer}>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
            <Text variant="caption" style={[styles.securityText, { color: colors.textSecondary }]}>
              Secure payment via {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
            </Text>
          </View>
        </View>
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
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  pricingCard: {
    borderRadius: 20,
    overflow: 'visible',
    marginBottom: 20,
    marginTop: 15,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  pricingHeader: {
    padding: 16,
    paddingBottom: 14,
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  pricingSubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    opacity: 0.9,
  },
  pricingBody: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  priceComparison: {
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 20,
    fontFamily: 'Poppins-Regular',
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  comparisonLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
    opacity: 0.8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
    lineHeight: 32,
  },
  priceNote: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  photosInfo: {
    alignItems: 'center',
  },
  photosCount: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  photosBreakdown: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  featureIconContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
  guarantee: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  guaranteeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guaranteeTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  guaranteeText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  security: {
    alignItems: 'center',
    marginTop: 8,
  },
  securityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  payButton: {
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  payButtonSubtext: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    opacity: 0.9,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    marginTop: 16,
  },
  roiCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  roiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  roiTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  roiText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    lineHeight: 22,
    marginBottom: 12,
  },
  roiHighlight: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    lineHeight: 22,
  },
});