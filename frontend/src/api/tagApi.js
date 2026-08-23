import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getTags(params) {
  const response = await axiosClient.get('/tags', { params });
  return unwrapApiResponse(response);
}

export async function getTagById(id) {
  const response = await axiosClient.get(`/tags/${id}`);
  return unwrapApiResponse(response);
}

export async function createTag(data) {
  const response = await axiosClient.post('/tags', data);
  return unwrapApiResponse(response);
}

export async function updateTag(id, data) {
  const response = await axiosClient.put(`/tags/${id}`, data);
  return unwrapApiResponse(response);
}

export async function deleteTag(id) {
  const response = await axiosClient.delete(`/tags/${id}`);
  return unwrapApiResponse(response);
}
