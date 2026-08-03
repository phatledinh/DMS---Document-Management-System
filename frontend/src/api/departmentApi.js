import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getDepartments(params) {
  const response = await axiosClient.get('/departments', { params });
  return unwrapApiResponse(response);
}
