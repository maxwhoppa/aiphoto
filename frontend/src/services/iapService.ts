import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  requestPurchase,
  fetchProducts,
  getAvailablePurchases,
  PurchaseError,
  Purchase,
  Product,
  ErrorCode,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRODUCT_SKUS = Platform.select({
  ios: ['com.dreamboat.premium.photogeneration'],
  android: ['com.dreamboat.premium.photogeneration'],
}) || [];

const STORAGE_KEY = '@aiphoto_purchase';

export class IAPService {
  private static instance: IAPService;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private pendingPurchaseResolve: ((purchase: Purchase) => void) | null = null;
  private pendingPurchaseReject: ((error: any) => void) | null = null;

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
      async (purchase: Purchase) => {
        console.log('Purchase updated:', JSON.stringify(purchase, null, 2));

        // In v14: iOS uses transactionReceipt, Android uses purchaseToken
        const receipt = Platform.OS === 'ios'
          ? (purchase as any).transactionReceipt || purchase.purchaseToken
          : purchase.purchaseToken;

        // Process purchase even without receipt - the transaction ID is what matters
        try {
          await this.savePurchase(purchase);
          await finishTransaction({ purchase, isConsumable: true });

          // Resolve pending purchase promise
          if (this.pendingPurchaseResolve) {
            this.pendingPurchaseResolve(purchase);
            this.pendingPurchaseResolve = null;
            this.pendingPurchaseReject = null;
          }
        } catch (error) {
          console.error('Error processing purchase:', error);
          if (this.pendingPurchaseReject) {
            this.pendingPurchaseReject(error);
            this.pendingPurchaseResolve = null;
            this.pendingPurchaseReject = null;
          }
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('Purchase error:', error);

        // Reject pending purchase promise
        if (this.pendingPurchaseReject) {
          this.pendingPurchaseReject(error);
          this.pendingPurchaseResolve = null;
          this.pendingPurchaseReject = null;
        }

        if (error.code !== ErrorCode.UserCancelled) {
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
      console.log('Fetching products with SKUs:', PRODUCT_SKUS);
      const products = await fetchProducts({ skus: PRODUCT_SKUS });
      console.log('Available products:', products);
      console.log('Products count:', products?.length);
      if (!products || products.length === 0) {
        console.warn('No products returned. Verify in App Store Connect:');
        console.warn('1. Product ID matches: com.dreamboat.premium.photogeneration');
        console.warn('2. Product status is "Ready to Submit"');
        console.warn('3. Paid Apps Agreement is signed');
        console.warn('4. Using Sandbox tester account');
        return [];
      }
      return products as Product[];
    } catch (err: any) {
      console.error('Error getting products:', err);
      console.error('Error code:', err?.code);
      console.error('Error message:', err?.message);
      return [];
    }
  }

  async makePurchase(): Promise<Purchase | null> {
    try {
      const productId = PRODUCT_SKUS[0];

      // Create a promise that will be resolved by the purchaseUpdatedListener
      const purchasePromise = new Promise<Purchase>((resolve, reject) => {
        this.pendingPurchaseResolve = resolve;
        this.pendingPurchaseReject = reject;
      });

      // Initiate the purchase (this may return void in v14)
      await requestPurchase({
        request: {
          ios: {
            sku: productId,
            andDangerouslyFinishTransactionAutomatically: false,
          },
          android: {
            skus: [productId],
          },
        },
        type: 'in-app',
      });

      // Wait for the purchase to complete via the listener
      const purchase = await purchasePromise;
      return purchase;
    } catch (err: any) {
      // Clear pending promise on error
      this.pendingPurchaseResolve = null;
      this.pendingPurchaseReject = null;

      if (err.code === ErrorCode.UserCancelled || err.code === 'user-cancelled') {
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

  private async savePurchase(purchase: Purchase) {
    try {
      const purchaseData = {
        productId: purchase.productId,
        transactionId: purchase.id,
        transactionDate: purchase.transactionDate,
        purchaseToken: purchase.purchaseToken,
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

  async validatePurchaseWithServer(purchase: Purchase): Promise<{ valid: boolean; paymentId?: string }> {
    try {
      // Log full purchase object to debug field names
      console.log('Full purchase object:', JSON.stringify(purchase, null, 2));

      // In v14: iOS uses transactionReceipt, Android uses purchaseToken
      const receipt = Platform.OS === 'ios'
        ? (purchase as any).transactionReceipt || purchase.purchaseToken
        : purchase.purchaseToken;

      // In v14: transaction ID might be in different fields
      const transactionId = (purchase as any).transactionId
        || purchase.id
        || (purchase as any).originalTransactionIdentifierIOS
        || `generated_${Date.now()}`;

      console.log('Validating purchase:', {
        platform: Platform.OS,
        productId: purchase.productId,
        transactionId,
        hasReceipt: !!receipt,
        receiptLength: receipt?.length,
      });

      // Import apiRequestJson from authHandler to use TRPC endpoint
      const { apiRequestJson } = await import('./authHandler');

      const response = await apiRequestJson('/trpc/iap.validatePurchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: Platform.OS,
          receipt: receipt || '',
          productId: purchase.productId,
          transactionId: transactionId,
        }),
      });

      console.log('Validation response:', JSON.stringify(response, null, 2));

      // Check for error response
      if (response?.error) {
        console.error('Server returned error:', response.error);
        return { valid: false };
      }

      // TRPC response format: { result: { data: { json: { valid: true, paymentId: "..." } } } }
      const data = response?.result?.data?.json || response?.result?.data || {};
      return {
        valid: data.valid || false,
        paymentId: data.paymentId,
      };
    } catch (error) {
      console.error('Error validating purchase with server:', error);
      return { valid: false };
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