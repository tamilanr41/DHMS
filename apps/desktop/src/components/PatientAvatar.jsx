import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { api } from '../services/api.js';
import { initials } from '../utils/format.js';

/**
 * Patient avatar. Fetches the protected profile photo with the auth token and
 * renders it as a data URL so the image works inside <img> tags. Falls back to
 * initials (or an icon) when no photo has been uploaded.
 */
export default function PatientAvatar({
  patient,
  size = 40,
  className = '',
  ring = true,
  rounded = 'rounded-full',
  fallbackIcon = false
}) {
  const id = patient?.id || patient?.patientId || (typeof patient === 'string' ? patient : null);
  const name = patient?.fullName || patient?.patientName || '';
  const enabled = Boolean(id && (patient?.hasPhoto !== false));

  const { data: photo } = useQuery({
    queryKey: ['patient-photo', id],
    queryFn: async () => {
      const blob = await api.blob(`/patients/${id}/photo`);
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0
  });

  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) };
  const shape = `${rounded} shrink-0 object-cover`;

  if (enabled && photo) {
    return (
      <img
        src={photo}
        alt={name || 'Patient'}
        style={style}
        className={`${shape} ${ring ? 'ring-1 ring-line' : ''} ${className}`}
      />
    );
  }

  return (
    <span
      style={style}
      aria-hidden="true"
      className={`flex items-center justify-center bg-gradient-to-br from-navy-100 to-aqua-100 font-semibold text-navy-700 ${rounded} ${ring ? 'ring-1 ring-inset ring-white' : ''} ${className}`}
    >
      {fallbackIcon ? <UserRound size={Math.round(size * 0.45)} strokeWidth={1.6} /> : initials(name)}
    </span>
  );
}
