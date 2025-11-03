import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_VIEWED_COUNT_KEY = 'last_viewed_photo_count';

export const getLastViewedPhotoCount = async (): Promise<number> => {
  try {
    const count = await AsyncStorage.getItem(LAST_VIEWED_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Error getting last viewed photo count:', error);
    return 0;
  }
};

export const setLastViewedPhotoCount = async (count: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_VIEWED_COUNT_KEY, count.toString());
  } catch (error) {
    console.error('Error setting last viewed photo count:', error);
  }
};

export const hasNewPhotos = async (currentPhotoCount: number): Promise<boolean> => {
  const lastViewedCount = await getLastViewedPhotoCount();
  return currentPhotoCount > lastViewedCount;
};