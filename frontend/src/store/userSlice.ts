import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User, Purchase, GenerationHistory } from '@/types';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  purchases: Purchase[];
  generationHistory: GenerationHistory[];
}

const initialState: UserState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  purchases: [],
  generationHistory: [],
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    addPurchase: (state, action: PayloadAction<Purchase>) => {
      state.purchases.push(action.payload);
    },
    addGenerationHistory: (state, action: PayloadAction<GenerationHistory>) => {
      state.generationHistory.push(action.payload);
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.purchases = [];
      state.generationHistory = [];
      state.error = null;
    },
  },
});

export const {
  setUser,
  setLoading,
  setError,
  clearError,
  addPurchase,
  addGenerationHistory,
  logout,
} = userSlice.actions;

export default userSlice.reducer;