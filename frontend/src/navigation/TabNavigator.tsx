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
import { checkPaymentAccess, getGeneratedImages } from '../services/api';

interface GeneratedPhoto {
  id: string;
  uri: string;
  scenario: string;
  downloadUrl?: string;
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
  Loading: { selectedScenarios: string[]; imageIds: string[]; paymentId?: string };
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

  // Update images when existingImages prop changes
  React.useEffect(() => {
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
            onComplete={async (generatedImages) => {
              // Convert and set the new images
              const newPhotos = generatedImages.map((img: any) => ({
                id: img.id,
                uri: img.downloadUrl || img.s3Url,
                scenario: img.scenario,
                downloadUrl: img.downloadUrl,
              }));

              // Update the images in ProfileStackNavigator state
              setImages(newPhotos);

              // Navigate back to ProfileView
              navigation.reset({
                index: 0,
                routes: [{
                  name: 'ProfileView',
                  params: {
                    generatedPhotos: newPhotos,
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