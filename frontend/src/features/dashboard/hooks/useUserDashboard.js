import { useQuery } from '@tanstack/react-query';
import { getMyDashboard } from '../../../api/userDashboardApi.js';

export function useUserDashboard() {
  return useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: getMyDashboard,
  });
}
