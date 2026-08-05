import { useQuery } from '@tanstack/react-query';
import { getProcessingErrors } from '../../../api/dashboardApi.js';

export function useProcessingErrors(params) {
  return useQuery({
    queryKey: ['processing-errors', params],
    queryFn: () => getProcessingErrors(params),
    keepPreviousData: true,
  });
}
