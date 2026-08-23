import { useQuery } from '@tanstack/react-query';
import { getMyActivityHistory } from '../../../api/userDashboardApi.js';

export function useUserActivityHistory(params) {
  return useQuery({
    queryKey: ['me', 'activity-history', params],
    queryFn: () => getMyActivityHistory(params),
    keepPreviousData: true,
  });
}
