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

export async function approveDocument(documentId) {
  const response = await axiosClient.post(`/admin/approvals/${documentId}/approve`);
  return unwrapApiResponse(response);
}

export async function rejectDocument(documentId, reason) {
  const response = await axiosClient.post(`/admin/approvals/${documentId}/reject`, { reason });
  return unwrapApiResponse(response);
}
