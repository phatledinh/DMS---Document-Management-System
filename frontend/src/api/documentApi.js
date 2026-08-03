import axios from 'axios';
import axiosClient from './axiosClient.js';
import { unwrapApiResponse } from '../utils/response.js';

export async function getDocuments(params) {
  const response = await axiosClient.get('/documents', { params });
  return unwrapApiResponse(response);
}

export async function getDocumentById(id) {
  const response = await axiosClient.get(`/documents/${id}`);
  return unwrapApiResponse(response);
}

export async function initUpload(payload) {
  const response = await axiosClient.post('/documents/upload-init', payload);
  return unwrapApiResponse(response);
}

export async function completeUpload(documentId) {
  const response = await axiosClient.post(`/documents/${documentId}/upload-complete`);
  return unwrapApiResponse(response);
}

export async function uploadToPresignedUrl({ uploadUrl, file, requiredHeaders = {}, onUploadProgress }) {
  await axios.put(uploadUrl, file, {
    headers: requiredHeaders,
    onUploadProgress,
  });
}

export async function getPreviewUrl(documentId) {
  const response = await axiosClient.get(`/documents/${documentId}/preview-url`);
  return unwrapApiResponse(response);
}

export async function getDownloadUrl(documentId) {
  const response = await axiosClient.get(`/documents/${documentId}/download-url`);
  return unwrapApiResponse(response);
}
