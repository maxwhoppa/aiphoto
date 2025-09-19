import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import type { UploadPresignedUrlResponse, ConfirmUploadResponse } from '@/types/api';

interface UploadPhoto {
  uri: string;
  fileName: string;
  contentType: string;
}

interface UploadProgress {
  uploading: boolean;
  progress: number;
  error: string | null;
}

export const usePhotoUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    error: null,
  });

  const getUploadUrlMutation = trpc.images.getUploadUrl.useMutation();
  const confirmUploadMutation = trpc.images.confirmUpload.useMutation();

  const uploadPhoto = async (photo: UploadPhoto): Promise<ConfirmUploadResponse> => {
    try {
      setUploadProgress({ uploading: true, progress: 0, error: null });

      // Step 1: Get presigned URL
      setUploadProgress(prev => ({ ...prev, progress: 10 }));
      const uploadData = await getUploadUrlMutation.mutateAsync({
        fileName: photo.fileName,
        contentType: photo.contentType,
      });

      // Step 2: Upload to S3
      setUploadProgress(prev => ({ ...prev, progress: 30 }));
      await uploadToS3(photo, uploadData);

      // Step 3: Get file size
      setUploadProgress(prev => ({ ...prev, progress: 80 }));
      const fileSize = await getFileSize(photo.uri);

      // Step 4: Confirm upload
      const confirmResult = await confirmUploadMutation.mutateAsync({
        s3Key: uploadData.s3Key,
        fileName: photo.fileName,
        contentType: photo.contentType,
        sizeBytes: fileSize.toString(),
      });

      setUploadProgress({ uploading: false, progress: 100, error: null });
      return confirmResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadProgress({ uploading: false, progress: 0, error: errorMessage });
      throw error;
    }
  };

  const uploadToS3 = async (photo: UploadPhoto, uploadData: UploadPresignedUrlResponse) => {
    const formData = new FormData();
    
    // Add all the fields from the presigned URL
    Object.entries(uploadData.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Add the file
    formData.append('file', {
      uri: photo.uri,
      type: photo.contentType,
      name: photo.fileName,
    } as any);

    const response = await fetch(uploadData.uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.statusText}`);
    }
  };

  const getFileSize = async (uri: string): Promise<number> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      // Fallback - estimate from image dimensions or use default
      return 1024 * 1024; // 1MB default
    }
  };

  const uploadMultiplePhotos = async (photos: UploadPhoto[]): Promise<ConfirmUploadResponse[]> => {
    const results: ConfirmUploadResponse[] = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      setUploadProgress(prev => ({ 
        ...prev, 
        progress: Math.round((i / photos.length) * 100) 
      }));
      
      const result = await uploadPhoto(photo);
      results.push(result);
    }
    
    return results;
  };

  return {
    uploadPhoto,
    uploadMultiplePhotos,
    uploadProgress,
    isUploading: uploadProgress.uploading,
  };
};