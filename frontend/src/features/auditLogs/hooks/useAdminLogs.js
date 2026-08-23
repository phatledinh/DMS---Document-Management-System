import { useQuery } from '@tanstack/react-query';
import { getAdminLogs } from '../../../api/adminLogApi.js';

export function useAdminLogs(params) {
  return useQuery({
    queryKey: ['admin-logs', params],
    queryFn: () => getAdminLogs(params),
    keepPreviousData: true,
  });
}
