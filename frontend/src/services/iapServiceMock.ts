// Mock IAP Service for Expo Go testing
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@aiphoto_purchase';

export class IAPServiceMock {
  private static instance: IAPServiceMock;

  private constructor() {}

  static getInstance(): IAPServiceMock {
    if (!IAPServiceMock.instance) {
      IAPServiceMock.instance = new IAPServiceMock();
    }
    return IAPServiceMock.instance;
  }

  async initialize() {
    console.log('[MOCK IAP] Service initialized (Expo Go mode)');
    return true;
  }

  async getProductsForSale() {
    console.log('[MOCK IAP] Returning mock products');
    return [
      {
        productId: 'com.aiphoto.premium.photogeneration',
        localizedPrice: '$99.99',
        price: '99.99',
        currency: 'USD',
        title: 'Premium Photo Package',
        description: 'Get 50-60 AI-generated photos',
      },
    ];
  }

  async makePurchase() {
    console.log('[MOCK IAP] Simulating purchase flow');

    // Simulate purchase dialog
    return new Promise((resolve) => {
      Alert.alert(
        'Mock Purchase',
        'This is a simulated purchase for testing in Expo Go. In production, this will use real IAP.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(null),
          },
          {
            text: 'Simulate Purchase',
            onPress: () => {
              const mockPurchase = {
                productId: 'com.aiphoto.premium.photogeneration',
                transactionId: `mock_${Date.now()}`,
                transactionDate: Date.now().toString(),
                transactionReceipt: 'mock_receipt',
              };
              this.savePurchase(mockPurchase);
              resolve(mockPurchase);
            },
          },
        ]
      );
    });
  }

  async restorePurchases() {
    console.log('[MOCK IAP] Simulating restore');
    const stored = await this.getStoredPurchase();
    return stored ? [stored] : [];
  }

  private async savePurchase(purchase: any) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(purchase));
      console.log('[MOCK IAP] Purchase saved locally');
    } catch (error) {
      console.error('[MOCK IAP] Error saving purchase:', error);
    }
  }

  async getStoredPurchase() {
    try {
      const purchaseString = await AsyncStorage.getItem(STORAGE_KEY);
      if (purchaseString) {
        return JSON.parse(purchaseString);
      }
      return null;
    } catch (error) {
      console.error('[MOCK IAP] Error getting stored purchase:', error);
      return null;
    }
  }

  async clearStoredPurchase() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[MOCK IAP] Stored purchase cleared');
    } catch (error) {
      console.error('[MOCK IAP] Error clearing stored purchase:', error);
    }
  }

  async validatePurchaseWithServer(purchase: any) {
    console.log('[MOCK IAP] Mock validation - always returns true');
    return true;
  }

  cleanup() {
    console.log('[MOCK IAP] Cleanup called');
  }
}

export const iapService = IAPServiceMock.getInstance();