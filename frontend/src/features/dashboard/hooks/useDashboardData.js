import { useQuery } from '@tanstack/react-query';
import {
  getAccessStats,
  getDashboardSummary,
  getRecentUploads,
  getStorageStats,
  getSystemAccess,
  getTopDocuments,
  getTopSearchKeywords,
} from '../../../api/dashboardApi.js';

export function useDashboardData(params = {}) {
  const { dateFrom, dateTo, granularity = 'day' } = params;
  const queryParams = { dateFrom, dateTo, granularity };

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', queryParams],
    queryFn: () => getDashboardSummary({ dateFrom, dateTo }),
  });

  const storageQuery = useQuery({
    queryKey: ['dashboard', 'storage'],
    queryFn: getStorageStats,
  });

  const accessStatsQuery = useQuery({
    queryKey: ['dashboard', 'access-stats', queryParams],
    queryFn: () => getAccessStats(queryParams),
  });

  const systemAccessQuery = useQuery({
    queryKey: ['dashboard', 'system-access', queryParams],
    queryFn: () => getSystemAccess(queryParams),
  });

  const topDocumentsQuery = useQuery({
    queryKey: ['dashboard', 'top-documents', dateFrom, dateTo],
    queryFn: () => getTopDocuments({ metric: 'view', dateFrom, dateTo, limit: 5 }),
  });

  const recentUploadsQuery = useQuery({
    queryKey: ['dashboard', 'recent-uploads'],
    queryFn: () => getRecentUploads({ page: 0, size: 5 }),
  });

  const topSearchKeywordsQuery = useQuery({
    queryKey: ['dashboard', 'top-search-keywords', dateFrom, dateTo],
    queryFn: () => getTopSearchKeywords({ dateFrom, dateTo, limit: 5 }),
  });

  const queries = [summaryQuery, storageQuery, accessStatsQuery, systemAccessQuery, topDocumentsQuery, recentUploadsQuery, topSearchKeywordsQuery];

  return {
    summaryQuery,
    storageQuery,
    accessStatsQuery,
    systemAccessQuery,
    topDocumentsQuery,
    recentUploadsQuery,
    topSearchKeywordsQuery,
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    refetch: () => queries.forEach((query) => query.refetch()),
  };
}
