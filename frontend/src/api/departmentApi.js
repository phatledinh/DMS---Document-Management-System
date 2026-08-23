import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getDepartments(params) {
  const response = await axiosClient.get('/departments', { params });
  return unwrapApiResponse(response);
}

export async function getDepartmentById(id) {
  const response = await axiosClient.get(`/departments/${id}`);
  return unwrapApiResponse(response);
}

export async function createDepartment(data) {
  const response = await axiosClient.post('/departments', data);
  return unwrapApiResponse(response);
}

export async function updateDepartment(id, data) {
  const response = await axiosClient.put(`/departments/${id}`, data);
  return unwrapApiResponse(response);
}

export async function deleteDepartment(id) {
  const response = await axiosClient.delete(`/departments/${id}`);
  return unwrapApiResponse(response);
}
