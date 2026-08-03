import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function searchDocuments(params) {
  const response = await axiosClient.get('/documents/search', { params });
  return unwrapApiResponse(response);
}

export async function getSearchSuggestions(params) {
  const response = await axiosClient.get('/documents/search/suggestions', { params });
  return unwrapApiResponse(response);
}
