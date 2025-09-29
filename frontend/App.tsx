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
import { PhotoUploadScreen } from './src/screens/upload/PhotoUploadScreen';
import { ScenarioSelectionScreen } from './src/screens/scenarios/ScenarioSelectionScreen';
import { PaywallScreen } from './src/screens/payment/PaywallScreen';
import { LoadingScreen } from './src/screens/generation/LoadingScreen';
import { ProfileViewScreen } from './src/screens/gallery/ProfileViewScreen';
import { ThemeSelector } from './src/components/ThemeSelector';
import { ParticleBackground } from './src/components/ParticleBackground';
import { getGeneratedImages, checkPaymentAccess } from './src/services/api';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
}

type RootStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  PhotoUpload: { isRegenerateFlow?: boolean };
  ScenarioSelection: { imageIds: string[] };
  Paywall: { selectedScenarios: string[]; imageIds: string[] };
  Loading: { selectedScenarios: string[]; imageIds: string[]; paymentId?: string };
  ProfileView: { generatedPhotos: GeneratedPhoto[]; selectedScenarios: string[] };
  ThemeSettings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasPaymentAccess, setHasPaymentAccess] = useState(false);
  const [hasGeneratedImages, setHasGeneratedImages] = useState(false);
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  const [existingImages, setExistingImages] = useState<GeneratedPhoto[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check onboarding completion status on app start
  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Check for existing generated images when user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isCheckingImages) {
      setIsCheckingImages(true);
      checkForExistingImages();
    }
  }, [isAuthenticated]);

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
        }));

        setExistingImages(generatedPhotos);
        setHasGeneratedImages(true);
        setHasPaymentAccess(true); // They've already paid if they have generated images

        // If user has generated images, they've definitely completed onboarding
        if (!hasCompletedOnboarding) {
          await completeOnboarding();
        }
      }
    } catch (error) {
      console.log('No existing images found or error checking:', error);
      setHasGeneratedImages(false);
    } finally {
      setIsCheckingImages(false);
    }
  };

  const handleRegenerateFlow = async (navigation: any) => {
    try {
      // Check if user has an unredeemed payment
      const paymentResponse = await checkPaymentAccess();

      if (paymentResponse?.result?.data?.hasUnredeemedPayment) {
        // User has an unredeemed payment - they can regenerate without paying
        navigation.navigate('PhotoUpload', { isRegenerateFlow: true });
      } else {
        // User needs to pay for another generation
        // Navigate to photo upload first, then they'll hit the paywall at scenario selection
        setHasPaymentAccess(false); // Reset payment access so they hit the paywall
        navigation.navigate('PhotoUpload', { isRegenerateFlow: true });
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      // If we can't check payment status, assume they need to pay
      setHasPaymentAccess(false);
      navigation.navigate('PhotoUpload', { isRegenerateFlow: true });
    }
  };

  if (isLoading || !isInitialized || (isAuthenticated && isCheckingImages)) {
    return null; // Show splash screen in real app
  }

  return (
    <ParticleBackground intensity="medium">
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
        ) : hasGeneratedImages ? (
          // User has existing images - show ProfileView as main screen
          <>
            <Stack.Screen
              name="ProfileView"
              options={{ headerShown: false }}
            >
              {({ navigation }) => (
                <ProfileViewScreen
                  generatedPhotos={existingImages}
                  selectedScenarios={Array.from(new Set(existingImages.map(img => img.scenario)))}
                  onGenerateAgain={() => handleRegenerateFlow(navigation)}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="PhotoUpload"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <PhotoUploadScreen
                  onNext={(imageIds) => {
                    navigation.navigate('ScenarioSelection', { imageIds });
                  }}
                  isRegenerateFlow={route.params?.isRegenerateFlow}
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
                  onNext={async (selectedScenarios) => {
                    // Double-check payment status before proceeding
                    try {
                      const paymentResponse = await checkPaymentAccess();

                      if (paymentResponse?.result?.data?.hasUnredeemedPayment) {
                        // User has valid payment, proceed to generation
                        navigation.navigate('Loading', {
                          selectedScenarios,
                          imageIds: route.params.imageIds,
                          paymentId: paymentResponse.result.data.paymentId,
                        });
                      } else {
                        // User needs to pay
                        navigation.navigate('Paywall', {
                          selectedScenarios,
                          imageIds: route.params.imageIds,
                        });
                      }
                    } catch (error) {
                      console.error('Error checking payment in scenario selection:', error);
                      // Default to paywall if we can't verify payment
                      navigation.navigate('Paywall', {
                        selectedScenarios,
                        imageIds: route.params.imageIds,
                      });
                    }
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Paywall"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <PaywallScreen
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
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <LoadingScreen
                  selectedScenarios={route.params.selectedScenarios}
                  imageIds={route.params.imageIds}
                  paymentId={route.params.paymentId}
                  onComplete={(generatedImages) => {
                    // Convert generated images to the format expected by ProfileView
                    const generatedPhotos: GeneratedPhoto[] = generatedImages.map((img: any) => ({
                      id: img.id,
                      uri: img.downloadUrl || img.s3Url,
                      scenario: img.scenario,
                      downloadUrl: img.downloadUrl,
                    }));
                    
                    // Update app state to show they now have images (replace with fresh data)
                    setExistingImages(generatedImages.map((img: any) => ({
                      id: img.id,
                      uri: img.downloadUrl || img.s3Url,
                      scenario: img.scenario,
                      downloadUrl: img.downloadUrl,
                    })));
                    setHasGeneratedImages(true);
                    
                    // Reset to ProfileView as the main screen (replace the entire stack)
                    navigation.reset({
                      index: 0,
                      routes: [{ 
                        name: 'ProfileView', 
                        params: {
                          generatedPhotos: generatedImages.map((img: any) => ({
                            id: img.id,
                            uri: img.downloadUrl || img.s3Url,
                            scenario: img.scenario,
                            downloadUrl: img.downloadUrl,
                          })),
                          selectedScenarios: Array.from(new Set(generatedImages.map((img: any) => img.scenario))),
                        }
                      }],
                    });
                  }}
                />
              )}
            </Stack.Screen>
          </>
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
                    navigation.navigate('ScenarioSelection', { imageIds });
                  }}
                  isRegenerateFlow={route.params?.isRegenerateFlow}
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
                  onNext={async (selectedScenarios) => {
                    // Double-check payment status before proceeding
                    try {
                      const paymentResponse = await checkPaymentAccess();

                      if (paymentResponse?.result?.data?.hasUnredeemedPayment) {
                        // User has valid payment, proceed to generation
                        navigation.navigate('Loading', {
                          selectedScenarios,
                          imageIds: route.params.imageIds,
                          paymentId: paymentResponse.result.data.paymentId,
                        });
                      } else {
                        // User needs to pay
                        navigation.navigate('Paywall', {
                          selectedScenarios,
                          imageIds: route.params.imageIds,
                        });
                      }
                    } catch (error) {
                      console.error('Error checking payment in scenario selection:', error);
                      // Default to paywall if we can't verify payment
                      navigation.navigate('Paywall', {
                        selectedScenarios,
                        imageIds: route.params.imageIds,
                      });
                    }
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Paywall"
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <PaywallScreen
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
              options={{ headerShown: false }}
            >
              {({ navigation, route }) => (
                <LoadingScreen
                  selectedScenarios={route.params.selectedScenarios}
                  imageIds={route.params.imageIds}
                  paymentId={route.params.paymentId}
                  onComplete={(generatedImages) => {
                    // Convert generated images to the format expected by ProfileView
                    const generatedPhotos: GeneratedPhoto[] = generatedImages.map((img: any) => ({
                      id: img.id,
                      uri: img.downloadUrl || img.s3Url,
                      scenario: img.scenario,
                      downloadUrl: img.downloadUrl,
                    }));
                    
                    // Update app state to show they now have images
                    setExistingImages(generatedPhotos);
                    setHasGeneratedImages(true);
                    
                    // Reset to ProfileView as the main screen (replace the entire stack)
                    navigation.reset({
                      index: 0,
                      routes: [{ 
                        name: 'ProfileView', 
                        params: {
                          generatedPhotos,
                          selectedScenarios: route.params.selectedScenarios,
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
