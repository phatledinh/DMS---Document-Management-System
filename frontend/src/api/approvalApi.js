import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getAdminApprovals(params) {
  const response = await axiosClient.get('/admin/approvals', { params });
  return unwrapApiResponse(response);
}

export async function getAdminApprovalSummary() {
  const response = await axiosClient.get('/admin/approvals/summary');
  return unwrapApiResponse(response);
}

export async function approveDocument(documentId, versionId) {
  const response = await axiosClient.post(`/admin/approvals/${documentId}/versions/${versionId}/approve`);
  return unwrapApiResponse(response);
}

export async function rejectDocument(documentId, versionId, reason) {
  const response = await axiosClient.post(`/admin/approvals/${documentId}/versions/${versionId}/reject`, { reason });
  return unwrapApiResponse(response);
}
