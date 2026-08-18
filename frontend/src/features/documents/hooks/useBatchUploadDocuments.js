import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchUploadComplete, batchUploadInit, getDocumentById, uploadToPresignedUrl } from '../../../api/documentApi.js';

const UPLOAD_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;
const PROCESSING_STATUS = 'PROCESSING';
const READY_STATUS = 'INDEXED';
const FAILED_STATUS = 'EXTRACTION_FAILED';
const TERMINAL_PROCESSING_STATUSES = new Set([READY_STATUS, FAILED_STATUS]);

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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeProcessingStatus(status) {
  if (status === READY_STATUS) return 'indexed';
  if (status === FAILED_STATUS) return 'extraction_failed';
  if (status === PROCESSING_STATUS) return 'processing';
  return status?.toLowerCase() || 'processing';
}

async function waitForProcessingResult(documentId, onStatusChange) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    try {
      const document = await getDocumentById(documentId);
      const status = document?.status;
      onStatusChange?.(document, status);

      if (TERMINAL_PROCESSING_STATUSES.has(status)) {
        return document;
      }
    } catch {
      onStatusChange?.(null, PROCESSING_STATUS);
    }

    await delay(POLL_INTERVAL_MS);
  }

  return null;
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
      const uploadFailures = [];

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
          uploadFailures.push({ clientItemId: item.clientItemId, documentId: item.documentId, error });
          onItemChange?.(item.clientItemId, { status: 'upload_failed', error: error.message });
        }
      });

      const completeResponse = uploadedItems.length
        ? await batchUploadComplete({ items: uploadedItems })
        : { total: 0, succeeded: 0, failed: 0, items: [] };

      const completedItems = completeResponse.items || [];
      completedItems.forEach((item) => {
        onItemChange?.(
          item.clientItemId,
          item.success
            ? { status: 'processing', complete: item, documentCode: item.documentCode, progress: 100 }
            : { status: 'complete_failed', error: item.message, complete: item },
        );
      });

      const pollableItems = completedItems.filter((item) => item.success && item.documentId);
      const processingResults = await runWithConcurrency(pollableItems, async (item) => {
        const document = await waitForProcessingResult(item.documentId, (document, status) => {
          onItemChange?.(item.clientItemId, {
            status: normalizeProcessingStatus(status),
            document,
            documentCode: document?.documentCode || item.documentCode,
            error: status === FAILED_STATUS ? 'Lỗi xử lý/OCR/preview' : undefined,
            progress: TERMINAL_PROCESSING_STATUSES.has(status) ? 100 : 100,
          });
        });

        if (!document) {
          onItemChange?.(item.clientItemId, {
            status: 'processing',
            error: 'Tài liệu vẫn đang xử lý, vui lòng kiểm tra lại trong danh sách tài liệu.',
            progress: 100,
          });
        }

        return { clientItemId: item.clientItemId, document };
      });

      return { init: initResponse, uploadFailures, complete: completeResponse, processingResults };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-search'] });
    },
  });
}
