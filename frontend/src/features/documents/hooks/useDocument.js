import { useQuery } from '@tanstack/react-query';
import { getDocumentById } from '../../../api/documentApi.js';

export function useDocument(id) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => getDocumentById(id),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 5000 : false),
  });
}
