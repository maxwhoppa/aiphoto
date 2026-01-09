import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import {
  signUpWithEmail,
  confirmEmail,
  loginWithEmail,
  signOut as cognitoSignOut,
  deleteUser as cognitoDeleteUser,
} from '../services/cognito';
import { authHandler } from '../services/authHandler';
import {
  signInWithApple as socialSignInWithApple,
  isAppleSignInAvailable,
} from '../services/socialAuth';

interface User {
  sub: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  token: string | null;
  isAppleSignInAvailable: boolean;
  // Authenticated request methods
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>;
  getValidAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);

  useEffect(() => {
    loadStoredAuth();
    checkAppleSignIn();

    // Set up callback for force logout when user is deleted
    authHandler.setOnUserDeletedCallback(() => {
      console.log('Force logout triggered due to deleted user');
      // Force clear local state
      setUser(null);
      setToken(null);
      // Note: AuthHandler already clears tokens internally
    });
  }, []);

  const checkAppleSignIn = async () => {
    const available = await isAppleSignInAvailable();
    setAppleSignInAvailable(available);
  };

  const loadStoredAuth = async () => {
    try {
      // Use authHandler to get current user
      const currentUser = await authHandler.getCurrentUser();
      const validToken = await authHandler.getValidIdToken();
      
      if (currentUser && validToken) {
        setUser({
          sub: currentUser.sub,
          email: currentUser.email,
        });
        setToken(validToken);
      }
    } catch (error) {
      console.log('No authenticated user found:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Signing up with email:', email);
      
      // Store credentials for auto-login after confirmation
      setPendingEmail(email);
      setPendingPassword(password);
      
      await signUpWithEmail(email, password);
      
      console.log('Signup successful, verification code sent to:', email);
    } catch (error: any) {
      console.error('Failed to sign up:', error);
      
      if (error.name === 'UsernameExistsException') {
        throw new Error('An account with this email already exists. Please sign in instead.');
      } else if (error.name === 'InvalidPasswordException') {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character.');
      } else if (error.name === 'InvalidParameterException') {
        throw new Error('Invalid email format.');
      }
      
      throw error;
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      console.log('Confirming signup for:', email);
      
      await confirmEmail(email, code);
      
      console.log('Email confirmed successfully');
      
      // Auto sign in after confirmation
      if (pendingEmail && pendingPassword) {
        console.log('Auto-signing in after confirmation...');
        await signIn(pendingEmail, pendingPassword);
        
        // Clear pending credentials
        setPendingEmail(null);
        setPendingPassword(null);
      }
    } catch (error: any) {
      console.error('Failed to confirm signup:', error);
      
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Verification code has expired');
      }
      
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in with email:', email);
      
      const tokens = await loginWithEmail(email, password);
      
      // Store tokens using authHandler
      await authHandler.storeTokens({
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });
      
      // Decode the ID token to get user info
      const decodedToken: any = jwtDecode(tokens.idToken);
      
      const userData: User = {
        sub: decodedToken.sub,
        email: decodedToken.email || email,
      };
      
      setUser(userData);
      setToken(tokens.idToken);
      
      console.log('Successfully signed in');
    } catch (error: any) {
      console.error('Failed to sign in:', error);
      
      if (error.name === 'NotAuthorizedException') {
        throw new Error('Invalid email or password');
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('No account found with this email');
      } else if (error.name === 'UserNotConfirmedException') {
        throw new Error('Please verify your email before signing in');
      }
      
      throw error;
    }
  };

  const signInWithApple = async () => {
    try {
      console.log('Signing in with Apple...');

      const { user: appleUser, tokens } = await socialSignInWithApple();

      // Store tokens using authHandler
      await authHandler.storeTokens({
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });

      const userData: User = {
        sub: appleUser.sub,
        email: appleUser.email,
      };

      setUser(userData);
      setToken(tokens.idToken);

      console.log('Successfully signed in with Apple');
    } catch (error: any) {
      console.error('Failed to sign in with Apple:', error);
      throw error;
    }
  };


  const signOut = async () => {
    try {
      // Sign out from Cognito
      cognitoSignOut();


      // Clear tokens using authHandler
      await authHandler.clearTokens();

      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    try {
      console.log('Deleting user account...');

      // Get the current access token
      const accessToken = await authHandler.getValidAccessToken();

      if (!accessToken) {
        throw new Error('No valid access token found');
      }

      // Delete the user from Cognito (this allows re-registration with same email)
      await cognitoDeleteUser(accessToken);

      // Clear local tokens
      await authHandler.clearTokens();

      // Clear local state
      setUser(null);
      setToken(null);

      console.log('Account deleted successfully');
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        confirmSignUp,
        signInWithApple,
        signOut,
        deleteAccount,
        token,
        isAppleSignInAvailable: appleSignInAvailable,
        // Provide access to authHandler methods
        makeAuthenticatedRequest: authHandler.makeAuthenticatedRequest.bind(authHandler),
        getValidAccessToken: authHandler.getValidAccessToken.bind(authHandler),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};