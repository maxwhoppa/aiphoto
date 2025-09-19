import { configureStore } from '@reduxjs/toolkit';
import photosReducer from './photosSlice';
import userReducer from './userSlice';

export const store = configureStore({
  reducer: {
    photos: photosReducer,
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['photos/setUserPhotos', 'photos/setGeneratedPhotos'],
        ignoredPaths: ['photos.userPhotos', 'photos.generatedPhotos'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;