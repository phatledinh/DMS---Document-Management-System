import { useQuery } from '@tanstack/react-query';
import {
  getSystemAccess,
  getTopDocuments,
  getTopSearchKeywords,
} from '../../../api/dashboardApi.js';

export function useSearchAccessAnalytics(params = {}) {
  const { dateFrom, dateTo, granularity = 'day', limit = 5 } = params;
  const queryParams = { dateFrom, dateTo, granularity };

  const systemAccessQuery = useQuery({
    queryKey: ['analytics', 'system-access', queryParams],
    queryFn: () => getSystemAccess({ ...queryParams, limit }),
  });

  const topDocumentsQuery = useQuery({
    queryKey: ['analytics', 'top-documents', dateFrom, dateTo, limit],
    queryFn: () => getTopDocuments({ metric: 'view', dateFrom, dateTo, limit }),
  });

  const topSearchKeywordsQuery = useQuery({
    queryKey: ['analytics', 'top-search-keywords', dateFrom, dateTo, limit],
    queryFn: () => getTopSearchKeywords({ dateFrom, dateTo, limit }),
  });

  const queries = [systemAccessQuery, topDocumentsQuery, topSearchKeywordsQuery];

  return {
    systemAccessQuery,
    topDocumentsQuery,
    topSearchKeywordsQuery,
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error,
    refetch: () => queries.forEach((query) => query.refetch()),
  };
}
