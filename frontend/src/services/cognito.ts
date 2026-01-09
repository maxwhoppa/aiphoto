import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AuthFlowType,
  DeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import * as SecureStore from 'expo-secure-store';

// Configure the Cognito client
const client = new CognitoIdentityProviderClient({
  region: process.env.EXPO_PUBLIC_COGNITO_REGION || 'us-east-1',
});

const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '';

console.log('Cognito Config:', {
  ClientId: CLIENT_ID,
  Region: process.env.EXPO_PUBLIC_COGNITO_REGION,
});

// Step 1: signup with email + password
export async function signUpWithEmail(email: string, password: string): Promise<any> {
  try {
    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
      ],
    });

    const response = await client.send(command);
    console.log('SignUp response:', response);
    return response;
  } catch (error) {
    console.error('SignUp error:', error);
    throw error;
  }
}

// Step 2: confirm signup with OTP sent to email
export async function confirmEmail(email: string, code: string): Promise<any> {
  try {
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    });

    const response = await client.send(command);
    console.log('ConfirmSignUp response:', response);
    return response;
  } catch (error) {
    console.error('ConfirmSignUp error:', error);
    throw error;
  }
}

// Step 3: login
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ accessToken: string; idToken: string; refreshToken: string; expiresIn: number }> {
  try {
    console.log('Attempting login for:', email);

    const command = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await client.send(command);
    console.log('Login response:', response);

    if (!response.AuthenticationResult) {
      throw new Error('No authentication result returned');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken || '',
      idToken: response.AuthenticationResult.IdToken || '',
      refreshToken: response.AuthenticationResult.RefreshToken || '',
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Get current user (simplified version)
export async function getCurrentUser(): Promise<any> {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      // In a real app, you'd validate the token here
      return { token };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Sign out
export function signOut(): void {
  // Clear stored tokens
  SecureStore.deleteItemAsync('auth_token');
  SecureStore.deleteItemAsync('user_data');
}

// Delete user account - allows re-registration with the same email
export async function deleteUser(accessToken: string): Promise<void> {
  try {
    console.log('Deleting user account from Cognito...');
    const command = new DeleteUserCommand({
      AccessToken: accessToken,
    });

    await client.send(command);
    console.log('User account deleted successfully from Cognito');

    // Clear stored tokens after deletion
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('id_token');
    await SecureStore.deleteItemAsync('refresh_token');
  } catch (error) {
    console.error('Delete user error:', error);
    throw error;
  }
}

// Get user attributes (simplified version)
export async function getUserAttributes(): Promise<any> {
  try {
    const userData = await SecureStore.getItemAsync('user_data');
    if (userData) {
      return JSON.parse(userData);
    }
    return {};
  } catch (error) {
    return {};
  }
}