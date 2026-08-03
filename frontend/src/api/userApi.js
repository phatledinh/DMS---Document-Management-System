import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getCurrentUser() {
  const response = await axiosClient.get('/users/me');
  return unwrapApiResponse(response);
}

export async function getUsers(params) {
  const response = await axiosClient.get('/users', { params });
  return unwrapApiResponse(response);
}

export async function createUser(payload) {
  const response = await axiosClient.post('/users', payload);
  return unwrapApiResponse(response);
}
