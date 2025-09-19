import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types/navigation';

import LandingScreen from '@/screens/LandingScreen';
import PhotoUploadScreen from '@/screens/PhotoUploadScreen';
import ScenarioSelectionScreen from '@/screens/ScenarioSelectionScreen';
import LoadingScreen from '@/screens/LoadingScreen';
import PreviewGalleryScreen from '@/screens/PreviewGalleryScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import PhotoCurationScreen from '@/screens/PhotoCurationScreen';
import FinalGalleryScreen from '@/screens/FinalGalleryScreen';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Landing"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#4A90E2',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Landing" 
          component={LandingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="PhotoUpload" 
          component={PhotoUploadScreen}
          options={{ title: 'Upload Photos' }}
        />
        <Stack.Screen 
          name="ScenarioSelection" 
          component={ScenarioSelectionScreen}
          options={{ title: 'Choose Scenarios' }}
        />
        <Stack.Screen 
          name="Loading" 
          component={LoadingScreen}
          options={{ 
            headerShown: false,
            gestureEnabled: false 
          }}
        />
        <Stack.Screen 
          name="PreviewGallery" 
          component={PreviewGalleryScreen}
          options={{ title: 'Preview' }}
        />
        <Stack.Screen 
          name="Paywall" 
          component={PaywallScreen}
          options={{ title: 'Unlock Full Gallery' }}
        />
        <Stack.Screen 
          name="PhotoCuration" 
          component={PhotoCurationScreen}
          options={{ title: 'Select Favorites' }}
        />
        <Stack.Screen 
          name="FinalGallery" 
          component={FinalGalleryScreen}
          options={{ title: 'Your Gallery' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;