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

export async function batchUploadInit(payload) {
  const response = await axiosClient.post('/documents/batch-upload-init', payload);
  return unwrapApiResponse(response);
}

export async function batchUploadComplete(payload) {
  const response = await axiosClient.post('/documents/batch-upload-complete', payload);
  return unwrapApiResponse(response);
}

export async function batchDeleteDocuments(documentIds) {
  const response = await axiosClient.post('/documents/batch-delete', { documentIds });
  return unwrapApiResponse(response);
}

export async function batchArchiveDocuments(documentIds) {
  const response = await axiosClient.post('/documents/batch-archive', { documentIds });
  return unwrapApiResponse(response);
}

export async function batchMoveDocuments(documentIds, targetCategoryId) {
  const response = await axiosClient.post('/documents/batch-move', { documentIds, targetCategoryId });
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

export async function getDocumentVersions(documentId) {
  const response = await axiosClient.get(`/documents/${documentId}/versions`);
  return unwrapApiResponse(response);
}

export async function initDocumentVersionUpload(documentId, payload) {
  const response = await axiosClient.post(`/documents/${documentId}/versions/init`, payload);
  return unwrapApiResponse(response);
}

export async function completeDocumentVersionUpload(documentId, versionId) {
  const response = await axiosClient.post(`/documents/${documentId}/versions/${versionId}/complete`);
  return unwrapApiResponse(response);
}

export async function getDocumentVersionDownloadUrl(documentId, versionId) {
  const response = await axiosClient.get(`/documents/${documentId}/versions/${versionId}/download-url`);
  return unwrapApiResponse(response);
}

export async function restoreDocumentVersion(documentId, versionId) {
  const response = await axiosClient.post(`/documents/${documentId}/versions/${versionId}/restore`);
  return unwrapApiResponse(response);
}

export async function archiveDocument(documentId) {
  const response = await axiosClient.post(`/documents/${documentId}/archive`);
  return unwrapApiResponse(response);
}

export async function deleteDocument(documentId) {
  const response = await axiosClient.delete(`/documents/${documentId}`);
  return unwrapApiResponse(response);
}

export async function restoreDocument(documentId) {
  const response = await axiosClient.post(`/documents/${documentId}/restore`);
  return unwrapApiResponse(response);
}

export async function retryDocumentIndexing(documentId) {
  const response = await axiosClient.post(`/documents/${documentId}/retry-indexing`);
  return unwrapApiResponse(response);
}

export async function getTrashDocuments(params) {
  const response = await axiosClient.get('/documents/trash', { params });
  return unwrapApiResponse(response);
}

export async function restoreTrashDocuments(documentIds) {
  const response = await axiosClient.post('/documents/trash/restore', { documentIds });
  return unwrapApiResponse(response);
}

export async function permanentDeleteTrashDocuments(documentIds) {
  const response = await axiosClient.post('/documents/trash/permanent-delete', { documentIds });
  return unwrapApiResponse(response);
}

export async function getDocumentVersionPreviewUrl(id, versionId) {
  const response = await axiosClient.get(`/documents/${id}/versions/${versionId}/preview-url`);
  return unwrapApiResponse(response);
}

export async function deleteDocumentVersion(id, versionId) {
  const response = await axiosClient.delete(`/documents/${id}/versions/${versionId}`);
  // Return true on success since it's a 204 No Content
  return response.status === 204;
}
