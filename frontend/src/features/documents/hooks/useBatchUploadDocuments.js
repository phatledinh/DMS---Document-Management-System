import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchUploadComplete, batchUploadInit, uploadToPresignedUrl } from '../../../api/documentApi.js';

const UPLOAD_CONCURRENCY = 3;

async function runWithConcurrency(items, worker) {
  const results = [];
  let index = 0;

  async function runNext() {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, runNext));
  return results;
}

export function useBatchUploadDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ payload, filesByClientItemId, onItemChange }) => {
      const initResponse = await batchUploadInit(payload);
      const initItems = initResponse.items || [];
      initItems.forEach((item) => {
        onItemChange?.(item.clientItemId, item.success ? { status: 'uploading', init: item } : { status: 'init_failed', error: item.message });
      });

      const uploadableItems = initItems.filter((item) => item.success);
      const uploadedItems = [];

      await runWithConcurrency(uploadableItems, async (item) => {
        const file = filesByClientItemId[item.clientItemId];
        try {
          await uploadToPresignedUrl({
            uploadUrl: item.uploadUrl,
            file,
            requiredHeaders: item.requiredHeaders,
            onUploadProgress: (event) => {
              if (!event.total) return;
              onItemChange?.(item.clientItemId, { status: 'uploading', progress: Math.round((event.loaded * 100) / event.total) });
            },
          });
          uploadedItems.push({ clientItemId: item.clientItemId, documentId: item.documentId });
          onItemChange?.(item.clientItemId, { status: 'completing', progress: 100 });
        } catch (error) {
          onItemChange?.(item.clientItemId, { status: 'upload_failed', error: error.message });
        }
      });

      const completeResponse = uploadedItems.length
        ? await batchUploadComplete({ items: uploadedItems })
        : { total: 0, succeeded: 0, failed: 0, items: [] };

      (completeResponse.items || []).forEach((item) => {
        onItemChange?.(
          item.clientItemId,
          item.success
            ? { status: 'processing', complete: item, progress: 100 }
            : { status: 'complete_failed', error: item.message, complete: item },
        );
      });

      return { init: initResponse, complete: completeResponse };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-search'] });
    },
  });
}
