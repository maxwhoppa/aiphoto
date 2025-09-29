// Polyfills MUST be imported before anything else
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Fix for BigInt in web environments
if (typeof global !== 'undefined' && typeof global.BigInt === 'undefined') {
  const BigInteger = require('big-integer');
  global.BigInt = BigInteger;
}

// Global shims for amazon-cognito-identity-js
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
