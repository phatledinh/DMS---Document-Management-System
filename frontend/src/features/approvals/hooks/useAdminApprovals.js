import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveDocument,
  getAdminApprovalSummary,
  getAdminApprovals,
  rejectDocument,
} from '../../../api/approvalApi.js';

export function useAdminApprovals(params) {
  return useQuery({
    queryKey: ['admin-approvals', params],
    queryFn: () => getAdminApprovals(params),
    keepPreviousData: true,
  });
}

export function useAdminApprovalSummary() {
  return useQuery({
    queryKey: ['admin-approvals', 'summary'],
    queryFn: getAdminApprovalSummary,
  });
}

export function useApproveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, versionId }) => approveDocument(documentId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
  });
}

export function useRejectDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, versionId, reason }) => rejectDocument(documentId, versionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
  });
}
