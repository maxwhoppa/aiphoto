import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
  SignUpCommand,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import * as Crypto from 'expo-crypto';
import { confirmSocialUser } from './api';

const client = new CognitoIdentityProviderClient({
  region: process.env.EXPO_PUBLIC_COGNITO_REGION || 'us-east-1',
});

const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '';
const USER_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '';

// Sign in with Apple (iOS only)
export async function signInWithApple(): Promise<{
  user: any;
  tokens: { accessToken: string; idToken: string; refreshToken: string; expiresIn: number };
}> {
  try {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    // Check if Apple Sign-In is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    console.log('Apple Sign-In availability:', isAvailable);

    if (!isAvailable) {
      throw new Error('Apple Sign-In is not available on this device');
    }

    // Native Apple Sign-In
    console.log('Starting Apple Sign-In...');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log('Apple credential received:', {
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
      hasIdentityToken: !!credential.identityToken,
      hasAuthorizationCode: !!credential.authorizationCode,
    });

    // Decode the identity token from Apple
    const decodedToken: any = jwtDecode(credential.identityToken!);
    console.log('Decoded Apple token:', {
      sub: decodedToken.sub,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
    });

    // Use email as username (Cognito requirement)
    let email = credential.email || decodedToken.email;

    // If no email from Apple (Hide My Email), create a synthetic email
    if (!email) {
      email = `${credential.user}@privaterelay.appleid.com`;
      console.log('No email from Apple, using synthetic email:', email);
    }

    const username = email;

    // Generate a consistent password for this user
    const baseHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${email}_apple_auth_${CLIENT_ID}`
    );
    const password = `AppleAuth1!${baseHash.substring(0, 20)}`;

    console.log('Apple Sign-In attempt:', {
      username: username,
      passwordHash: baseHash.substring(0, 10) + '...',
      passwordLength: password.length,
    });

    try {
      // Try to sign in first (user might already exist)
      const authCommand = new InitiateAuthCommand({
        ClientId: CLIENT_ID,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await client.send(authCommand);

      if (!response.AuthenticationResult) {
        throw new Error('No authentication result returned');
      }

      const tokens = {
        accessToken: response.AuthenticationResult.AccessToken || '',
        idToken: response.AuthenticationResult.IdToken || '',
        refreshToken: response.AuthenticationResult.RefreshToken || '',
        expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      };

      // Decode the Cognito ID token to get user info
      const cognitoUser: any = jwtDecode(tokens.idToken);

      const user = {
        sub: cognitoUser.sub,
        email: email,
        name: credential.fullName ?
          `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() :
          'Apple User',
        appleUserId: credential.user,
        provider: 'apple',
      };

      return { user, tokens };
    } catch (authError: any) {
      console.log('Sign-in failed, error name:', authError.name);

      // If user not found OR incorrect password, try to create them
      if (authError.name === 'UserNotFoundException' || authError.name === 'NotAuthorizedException') {
        try {
          console.log('Creating new Apple user:', username);

          const signUpCommand = new SignUpCommand({
            ClientId: CLIENT_ID,
            Username: username,
            Password: password,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'name', Value: credential.fullName && (credential.fullName.givenName || credential.fullName.familyName) ?
                `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() :
                'Apple User' },
            ],
          });

          await client.send(signUpCommand);
          console.log('Apple user created, confirming via server...');

          // Confirm user via server
          try {
            await confirmSocialUser(email, 'apple');
            console.log('Apple user confirmed via server');
          } catch (confirmError: any) {
            console.error('Failed to confirm Apple user via server:', confirmError);

            // Check if it's a server permission error
            if (confirmError.message && confirmError.message.includes('not authorized to perform: cognito-idp:AdminGetUser')) {
              console.log('Server lacks IAM permissions - proceeding with sign-in attempt anyway');
              console.log('Note: Server needs cognito-idp:AdminGetUser and cognito-idp:AdminConfirmSignUp permissions');
              // Don't throw error - continue with sign-in attempt since user was created
            } else if (confirmError.message && confirmError.message.includes('500')) {
              console.log('Server error during confirmation - proceeding with sign-in attempt anyway');
              // Don't throw error - continue with sign-in attempt
            } else {
              throw new Error(`Failed to confirm Apple user account: ${confirmError.message}`);
            }
          }

          // Try to sign in after confirmation
          const retryAuthCommand = new InitiateAuthCommand({
            ClientId: CLIENT_ID,
            AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
            AuthParameters: {
              USERNAME: username,
              PASSWORD: password,
            },
          });

          const retryResponse = await client.send(retryAuthCommand);

          if (!retryResponse.AuthenticationResult) {
            throw new Error('User created but sign-in failed');
          }

          const retryTokens = {
            accessToken: retryResponse.AuthenticationResult.AccessToken || '',
            idToken: retryResponse.AuthenticationResult.IdToken || '',
            refreshToken: retryResponse.AuthenticationResult.RefreshToken || '',
            expiresIn: retryResponse.AuthenticationResult.ExpiresIn || 3600,
          };

          const retryCognitoUser: any = jwtDecode(retryTokens.idToken);

          const retryUser = {
            sub: retryCognitoUser.sub,
            email: email,
            name: credential.fullName ?
              `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() :
              'Apple User',
            appleUserId: credential.user,
            provider: 'apple',
          };

          return { user: retryUser, tokens: retryTokens };

        } catch (createError: any) {
          if (createError.name === 'UsernameExistsException') {
            throw new Error('Account exists but sign-in failed. Please try again.');
          }
          throw createError;
        }
      } else if (authError.name === 'UserNotConfirmedException') {
        throw new Error('Please check your email for a verification code and confirm your account first.');
      } else {
        console.error('Apple sign-in auth error:', authError);
        throw authError;
      }
    }
  } catch (error: any) {
    console.error('Apple Sign-In detailed error:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    if (error.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Apple Sign-In was cancelled');
    } else if (error.code === 'ERR_REQUEST_FAILED') {
      throw new Error('Apple Sign-In failed - please try again');
    } else if (error.code === 'ERR_INVALID_RESPONSE') {
      throw new Error('Invalid response from Apple - please try again');
    } else if (error.message?.includes('authorization attempt failed')) {
      throw new Error('Apple authorization failed - check your Apple ID settings and try again');
    }

    throw new Error(`Apple Sign-In error: ${error.message || 'Unknown error'}`);
  }
}


// Check if Apple Sign-In is available
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return await AppleAuthentication.isAvailableAsync();
}

