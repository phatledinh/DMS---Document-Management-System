import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function login(payload) {
  const response = await axiosClient.post('/auth/login', payload);
  return unwrapApiResponse(response);
}

export async function refresh() {
  const response = await axiosClient.post('/auth/refresh');
  return unwrapApiResponse(response);
}

export async function logout() {
  const response = await axiosClient.post('/auth/logout');
  return unwrapApiResponse(response);
}
