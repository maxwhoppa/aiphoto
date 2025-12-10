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

            // For Apple Sign-In, we should be more lenient with server confirmation failures
            console.log('Server confirmation failed, but this is expected for Apple Sign-In');
            console.log('Apple users should be auto-confirmed without requiring manual verification');

            // Check for specific server errors
            if (confirmError.message && confirmError.message.includes('not authorized to perform: cognito-idp:AdminGetUser')) {
              console.log('Server lacks IAM permissions - this is a configuration issue');
              console.log('Note: Server needs cognito-idp:AdminGetUser and cognito-idp:AdminConfirmSignUp permissions');
            } else if (confirmError.message && confirmError.message.includes('500')) {
              console.log('Server error during confirmation - likely a temporary issue');
            }

            // Don't throw error here - continue with sign-in attempt since user was created
            // The server confirmation is a best-effort attempt for Apple users
            console.log('Proceeding with Apple Sign-In despite server confirmation failure...');
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
        console.log('User not confirmed, attempting to confirm via server...');

        try {
          // Try to confirm the user via the server
          await confirmSocialUser(email, 'apple');
          console.log('Apple user confirmed via server');

          // Try to sign in again after confirmation
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
            throw new Error('User confirmed but sign-in failed');
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

        } catch (confirmError: any) {
          console.error('Failed to confirm Apple user via server:', confirmError);

          // For Apple Sign-In, we should not require email verification
          // This is likely a server permission issue or the user is already confirmed
          console.log('Apple Sign-In auto-confirmation failed, but proceeding...');
          console.log('Note: Apple users should not require manual email verification');

          // Instead of throwing an error, try signing in one more time
          // The user might have been confirmed by another process
          try {
            const finalRetryAuthCommand = new InitiateAuthCommand({
              ClientId: CLIENT_ID,
              AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
              AuthParameters: {
                USERNAME: username,
                PASSWORD: password,
              },
            });

            const finalRetryResponse = await client.send(finalRetryAuthCommand);

            if (!finalRetryResponse.AuthenticationResult) {
              throw new Error('Apple Sign-In failed: Unable to authenticate user after multiple attempts');
            }

            const finalTokens = {
              accessToken: finalRetryResponse.AuthenticationResult.AccessToken || '',
              idToken: finalRetryResponse.AuthenticationResult.IdToken || '',
              refreshToken: finalRetryResponse.AuthenticationResult.RefreshToken || '',
              expiresIn: finalRetryResponse.AuthenticationResult.ExpiresIn || 3600,
            };

            const finalCognitoUser: any = jwtDecode(finalTokens.idToken);

            const finalUser = {
              sub: finalCognitoUser.sub,
              email: email,
              name: credential.fullName ?
                `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() :
                'Apple User',
              appleUserId: credential.user,
              provider: 'apple',
            };

            return { user: finalUser, tokens: finalTokens };

          } catch (finalError: any) {
            console.error('Final Apple Sign-In attempt failed:', finalError);

            if (finalError.name === 'UserNotConfirmedException') {
              throw new Error('Apple Sign-In requires admin approval. Please contact support.');
            } else {
              throw new Error(`Apple Sign-In failed: ${finalError.message || 'Unable to complete authentication'}`);
            }
          }
        }
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

