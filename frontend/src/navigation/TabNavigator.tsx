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

  // Check generation status on mount and periodically
  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        console.log('TabNavigator: Checking generation status...');
        const statusResponse = await checkGenerationStatus();
        const generationData = statusResponse?.result?.data || statusResponse?.data || statusResponse;
        console.log('TabNavigator: Generation status response:', generationData);
        const isCurrentlyGenerating = generationData?.isGenerating || false;
        console.log('TabNavigator: Setting isGenerating to:', isCurrentlyGenerating);
        setIsGenerating(isCurrentlyGenerating);
      } catch (error) {
        console.error('TabNavigator: Error checking generation status:', error);
        setIsGenerating(false);
      }
    };

    // Check immediately on mount
    checkStatus();

    // Always poll every 5 seconds to catch generation status changes
    console.log('TabNavigator: Starting generation status polling');
    const interval = setInterval(checkStatus, 5000);

    return () => {
      console.log('TabNavigator: Clearing generation status polling interval');
      clearInterval(interval);
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

                  // Update the photos with their selected orders
                  finalPhotos = finalPhotos.map(photo => {
                    const selection = selections.find(s => s.generatedImageId === photo.id);
                    return {
                      ...photo,
                      selectedProfileOrder: selection ? selection.order : null
                    };
                  });
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