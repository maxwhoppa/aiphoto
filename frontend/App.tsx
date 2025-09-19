import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { TRPCProvider } from './src/utils/TRPCProvider';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Test change to verify git tracking
  return (
    <Provider store={store}>
      <TRPCProvider>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="light" />
        </AuthProvider>
      </TRPCProvider>
    </Provider>
  );
}
