import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getCategories(params = { activeOnly: true }) {
  const response = await axiosClient.get('/categories', { params });
  return unwrapApiResponse(response);
}

export async function getCategoryById(id) {
  const response = await axiosClient.get(`/categories/${id}`);
  return unwrapApiResponse(response);
}

export async function createCategory(data) {
  const response = await axiosClient.post('/categories', data);
  return unwrapApiResponse(response);
}

export async function updateCategory(id, data) {
  const response = await axiosClient.put(`/categories/${id}`, data);
  return unwrapApiResponse(response);
}

export async function deleteCategory(id) {
  const response = await axiosClient.delete(`/categories/${id}`);
  return unwrapApiResponse(response);
}
