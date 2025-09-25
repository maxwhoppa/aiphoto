import type { Photo, Scenario } from './index';

export type RootStackParamList = {
  Landing: undefined;
  PhotoUpload: undefined;
  ScenarioSelection: {
    photos: Photo[];
    uploadedImageIds?: string[];
    suggestions?: string[];
  };
  Loading: {
    photos: Photo[];
    scenarios: Scenario[];
  };
  PreviewGallery: {
    photos: Photo[];
    scenarios: Scenario[];
  };
  Paywall: {
    photos: Photo[];
  };
  PhotoCuration: {
    photos: Photo[];
  };
  FinalGallery: {
    selectedPhotos: Photo[];
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}