import { useQuery } from '@tanstack/react-query';
import { searchDocuments, getSearchSuggestions } from '../../../api/searchApi.js';

export function useDocumentSearch(params) {
  return useQuery({
    queryKey: ['documents-search', params],
    queryFn: () => searchDocuments(params),
  });
}

export function useSearchSuggestions(params, enabled) {
  return useQuery({
    queryKey: ['documents-search-suggestions', params],
    queryFn: () => getSearchSuggestions(params),
    enabled,
  });
}
