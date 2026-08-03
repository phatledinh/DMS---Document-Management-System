import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getTags(params) {
  const response = await axiosClient.get('/tags', { params });
  return unwrapApiResponse(response);
}
