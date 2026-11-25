import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';

export function useLicenseStatus(options = {}) {
  return useQuery({
    queryKey: ['license-status'],
    queryFn: async () => (await api.get('/license/status')).data,
    staleTime: 10_000,
    refetchInterval: 60_000,
    retry: false,
    ...options
  });
}
