import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeUpload, initUpload, uploadToPresignedUrl } from '../../../api/documentApi.js';

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ payload, file, onProgress, onStepChange }) => {
      onStepChange?.('initializing');
      const initResponse = await initUpload(payload);
      const documentId = initResponse.documentId || initResponse.id;

      onStepChange?.('uploading');
      await uploadToPresignedUrl({
        uploadUrl: initResponse.uploadUrl,
        file,
        requiredHeaders: initResponse.requiredHeaders,
        onUploadProgress: (event) => {
          if (!event.total) return;
          onProgress?.(Math.round((event.loaded * 100) / event.total));
        },
      });

      onStepChange?.('completing');
      const completeResponse = await completeUpload(documentId);
      return { ...completeResponse, documentId, status: completeResponse?.status || 'PROCESSING' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-search'] });
    },
  });
}
