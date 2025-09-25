import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Photo, Scenario } from '@/types';
import type { UserImage, ProcessingJob } from '@/types/api';

interface PhotosState {
  userPhotos: Photo[];
  selectedScenarios: Scenario[];
  generatedPhotos: Photo[];
  selectedPhotos: string[];
  isGenerating: boolean;
  generationProgress: number;
  isPremiumUnlocked: boolean;
  uploadedImages: UserImage[];
  processingJobs: ProcessingJob[];
  currentJobId: string | null;
}

const initialState: PhotosState = {
  userPhotos: [],
  selectedScenarios: [],
  generatedPhotos: [],
  selectedPhotos: [],
  isGenerating: false,
  generationProgress: 0,
  isPremiumUnlocked: false,
  uploadedImages: [],
  processingJobs: [],
  currentJobId: null,
};

const photosSlice = createSlice({
  name: 'photos',
  initialState,
  reducers: {
    setUserPhotos: (state, action: PayloadAction<Photo[]>) => {
      state.userPhotos = action.payload;
    },
    addUserPhoto: (state, action: PayloadAction<Photo>) => {
      state.userPhotos.push(action.payload);
    },
    removeUserPhoto: (state, action: PayloadAction<string>) => {
      state.userPhotos = state.userPhotos.filter(
        photo => photo.id !== action.payload
      );
    },
    setSelectedScenarios: (state, action: PayloadAction<Scenario[]>) => {
      state.selectedScenarios = action.payload;
    },
    toggleScenario: (state, action: PayloadAction<Scenario>) => {
      const scenario = action.payload;
      if (state.selectedScenarios.includes(scenario)) {
        state.selectedScenarios = state.selectedScenarios.filter(
          s => s !== scenario
        );
      } else {
        state.selectedScenarios.push(scenario);
      }
    },
    setGeneratedPhotos: (state, action: PayloadAction<Photo[]>) => {
      state.generatedPhotos = action.payload;
    },
    addGeneratedPhoto: (state, action: PayloadAction<Photo>) => {
      state.generatedPhotos.push(action.payload);
    },
    setSelectedPhotos: (state, action: PayloadAction<string[]>) => {
      state.selectedPhotos = action.payload;
    },
    toggleSelectedPhoto: (state, action: PayloadAction<string>) => {
      const photoId = action.payload;
      if (state.selectedPhotos.includes(photoId)) {
        state.selectedPhotos = state.selectedPhotos.filter(
          id => id !== photoId
        );
      } else {
        state.selectedPhotos.push(photoId);
      }
    },
    setIsGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload;
    },
    setGenerationProgress: (state, action: PayloadAction<number>) => {
      state.generationProgress = action.payload;
    },
    setPremiumUnlocked: (state, action: PayloadAction<boolean>) => {
      state.isPremiumUnlocked = action.payload;
    },
    resetPhotoState: (state) => {
      return initialState;
    },
    setUploadedImages: (state, action: PayloadAction<UserImage[]>) => {
      state.uploadedImages = action.payload;
    },
    addUploadedImage: (state, action: PayloadAction<UserImage>) => {
      state.uploadedImages.push(action.payload);
    },
    setProcessingJobs: (state, action: PayloadAction<ProcessingJob[]>) => {
      state.processingJobs = action.payload;
    },
    addProcessingJob: (state, action: PayloadAction<ProcessingJob>) => {
      state.processingJobs.push(action.payload);
    },
    updateProcessingJob: (state, action: PayloadAction<{ jobId: string; updates: Partial<ProcessingJob> }>) => {
      const { jobId, updates } = action.payload;
      const jobIndex = state.processingJobs.findIndex(job => job.id === jobId);
      if (jobIndex !== -1) {
        state.processingJobs[jobIndex] = { ...state.processingJobs[jobIndex], ...updates };
      }
    },
    setCurrentJobId: (state, action: PayloadAction<string | null>) => {
      state.currentJobId = action.payload;
    },
  },
});

export const {
  setUserPhotos,
  addUserPhoto,
  removeUserPhoto,
  setSelectedScenarios,
  toggleScenario,
  setGeneratedPhotos,
  addGeneratedPhoto,
  setSelectedPhotos,
  toggleSelectedPhoto,
  setIsGenerating,
  setGenerationProgress,
  setPremiumUnlocked,
  resetPhotoState,
  setUploadedImages,
  addUploadedImage,
  setProcessingJobs,
  addProcessingJob,
  updateProcessingJob,
  setCurrentJobId,
} = photosSlice.actions;

export default photosSlice.reducer;