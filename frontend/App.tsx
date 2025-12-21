import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OnboardingFlow } from './src/screens/onboarding/OnboardingFlow';
import { EmailSignInScreen } from './src/screens/auth/EmailSignInScreen';
import { PhoneNumberScreen } from './src/screens/auth/PhoneNumberScreen';
import { PhotoUploadScreen } from './src/screens/upload/PhotoUploadScreen';
import { PhotoValidationScreen } from './src/screens/upload/PhotoValidationScreen';
import { ScenarioSelectionScreen } from './src/screens/scenarios/ScenarioSelectionScreen';
import { PaywallScreenIAP } from './src/screens/payment/PaywallScreenIAP';
import { LoadingScreen } from './src/screens/generation/LoadingScreen';
import { ProfileViewScreen } from './src/screens/gallery/ProfileViewScreen';
import { ThemeSelector } from './src/components/ThemeSelector';
import { ParticleBackground } from './src/components/ParticleBackground';
import { ShakeLogoutHandler } from './src/components/ShakeLogoutHandler';
import { TabNavigator } from './src/navigation/TabNavigator';
import { getGeneratedImages, checkPaymentAccess, getUserInfo } from './src/services/api';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
  selectedProfileOrder?: number | null;
}

type RootStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  PhoneNumber: undefined;
  PhotoUpload: { isRegenerateFlow?: boolean };
  PhotoValidation: { imageIds: string[]; isRegenerateFlow?: boolean };
  ScenarioSelection: { imageIds: string[] };
  Paywall: { selectedScenarios: string[]; imageIds: string[] };
  Loading: { selectedScenarios: string[]; imageIds: string[]; paymentId?: string; isRegenerateFlow?: boolean };
  ProfileView: { generatedPhotos: GeneratedPhoto[]; selectedScenarios: string[] };
  MainTabs: undefined;
  ThemeSettings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasPaymentAccess, setHasPaymentAccess] = useState(false);
  const [hasGeneratedImages, setHasGeneratedImages] = useState(false);
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  const [existingImages, setExistingImages] = useState<GeneratedPhoto[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [needsPhoneNumber, setNeedsPhoneNumber] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Check onboarding completion status on app start
  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Clear image state when user changes or signs out
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear all image-related state when user signs out
      setHasGeneratedImages(false);
      setExistingImages([]);
      setHasPaymentAccess(false);
      setIsCheckingImages(false);
      setCurrentUserId(null);
      setNeedsPhoneNumber(false);
      setIsCheckingPhone(false);
    } else if (user && user.sub !== currentUserId) {
      // Different user signed in - clear previous user's data
      setHasGeneratedImages(false);
      setExistingImages([]);
      setHasPaymentAccess(false);
      setIsCheckingImages(false);
      setCurrentUserId(user.sub);
      setNeedsPhoneNumber(false);
      setIsCheckingPhone(false);
    }
  }, [isAuthenticated, user, currentUserId]);

  // Check for existing generated images when user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isCheckingImages) {
      setIsCheckingImages(true);
      checkForExistingImages();
    }
  }, [isAuthenticated]);

  // Check if user needs to provide phone number when authenticated
  useEffect(() => {
    if (isAuthenticated && !isCheckingPhone) {
      setIsCheckingPhone(true);
      checkForPhoneNumber();
    }
  }, [isAuthenticated]);

  const checkForPhoneNumber = async () => {
    try {
      const userData = await getUserInfo();
      if (!userData.phoneNumber) {
        setNeedsPhoneNumber(true);
      } else {
        setNeedsPhoneNumber(false);
      }
    } catch (error) {
      console.log('Error checking phone number:', error);
      // Don't block the user if we can't check
      setNeedsPhoneNumber(false);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const onboardingCompleted = await SecureStore.getItemAsync('hasCompletedOnboarding');
      if (onboardingCompleted === 'true') {
        setHasCompletedOnboarding(true);
      }
    } catch (error) {
      console.log('Error checking onboarding status:', error);
    } finally {
      setIsInitialized(true);
    }
  };

  const completeOnboarding = async () => {
    try {
      await SecureStore.setItemAsync('hasCompletedOnboarding', 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
      setHasCompletedOnboarding(true); // Continue anyway
    }
  };

  const checkForExistingImages = async () => {
    try {
      const response = await getGeneratedImages({});
      const generatedImages = response?.result?.data || response?.data || response || [];

      if (generatedImages.length > 0) {
        // Convert to ProfileView format
        const generatedPhotos: GeneratedPhoto[] = generatedImages.map((img: any) => ({
          id: img.id,
          uri: img.downloadUrl || img.s3Url,
          scenario: img.scenario,
          downloadUrl: img.downloadUrl,
          selectedProfileOrder: img.selectedProfileOrder || null,
        }));

        console.log('App.tsx: Found generated images, count:', generatedPhotos.length);
        console.log('App.tsx: Selected photos in generatedImages:', generatedPhotos.filter(img => img.selectedProfileOrder).length);
        setExistingImages(generatedPhotos);
        setHasGeneratedImages(true);
        setHasPaymentAccess(true); // They've already paid if they have generated images

        // If user has generated images, they've definitely completed onboarding
        if (!hasCompletedOnboarding) {
          await completeOnboarding();
        }

        return generatedPhotos;
      }
      return [];
    } catch (error) {
      console.log('No existing images found or error checking:', error);
      return [];
    } finally {
      setIsCheckingImages(false);
    }
  };

  const refreshImages = async (): Promise<GeneratedPhoto[]> => {
    try {
      const response = await getGeneratedImages({});
      const generatedImages = response?.result?.data || response?.data || response || [];

      if (generatedImages.length > 0) {
        // Convert to ProfileView format
        const generatedPhotos: GeneratedPhoto[] = generatedImages.map((img: any) => ({
          id: img.id,
          uri: img.downloadUrl || img.s3Url,
          scenario: img.scenario,
          downloadUrl: img.downloadUrl,
          selectedProfileOrder: img.selectedProfileOrder || null,
        }));

        setExistingImages(generatedPhotos);
        return generatedPhotos;
      }
      return existingImages; // Return current images if API fails
    } catch (error) {
      console.error('Error refreshing images:', error);
      return existingImages; // Return current images on error
    }
  };

  const handleRegenerateFlow = async (navigation: any) => {
    // Always require new payment for regeneration
    setHasPaymentAccess(false);
    navigation.navigate('PhotoUpload', { isRegenerateFlow: true });
  };

  if (isLoading || !isInitialized || (isAuthenticated && (isCheckingImages || isCheckingPhone))) {
    return null; // Show splash screen in real app
  }

  return (
    <ParticleBackground intensity="medium">
      {isAuthenticated && <ShakeLogoutHandler onLogout={signOut} />}
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: 'transparent' },
          }}
        >
        {!hasCompletedOnboarding ? (
          <Stack.Screen
            name="Onboarding"
            options={{ headerShown: false }}
          >
            {(props) => (
              <OnboardingFlow
                {...props}
                onComplete={completeOnboarding}
              />
            )}
          </Stack.Screen>
        ) : !isAuthenticated ? (
          <Stack.Screen
            name="SignIn"
            options={{ headerShown: false }}
          >
            {(props) => (
              <EmailSignInScreen
                {...props}
                onSuccess={() => {
                  // Navigation will be handled by auth state change
                }}
                onBack={() => setHasCompletedOnboarding(false)}
              />
            )}
          </Stack.Screen>
        ) : needsPhoneNumber ? (
          <Stack.Screen
            name="PhoneNumber"
            options={{ headerShown: false }}
          >
            {(props) => (
              <PhoneNumberScreen
                {...props}
                onComplete={() => {
                  setNeedsPhoneNumber(false);
                }}
                onSkip={() => {
                  // Skip for now - will ask again next login
                  setNeedsPhoneNumber(false);
                }}
              />
            )}
          </Stack.Screen>
        ) : hasGeneratedImages ? (
          // User has existing images - show TabNavigator with ProfileView and Settings
          <Stack.Screen
            name="MainTabs"
            options={{ headerShown: false }}
          >
            {({ navigation }) => (
              <TabNavigator
                existingImages={existingImages}
                onRegenerateFlow={handleRegenerateFlow}
                onRefreshImages={refreshImages}
              />
            )}
          </Stack.Screen>
        ) : (
          // User has no existing images - show upload flow
          <>
            <Stack.Screen
              name="PhotoUpload"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <PhotoUploadScreen
                  onNext={(imageIds) => {
                    navigation.navigate('PhotoValidation', {
                      imageIds,
                      isRegenerateFlow: route.params?.isRegenerateFlow,
                    });
                  }}
                  isRegenerateFlow={route.params?.isRegenerateFlow}
                  navigation={navigation}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="PhotoValidation"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <PhotoValidationScreen
                  imageIds={route.params.imageIds}
                  onNext={(validatedImageIds) => {
                    navigation.navigate('ScenarioSelection', { imageIds: validatedImageIds });
                  }}
                  onBack={() => navigation.goBack()}
                  navigation={navigation}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="ScenarioSelection"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <ScenarioSelectionScreen
                  photos={route.params.imageIds || []} // Pass the actual image IDs for count
                  navigation={navigation}
                  onNext={(selectedScenarios) => {
                    // Navigate directly to Paywall when Generate Photos is clicked
                    navigation.navigate('Paywall', {
                      selectedScenarios,
                      imageIds: route.params.imageIds,
                    });
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Paywall"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <PaywallScreenIAP
                  selectedScenarios={route.params.selectedScenarios}
                  photoCount={route.params.imageIds.length}
                  navigation={navigation}
                  onPaymentSuccess={(paymentId) => {
                    setHasPaymentAccess(true);
                    navigation.navigate('Loading', {
                      selectedScenarios: route.params.selectedScenarios,
                      imageIds: route.params.imageIds,
                      paymentId,
                    });
                  }}
                  onPaymentCancel={() => {
                    navigation.goBack();
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Loading"
              options={{
                headerShown: false,
                gestureEnabled: false, // Disable swipe back on iOS
              }}
            >
              {({ navigation, route }) => (
                <LoadingScreen
                  selectedScenarios={route.params.selectedScenarios}
                  imageIds={route.params.imageIds}
                  paymentId={route.params.paymentId}
                  isRegenerateFlow={route.params.isRegenerateFlow || false}
                  onComplete={(generatedImages) => {
                    // Convert generated images to the format expected by ProfileView
                    // IMPORTANT: Preserve selectedProfileOrder from backend
                    const generatedPhotos: GeneratedPhoto[] = generatedImages.map((img: any) => ({
                      id: img.id,
                      uri: img.downloadUrl || img.s3Url,
                      scenario: img.scenario,
                      downloadUrl: img.downloadUrl,
                      selectedProfileOrder: img.selectedProfileOrder || null,
                    }));

                    console.log('App.tsx LoadingScreen onComplete: Received', generatedPhotos.length, 'photos,',
                      generatedPhotos.filter(p => p.selectedProfileOrder).length, 'with selectedProfileOrder');

                    // Update app state to show they now have images
                    setExistingImages(generatedPhotos);
                    setHasGeneratedImages(true);

                    // Navigate to ProfileView first (in current stack), then app state will switch to MainTabs
                    navigation.reset({
                      index: 0,
                      routes: [{
                        name: 'ProfileView',
                        params: {
                          generatedPhotos: generatedPhotos,
                          selectedScenarios: Array.from(new Set(generatedImages.map((img: any) => img.scenario))),
                        }
                      }],
                    });
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="ProfileView"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <ProfileViewScreen
                  generatedPhotos={route.params.generatedPhotos}
                  selectedScenarios={route.params.selectedScenarios}
                  onGenerateAgain={() => handleRegenerateFlow(navigation)}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="ThemeSettings"
              options={{ headerShown: false }}
              component={ThemeSelector}
            />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
    </ParticleBackground>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
