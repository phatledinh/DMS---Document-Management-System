import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getCurrentUser() {
  const response = await axiosClient.get('/users/me');
  return unwrapApiResponse(response);
}
