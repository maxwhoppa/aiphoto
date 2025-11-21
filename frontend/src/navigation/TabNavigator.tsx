import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ProfileScreen } from '../screens/gallery/ProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { PhotoUploadScreen } from '../screens/upload/PhotoUploadScreen';
import { ScenarioSelectionScreen } from '../screens/scenarios/ScenarioSelectionScreen';
import { PaywallScreen } from '../screens/payment/PaywallScreen';
import { LoadingScreen } from '../screens/generation/LoadingScreen';
import { useTheme } from '../context/ThemeContext';
import { checkPaymentAccess, getGeneratedImages, checkGenerationStatus, setSelectedProfilePhotos } from '../services/api';
import { setLastViewedPhotoCount, getLastViewedPhotoCount } from '../utils/photoViewTracking';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
  selectedProfileOrder?: number | null;
}

export type TabParamList = {
  ProfileTab: undefined;
  SettingsTab: undefined;
};

export type ProfileStackParamList = {
  ProfileView: { generatedPhotos: GeneratedPhoto[]; selectedScenarios: string[] };
  PhotoUpload: { isRegenerateFlow?: boolean };
  ScenarioSelection: { imageIds: string[] };
  Paywall: { selectedScenarios: string[]; imageIds: string[] };
  Loading: { selectedScenarios: string[]; imageIds: string[]; paymentId?: string; isRegenerateFlow?: boolean };
};

const Tab = createBottomTabNavigator<TabParamList>();
const ProfileStack = createStackNavigator<ProfileStackParamList>();

interface ProfileStackNavigatorProps {
  existingImages: GeneratedPhoto[];
  onRegenerateFlow: (navigation: any) => void;
  onRefreshImages?: () => Promise<GeneratedPhoto[]>;
}

