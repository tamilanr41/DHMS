import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useClinic() {
  return useQuery({
    queryKey: ['clinic'],
    queryFn: async () => (await api.get('/clinic')).data,
    staleTime: 5 * 60_000
  });
}

export function useBrandImage(kind) {
  const clinic = useClinic();
  const fileName = kind === 'logo' ? clinic.data?.logoPath : clinic.data?.dentistSignaturePath;
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    if (!fileName) {
      setUrl(null);
      return undefined;
    }
    api
      .blob(`/clinic/files/${kind}?v=${encodeURIComponent(fileName)}`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName, kind]);

  return url;
}

export function useDentists() {
  return useQuery({
    queryKey: ['dentists'],
    queryFn: async () => (await api.get('/users/dentists')).data,
    staleTime: 5 * 60_000
  });
}
