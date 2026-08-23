import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveDocument,
  deleteDocument,
  getTrashDocuments,
  permanentDeleteTrashDocuments,
  restoreDocument,
  restoreTrashDocuments,
  retryDocumentIndexing,
} from '../../../api/documentApi.js';

function invalidateDocuments(queryClient, documentId) {
  queryClient.invalidateQueries({ queryKey: ['documents'] });
  queryClient.invalidateQueries({ queryKey: ['document-trash'] });
  queryClient.invalidateQueries({ queryKey: ['processing-errors'] });
  if (documentId) {
    queryClient.invalidateQueries({ queryKey: ['documents', String(documentId)] });
    queryClient.invalidateQueries({ queryKey: ['documents', documentId] });
  }
}

export function useTrashDocuments(params) {
  return useQuery({
    queryKey: ['document-trash', params],
    queryFn: () => getTrashDocuments(params),
  });
}

export function useArchiveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveDocument,
    onSuccess: (_, documentId) => invalidateDocuments(queryClient, documentId),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_, documentId) => invalidateDocuments(queryClient, documentId),
  });
}

export function useRestoreDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreDocument,
    onSuccess: (_, documentId) => invalidateDocuments(queryClient, documentId),
  });
}

export function useRetryDocumentIndexing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryDocumentIndexing,
    onSuccess: (_, documentId) => invalidateDocuments(queryClient, documentId),
  });
}

export function useRestoreTrashDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreTrashDocuments,
    onSuccess: () => invalidateDocuments(queryClient),
  });
}

export function usePermanentDeleteTrashDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: permanentDeleteTrashDocuments,
    onSuccess: () => invalidateDocuments(queryClient),
  });
}
