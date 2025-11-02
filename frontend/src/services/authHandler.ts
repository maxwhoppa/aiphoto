import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

interface TokenResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface DecodedToken {
  sub: string;
  email?: string;
  exp: number;
  iat: number;
}

class AuthHandler {
  private client: CognitoIdentityProviderClient;
  private clientId: string;
  private tokens: TokenResponse | null = null;
  private refreshPromise: Promise<TokenResponse> | null = null;
  private onUserDeleted: (() => void) | null = null;

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: process.env.EXPO_PUBLIC_COGNITO_REGION || 'us-east-1',
    });
    this.clientId = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '';
    this.loadStoredTokens();
  }

  private async loadStoredTokens(): Promise<void> {
    try {
      const storedTokens = await SecureStore.getItemAsync('auth_tokens');
      if (storedTokens) {
        this.tokens = JSON.parse(storedTokens);
      }
    } catch (error) {
      console.log('No stored tokens found');
    }
  }

  public async storeTokens(tokens: TokenResponse): Promise<void> {
    this.tokens = tokens;
    await SecureStore.setItemAsync('auth_tokens', JSON.stringify(tokens));
    
    // Also store individual tokens for backward compatibility
    await SecureStore.setItemAsync('auth_token', tokens.idToken);
    await SecureStore.setItemAsync('access_token', tokens.accessToken);
    await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
  }

  public async clearTokens(): Promise<void> {
    this.tokens = null;
    this.refreshPromise = null;

    // Clear all stored tokens
    await SecureStore.deleteItemAsync('auth_tokens');
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_data');
  }

  public setOnUserDeletedCallback(callback: () => void): void {
    this.onUserDeleted = callback;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const decoded: DecodedToken = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      // Add 5 minute buffer before expiration
      return decoded.exp <= (currentTime + 300);
    } catch (error) {
      console.error('Error decoding token:', error);
      return true;
    }
  }

  private async refreshTokens(): Promise<TokenResponse> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    // If refresh is already in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    console.log('Refreshing tokens...');

    this.refreshPromise = (async () => {
      try {
        const command = new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          AuthParameters: {
            REFRESH_TOKEN: this.tokens!.refreshToken,
          },
        });

        const response = await this.client.send(command);

        if (!response.AuthenticationResult) {
          throw new Error('No authentication result in refresh response');
        }

        const newTokens: TokenResponse = {
          accessToken: response.AuthenticationResult.AccessToken || '',
          idToken: response.AuthenticationResult.IdToken || '',
          refreshToken: response.AuthenticationResult.RefreshToken || this.tokens!.refreshToken,
          expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
        };

        await this.storeTokens(newTokens);
        console.log('Tokens refreshed successfully');
        
        return newTokens;
      } catch (error: any) {
        console.error('Token refresh failed:', error);

        // Check if user has been deleted
        if (error.name === 'NotAuthorizedException' &&
            error.message &&
            error.message.includes('user has been deleted')) {
          console.log('User has been deleted, triggering force logout...');

          // Clear tokens
          await this.clearTokens();

          // Trigger force logout callback if set
          if (this.onUserDeleted) {
            this.onUserDeleted();
          }

          throw new Error('User account has been deleted. Please sign in again.');
        }

        // Clear tokens if refresh fails
        await this.clearTokens();
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (!this.tokens) {
      await this.loadStoredTokens();
    }

    if (!this.tokens?.accessToken) {
      return null;
    }

    // Check if token is expired
    if (this.isTokenExpired(this.tokens.accessToken)) {
      try {
        const refreshedTokens = await this.refreshTokens();
        return refreshedTokens.accessToken;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return null;
      }
    }

    return this.tokens.accessToken;
  }

  public async getValidIdToken(): Promise<string | null> {
    if (!this.tokens) {
      await this.loadStoredTokens();
    }

    if (!this.tokens?.idToken) {
      return null;
    }

    // Check if token is expired
    if (this.isTokenExpired(this.tokens.idToken)) {
      try {
        const refreshedTokens = await this.refreshTokens();
        return refreshedTokens.idToken;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return null;
      }
    }

    return this.tokens.idToken;
  }

  public async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const accessToken = await this.getValidAccessToken();
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If we get a 401, try refreshing the token once
    if (response.status === 401) {
      console.log('Received 401, attempting token refresh...');
      
      try {
        await this.refreshTokens();
        const newAccessToken = await this.getValidAccessToken();
        
        if (newAccessToken) {
          // Retry the request with new token
          const retryHeaders = {
            'Authorization': `Bearer ${newAccessToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
          };

          return fetch(url, {
            ...options,
            headers: retryHeaders,
          });
        }
      } catch (refreshError) {
        console.error('Token refresh on 401 failed:', refreshError);
      }
    }

    return response;
  }

  public async getCurrentUser(): Promise<DecodedToken | null> {
    const idToken = await this.getValidIdToken();
    
    if (!idToken) {
      return null;
    }

    try {
      return jwtDecode<DecodedToken>(idToken);
    } catch (error) {
      console.error('Error decoding ID token:', error);
      return null;
    }
  }

  public isAuthenticated(): boolean {
    return !!this.tokens?.accessToken && !!this.tokens?.idToken;
  }
}

// Export singleton instance
export const authHandler = new AuthHandler();

// Helper function for making authenticated API calls
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;
  
  return authHandler.makeAuthenticatedRequest(url, options);
}

// Helper function for making authenticated API calls with JSON response
export async function apiRequestJson<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiRequest(endpoint, options);

  if (!response.ok) {
    // Handle 503 Service Unavailable with a user-friendly message
    if (response.status === 503) {
      throw new Error('Our devs are deploying! Please wait ~30 seconds!');
    }

    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export default authHandler;