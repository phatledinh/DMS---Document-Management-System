import { useQuery } from '@tanstack/react-query';
import { getMyDocumentVersions } from '../../../api/userDashboardApi.js';

export function useMyDocumentVersions(params) {
  return useQuery({
    queryKey: ['me', 'document-versions', params],
    queryFn: () => getMyDocumentVersions(params),
    keepPreviousData: true,
  });
}
