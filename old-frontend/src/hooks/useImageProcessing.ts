import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/utils/trpc';
import type { JobStatus, ProcessImageResponse } from '@/types/api';

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  jobId: string | null;
  result: JobStatus | null;
}

export const useImageProcessing = () => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    error: null,
    jobId: null,
    result: null,
  });

  const processImageMutation = trpc.images.processImage.useMutation();
  const { data: jobStatus, refetch: refetchJobStatus } = trpc.images.getJobStatus.useQuery(
    { jobId: state.jobId! },
    { 
      enabled: !!state.jobId && state.isProcessing,
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );

  const pollTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (jobStatus) {
      setState(prev => ({ ...prev, result: jobStatus }));

      if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
        setState(prev => ({ 
          ...prev, 
          isProcessing: false,
          progress: jobStatus.status === 'completed' ? 100 : 0,
          error: jobStatus.status === 'failed' ? jobStatus.data.errorMessage || 'Processing failed' : null,
        }));
      } else {
        // Update progress based on status
        const progressMap = {
          pending: 20,
          processing: 60,
        };
        setState(prev => ({ 
          ...prev, 
          progress: progressMap[jobStatus.status as keyof typeof progressMap] || prev.progress 
        }));
      }
    }
  }, [jobStatus]);

  const processImage = async (imageId: string, prompt: string): Promise<void> => {
    try {
      setState({
        isProcessing: true,
        progress: 10,
        error: null,
        jobId: null,
        result: null,
      });

      const result = await processImageMutation.mutateAsync({
        imageId,
        prompt,
      });

      setState(prev => ({
        ...prev,
        jobId: result.jobId,
        progress: 15,
      }));

      // Start polling for status
      pollTimeoutRef.current = setTimeout(() => {
        refetchJobStatus();
      }, 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
        progress: 0,
      }));
    }
  };

  const processMultipleImages = async (
    requests: Array<{ imageId: string; prompt: string }>
  ): Promise<void> => {
    try {
      setState({
        isProcessing: true,
        progress: 0,
        error: null,
        jobId: null,
        result: null,
      });

      const jobs: string[] = [];
      
      // Start all processing jobs
      for (let i = 0; i < requests.length; i++) {
        const { imageId, prompt } = requests[i];
        const result = await processImageMutation.mutateAsync({ imageId, prompt });
        jobs.push(result.jobId);
        
        setState(prev => ({
          ...prev,
          progress: Math.round(((i + 1) / requests.length) * 30), // 30% for starting jobs
        }));
      }

      // TODO: Implement batch status checking for multiple jobs
      // For now, just process the first one
      if (jobs.length > 0) {
        setState(prev => ({ ...prev, jobId: jobs[0] }));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
        progress: 0,
      }));
    }
  };

  const resetState = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    setState({
      isProcessing: false,
      progress: 0,
      error: null,
      jobId: null,
      result: null,
    });
  };

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  return {
    processImage,
    processMultipleImages,
    resetState,
    isProcessing: state.isProcessing,
    progress: state.progress,
    error: state.error,
    result: state.result,
    jobId: state.jobId,
  };
};