import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getDashboardSummary(params) {
  const response = await axiosClient.get('/admin/dashboard/summary', { params });
  return unwrapApiResponse(response);
}

export async function getStorageStats() {
  const response = await axiosClient.get('/admin/dashboard/storage');
  return unwrapApiResponse(response);
}

export async function getAccessStats(params) {
  const response = await axiosClient.get('/admin/dashboard/access-stats', { params });
  return unwrapApiResponse(response);
}

export async function getTopDocuments(params) {
  const response = await axiosClient.get('/admin/dashboard/top-documents', { params });
  return unwrapApiResponse(response);
}

export async function getRecentUploads(params) {
  const response = await axiosClient.get('/admin/dashboard/recent-uploads', { params });
  return unwrapApiResponse(response);
}

export async function getTopSearchKeywords(params) {
  const response = await axiosClient.get('/admin/dashboard/top-search-keywords', { params });
  return unwrapApiResponse(response);
}

export async function getSystemAccess(params) {
  const response = await axiosClient.get('/admin/dashboard/system-access', { params });
  return unwrapApiResponse(response);
}

export async function getProcessingErrors(params) {
  const response = await axiosClient.get('/admin/dashboard/processing-errors', { params });
  return unwrapApiResponse(response);
}
