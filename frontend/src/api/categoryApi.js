import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getCategories(params = { activeOnly: true }) {
  const response = await axiosClient.get('/categories', { params });
  return unwrapApiResponse(response);
}
