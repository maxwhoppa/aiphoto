import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_VIEWED_COUNT_KEY = 'last_viewed_photo_count';
const VIEWED_PHOTOS_KEY = 'viewed_photo_ids';

export const getLastViewedPhotoCount = async (): Promise<number> => {
  try {
    const count = await AsyncStorage.getItem(LAST_VIEWED_COUNT_KEY);
    const result = count ? parseInt(count, 10) : 0;
    console.log('photoViewTracking: getLastViewedPhotoCount =', result);
    return result;
  } catch (error) {
    console.error('Error getting last viewed photo count:', error);
    return 0;
  }
};

export const setLastViewedPhotoCount = async (count: number): Promise<void> => {
  try {
    console.log('photoViewTracking: setLastViewedPhotoCount =', count);
    await AsyncStorage.setItem(LAST_VIEWED_COUNT_KEY, count.toString());
  } catch (error) {
    console.error('Error setting last viewed photo count:', error);
  }
};

export const hasNewPhotos = async (currentPhotoCount: number): Promise<boolean> => {
  const lastViewedCount = await getLastViewedPhotoCount();
  return currentPhotoCount > lastViewedCount;
};

// New functions for tracking individual photo IDs
export const getViewedPhotoIds = async (): Promise<Set<string>> => {
  try {
    const viewedIds = await AsyncStorage.getItem(VIEWED_PHOTOS_KEY);
    const result = viewedIds ? new Set(JSON.parse(viewedIds)) : new Set();
    console.log('photoViewTracking: getViewedPhotoIds =', result.size, 'photos');
    return result;
  } catch (error) {
    console.error('Error getting viewed photo IDs:', error);
    return new Set();
  }
};

export const setViewedPhotoIds = async (photoIds: Set<string>): Promise<void> => {
  try {
    console.log('photoViewTracking: setViewedPhotoIds =', photoIds.size, 'photos');
    await AsyncStorage.setItem(VIEWED_PHOTOS_KEY, JSON.stringify(Array.from(photoIds)));
  } catch (error) {
    console.error('Error setting viewed photo IDs:', error);
  }
};

export const markPhotoAsViewed = async (photoId: string): Promise<void> => {
  try {
    const viewedIds = await getViewedPhotoIds();
    viewedIds.add(photoId);
    await setViewedPhotoIds(viewedIds);
    console.log('photoViewTracking: marked photo as viewed:', photoId);
  } catch (error) {
    console.error('Error marking photo as viewed:', error);
  }
};

export const markPhotosAsViewed = async (photoIds: string[]): Promise<void> => {
  try {
    const viewedIds = await getViewedPhotoIds();
    photoIds.forEach(id => viewedIds.add(id));
    await setViewedPhotoIds(viewedIds);
    console.log('photoViewTracking: marked photos as viewed:', photoIds.length);
  } catch (error) {
    console.error('Error marking photos as viewed:', error);
  }
};