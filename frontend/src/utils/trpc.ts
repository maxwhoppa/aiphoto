import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import * as SecureStore from 'expo-secure-store';
import type { AppRouter } from '../../../server/src/routes';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.EXPO_PUBLIC_API_URL 
        ? `${process.env.EXPO_PUBLIC_API_URL}/trpc`
        : 'http://localhost:3000/trpc',
      headers: async () => {
        try {
          const token = await SecureStore.getItemAsync('auth_token');
          return token ? { authorization: `Bearer ${token}` } : {};
        } catch (error) {
          console.error('Error getting auth token:', error);
          return {};
        }
      },
    }),
  ],
});