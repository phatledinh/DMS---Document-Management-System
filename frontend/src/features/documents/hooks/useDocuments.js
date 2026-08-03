import { useQuery } from '@tanstack/react-query';
import { getDocuments } from '../../../api/documentApi.js';

function hasProcessingDocuments(data) {
  const documents = data?.content || data?.items || [];
  return documents.some((document) => document.status === 'PROCESSING');
}

export function useDocuments(params) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => getDocuments(params),
    refetchInterval: (query) => (hasProcessingDocuments(query.state.data) ? 5000 : false),
  });
}
