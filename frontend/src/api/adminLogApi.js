import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getAdminLogs(params) {
  const response = await axiosClient.get('/admin/audit-logs', { params });
  return unwrapApiResponse(response);
}