function ProfileStackNavigator({ existingImages, onRegenerateFlow, onRefreshImages }: ProfileStackNavigatorProps) {
  const [images, setImages] = React.useState<GeneratedPhoto[]>(existingImages);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationMessage, setGenerationMessage] = React.useState("Images Generating...");
  const [hasNewGeneratedPhotos, setHasNewGeneratedPhotos] = React.useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = React.useState(false);
  const previousGeneratingRef = React.useRef(false);
  const completionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const generatingStartTimeRef = React.useRef<number | null>(null);
  const lastGenerationIdRef = React.useRef<string | null>(null);
  const hasShownCompletionRef = React.useRef(false);

  // Check generation status on mount and periodically
  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        console.log('TabNavigator: Checking generation status...');
        const statusResponse = await checkGenerationStatus();
        const generationData = statusResponse?.result?.data || statusResponse?.data || statusResponse;
        const isCurrentlyGenerating = generationData?.isGenerating || false;
        console.log('TabNavigator: isCurrentlyGenerating:', isCurrentlyGenerating, 'previousGeneratingRef.current:', previousGeneratingRef.current);

        // Clear any existing completion timeout to prevent conflicts
        if (completionTimeoutRef.current) {
          clearTimeout(completionTimeoutRef.current);
          completionTimeoutRef.current = null;
        }

        // Check if we have a recent generation that just completed
        const currentGenerationId = generationData?.generationId;
        const wasGenerating = previousGeneratingRef.current;
        const isNowComplete = !isCurrentlyGenerating;
        const hasNewGeneration = currentGenerationId && currentGenerationId !== lastGenerationIdRef.current;

        // Update the last generation ID we've seen
        if (currentGenerationId) {
          lastGenerationIdRef.current = currentGenerationId;
        }

        // Show completion message if:
        // 1. We were generating and now we're not (traditional completion detection)
        // 2. We have a new generation ID but generation is not active (user returned after completion)
        const shouldShowCompletion = (wasGenerating && isNowComplete) ||
                                    (hasNewGeneration && !isCurrentlyGenerating && !hasShownCompletionRef.current);

        if (shouldShowCompletion) {
          console.log('TabNavigator: Generation completed! Showing completion message and refreshing images');
          console.log('TabNavigator: Completion reason - wasGenerating:', wasGenerating, 'isNowComplete:', isNowComplete, 'hasNewGeneration:', hasNewGeneration);

          setIsGenerating(true); // Keep true to show notification
          setShowCompletionMessage(true);
          setGenerationMessage("Images complete!");
          setHasNewGeneratedPhotos(true); // Ensure new photos flag is set
          hasShownCompletionRef.current = true;

          // Immediately refresh images when generation completes
          if (onRefreshImages) {
            onRefreshImages().then(async (newImages) => {
              // After successful refresh, ensure the bouncing dot shows by checking photo counts
              if (newImages && newImages.length > 0) {
                try {
                  const currentViewedCount = await getLastViewedPhotoCount();
                  console.log('TabNavigator: After generation completion - currentViewedCount:', currentViewedCount, 'newImages.length:', newImages.length);

                  // If we have more images than previously viewed, the bouncing dot should show automatically
                  // But let's ensure the viewed count is set correctly to trigger the "new photos" state
                  if (newImages.length > currentViewedCount) {
                    console.log('TabNavigator: New photos detected after generation, bouncing dot should show');
                  }
                } catch (error) {
                  console.error('TabNavigator: Error checking photo view counts after generation:', error);
                }
              }
            }).catch((error) => {
              console.error('TabNavigator: Error refreshing images after generation:', error);
            });
          }

          // Hide the completion message after 4 seconds to allow image refresh
          completionTimeoutRef.current = setTimeout(() => {
            setIsGenerating(false); // Now hide the notification
            setShowCompletionMessage(false);
            setGenerationMessage("Images Generating..."); // Reset message
            completionTimeoutRef.current = null;
          }, 4000);
        } else if (isCurrentlyGenerating) {
          // Track when generation started for timeout purposes
          if (generatingStartTimeRef.current === null) {
            generatingStartTimeRef.current = Date.now();
            hasShownCompletionRef.current = false; // Reset completion flag when new generation starts
          }

          // Check if generation has been running too long (15 minutes)
          const generationDuration = Date.now() - generatingStartTimeRef.current;
          if (generationDuration > 15 * 60 * 1000) {
            console.log('TabNavigator: Generation timeout detected, forcing clear');
            setIsGenerating(false);
            setShowCompletionMessage(false);
            generatingStartTimeRef.current = null;
            hasShownCompletionRef.current = false;
          } else {
            setIsGenerating(true);
            setShowCompletionMessage(false);
            setGenerationMessage("Images Generating...");
          }
        } else {
          // Not generating and not showing completion - ensure notification is hidden
          console.log('TabNavigator: Not generating, hiding notification');
          setIsGenerating(false);
          setShowCompletionMessage(false);
          generatingStartTimeRef.current = null; // Reset generation start time
        }

        previousGeneratingRef.current = isCurrentlyGenerating;
      } catch (error) {
        console.error('TabNavigator: Error checking generation status:', error);
        // If there's an error checking status, clear the generating state to avoid stuck notifications
        setIsGenerating(false);
        setShowCompletionMessage(false);
        if (completionTimeoutRef.current) {
          clearTimeout(completionTimeoutRef.current);
          completionTimeoutRef.current = null;
        }
      }
    };

    // Check immediately on mount
    checkStatus();

    // Poll every 3 seconds to catch generation status changes more quickly
    console.log('TabNavigator: Starting generation status polling (every 3 seconds)');
    const interval = setInterval(checkStatus, 3000);

    return () => {
      console.log('TabNavigator: Clearing generation status polling interval');
      clearInterval(interval);
      // Clear any pending completion timeout on unmount
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    };
  }, []); // Run once on mount, then poll continuously

  // Update images when existingImages prop changes
  React.useEffect(() => {
    console.log('TabNavigator: Updating images, count:', existingImages.length);
    console.log('TabNavigator: Selected photos in existingImages:', existingImages.filter(img => img.selectedProfileOrder).length);
    setImages(existingImages);
  }, [existingImages]);

  const handleRefresh = React.useCallback(async () => {
    if (onRefreshImages) {
      try {
        const newImages = await onRefreshImages();
        setImages(newImages);
        return; // Let the refresh control handle the animation
      } catch (error) {
        console.error('Error refreshing images:', error);
        throw error; // Let ProfileViewScreen handle the error
      }
    }
  }, [onRefreshImages]);

  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
      }}
    >
      <ProfileStack.Screen
        name="ProfileView"
        options={{ headerShown: false }}
      >
        {({ navigation }) => (
          <ProfileScreen
            generatedPhotos={images}
            selectedScenarios={Array.from(new Set(images.map(img => img.scenario)))}
            onGenerateAgain={() => onRegenerateFlow(navigation)}
            onRefresh={handleRefresh}
            isGenerating={isGenerating}
            generationMessage={generationMessage}
            hasNewGeneratedPhotos={hasNewGeneratedPhotos}
            onNewPhotosViewed={() => setHasNewGeneratedPhotos(false)}
          />
        )}
      </ProfileStack.Screen>

      <ProfileStack.Screen
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
      </ProfileStack.Screen>

      <ProfileStack.Screen
        name="ScenarioSelection"
        options={{ headerShown: false }}
      >
        {({ navigation, route }) => (
          <ScenarioSelectionScreen
            photos={route.params.imageIds || []}
            navigation={navigation}
            onNext={async (selectedScenarios) => {
              try {
                const paymentResponse = await checkPaymentAccess();

                if (paymentResponse?.result?.data?.hasUnredeemedPayment) {
                  navigation.navigate('Loading', {
                    selectedScenarios,
                    imageIds: route.params.imageIds,
                    paymentId: paymentResponse.result.data.paymentId,
                    isRegenerateFlow: true,
                  });
                } else {
                  navigation.navigate('Paywall', {
                    selectedScenarios,
                    imageIds: route.params.imageIds,
                  });
                }
              } catch (error) {
                console.error('Error checking payment in scenario selection:', error);
                navigation.navigate('Paywall', {
                  selectedScenarios,
                  imageIds: route.params.imageIds,
                });
              }
            }}
          />
        )}
      </ProfileStack.Screen>

      <ProfileStack.Screen
        name="Paywall"
        options={{ headerShown: false }}
      >
        {({ navigation, route }) => (
          <PaywallScreen
            selectedScenarios={route.params.selectedScenarios}
            photoCount={route.params.imageIds.length}
            navigation={navigation}
            onPaymentSuccess={(paymentId) => {
              navigation.navigate('Loading', {
                selectedScenarios: route.params.selectedScenarios,
                imageIds: route.params.imageIds,
                paymentId,
                isRegenerateFlow: true,
              });
            }}
            onPaymentCancel={() => {
              navigation.goBack();
            }}
          />
        )}
      </ProfileStack.Screen>

      <ProfileStack.Screen
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
            isRegenerateFlow={route.params.isRegenerateFlow}
            onComplete={async (generatedImages) => {
              // Convert and set the new images, preserving the selectedProfileOrder
              let finalPhotos = generatedImages.map((img: any) => ({
                id: img.id,
                uri: img.downloadUrl || img.s3Url,
                scenario: img.scenario,
                downloadUrl: img.downloadUrl,
                selectedProfileOrder: img.selectedProfileOrder || null,
              }));

              // Auto-select 6 best photos if no photos are already selected
              const hasSelectedPhotos = generatedImages.some((img: any) => img.selectedProfileOrder !== null);

              if (!hasSelectedPhotos && generatedImages.length > 0) {
                console.log('Auto-selecting 6 profile photos...');

                try {
                  // Get photos from different scenarios for variety
                  const photosByScenario = generatedImages.reduce((acc: any, img: any) => {
                    if (!acc[img.scenario]) acc[img.scenario] = [];
                    acc[img.scenario].push(img);
                    return acc;
                  }, {});

                  // Select photos trying to get variety across scenarios
                  const selectedPhotos: any[] = [];
                  const scenarios = Object.keys(photosByScenario);

                  // First pass: select one photo from each scenario (up to 6)
                  for (let i = 0; i < Math.min(6, scenarios.length); i++) {
                    const scenarioPhotos = photosByScenario[scenarios[i]];
                    if (scenarioPhotos.length > 0) {
                      selectedPhotos.push(scenarioPhotos[0]);
                    }
                  }

                  // Second pass: fill remaining slots with any photos
                  while (selectedPhotos.length < 6 && selectedPhotos.length < generatedImages.length) {
                    for (const scenario of scenarios) {
                      if (selectedPhotos.length >= 6) break;
                      const scenarioPhotos = photosByScenario[scenario];
                      for (const photo of scenarioPhotos) {
                        if (!selectedPhotos.find(p => p.id === photo.id)) {
                          selectedPhotos.push(photo);
                          if (selectedPhotos.length >= 6) break;
                        }
                      }
                    }
                  }

                  // Create selections array with order
                  const selections = selectedPhotos.slice(0, 6).map((photo, index) => ({
                    generatedImageId: photo.id,
                    order: index + 1
                  }));

                  // Call API to set selected photos
                  await setSelectedProfilePhotos(selections);
                  console.log(`Auto-selected ${selections.length} profile photos`);

                  // Wait a moment for the backend to process
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // Fetch the updated images with selectedProfileOrder from the backend
                  const updatedImagesResponse = await getGeneratedImages({});
                  const updatedImages = updatedImagesResponse?.result?.data || updatedImagesResponse?.data || [];

                  // Convert to the expected format with selectedProfileOrder from backend
                  finalPhotos = updatedImages.map((img: any) => ({
                    id: img.id,
                    uri: img.downloadUrl || img.s3Url,
                    scenario: img.scenario,
                    downloadUrl: img.downloadUrl,
                    selectedProfileOrder: img.selectedProfileOrder || null,
                  }));

                  console.log('TabNavigator: Updated photos with selectedProfileOrder from backend:',
                    finalPhotos.filter(p => p.selectedProfileOrder).length, 'selected out of', finalPhotos.length);
                } catch (error) {
                  console.error('Failed to auto-select photos:', error);
                  // Continue with original photos if auto-selection fails
                }
              }

              // Update the images in ProfileStackNavigator state
              setImages(finalPhotos);

              // Navigate back to ProfileView - the ProfileScreen will automatically load the selected photos
              navigation.reset({
                index: 0,
                routes: [{
                  name: 'ProfileView',
                  params: {
                    generatedPhotos: finalPhotos,
                    selectedScenarios: Array.from(new Set(generatedImages.map((img: any) => img.scenario))),
                  }
                }],
              });
            }}
          />
        )}
      </ProfileStack.Screen>
    </ProfileStack.Navigator>
  );
}

interface TabNavigatorProps {
  existingImages: GeneratedPhoto[];
  onRegenerateFlow: (navigation: any) => void;
  onImagesUpdated?: (images: GeneratedPhoto[]) => void;
  onRefreshImages?: () => Promise<GeneratedPhoto[]>;
}

export function TabNavigator({ existingImages, onRegenerateFlow, onRefreshImages }: TabNavigatorProps) {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none', // Temporarily hide the bottom tab bar
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      >
        {() => (
          <ProfileStackNavigator
            existingImages={existingImages}
            onRegenerateFlow={onRegenerateFlow}
            onRefreshImages={onRefreshImages}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}