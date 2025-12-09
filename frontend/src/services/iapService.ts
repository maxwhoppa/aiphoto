import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  requestPurchase,
  getProducts,
  getAvailablePurchases,
  PurchaseError,
  Purchase,
  ProductPurchase,
  SubscriptionPurchase,
  Product,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRODUCT_SKUS = Platform.select({
  ios: ['com.aiphoto.premium.photogeneration'],
  android: ['com.aiphoto.premium.photogeneration'],
}) || [];

const STORAGE_KEY = '@aiphoto_purchase';

export class IAPService {
  private static instance: IAPService;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;

  private constructor() {}

  static getInstance(): IAPService {
    if (!IAPService.instance) {
      IAPService.instance = new IAPService();
    }
    return IAPService.instance;
  }

  async initialize() {
    try {
      const result = await initConnection();
      console.log('IAP connection initialized:', result);
      this.setupListeners();
      return true;
    } catch (err) {
      console.warn('Failed to initialize IAP:', err);
      return false;
    }
  }

  private setupListeners() {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase | SubscriptionPurchase) => {
        console.log('Purchase updated:', purchase);
        const receipt = purchase.transactionReceipt;

        if (receipt) {
          try {
            await this.savePurchase(purchase);
            await finishTransaction({ purchase, isConsumable: true });
          } catch (error) {
            console.error('Error processing purchase:', error);
          }
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('Purchase error:', error);
        if (error.code !== 'E_USER_CANCELLED') {
          Alert.alert(
            'Purchase Error',
            error.message || 'Something went wrong with your purchase.'
          );
        }
      }
    );
  }

  async getProductsForSale(): Promise<Product[]> {
    try {
      const products = await getProducts({ skus: PRODUCT_SKUS });
      console.log('Available products:', products);
      return products;
    } catch (err) {
      console.error('Error getting products:', err);
      return [];
    }
  }

  async makePurchase(): Promise<Purchase | null> {
    try {
      const productId = PRODUCT_SKUS[0];

      if (Platform.OS === 'ios') {
        const purchase = await requestPurchase({
          sku: productId,
          andDangerouslyFinishTransactionAutomaticallyIOS: false,
        });
        return purchase as ProductPurchase;
      } else {
        const purchase = await requestPurchase({
          skus: [productId],
        });
        return purchase as ProductPurchase;
      }
    } catch (err: any) {
      if (err.code === 'E_USER_CANCELLED') {
        console.log('User cancelled purchase');
      } else {
        console.error('Purchase error:', err);
        throw err;
      }
      return null;
    }
  }

  async restorePurchases(): Promise<Purchase[]> {
    try {
      const purchases = await getAvailablePurchases();
      console.log('Restored purchases:', purchases);

      if (purchases && purchases.length > 0) {
        await this.savePurchase(purchases[0]);
      }

      return purchases;
    } catch (err) {
      console.error('Restore purchases error:', err);
      return [];
    }
  }

  private async savePurchase(purchase: Purchase | SubscriptionPurchase) {
    try {
      const purchaseData = {
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        transactionDate: purchase.transactionDate,
        transactionReceipt: purchase.transactionReceipt,
        purchaseToken: (purchase as ProductPurchase).purchaseToken,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(purchaseData));
      console.log('Purchase saved locally');
    } catch (error) {
      console.error('Error saving purchase:', error);
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
      console.error('Error getting stored purchase:', error);
      return null;
    }
  }

  async clearStoredPurchase() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('Stored purchase cleared');
    } catch (error) {
      console.error('Error clearing stored purchase:', error);
    }
  }

  async validatePurchaseWithServer(purchase: Purchase): Promise<boolean> {
    try {
      const receipt = Platform.select({
        ios: purchase.transactionReceipt,
        android: (purchase as ProductPurchase).purchaseToken,
      });

      // Import apiRequestJson from authHandler to use TRPC endpoint
      const { apiRequestJson } = await import('./authHandler');

      const response = await apiRequestJson('/trpc/iap.validatePurchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            platform: Platform.OS,
            receipt: receipt || '',
            productId: purchase.productId,
            transactionId: purchase.transactionId,
          },
        }),
      });

      return response?.result?.data?.valid || false;
    } catch (error) {
      console.error('Error validating purchase with server:', error);
      return false;
    }
  }

  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }

    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }

    endConnection();
  }
}

export const iapService = IAPService.getInstance();