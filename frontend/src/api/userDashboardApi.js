import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getMyDashboard() {
  const response = await axiosClient.get('/me/dashboard');
  return unwrapApiResponse(response);
}

export async function getMyActivityHistory(params) {
  const response = await axiosClient.get('/me/activity-history', { params });
  return unwrapApiResponse(response);
}

export async function getMyDocumentVersions(params) {
  const response = await axiosClient.get('/me/document-versions', { params });
  return unwrapApiResponse(response);
}
