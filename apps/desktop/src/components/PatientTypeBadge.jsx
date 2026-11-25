import { Sparkles, UserCheck } from 'lucide-react';

export default function PatientTypeBadge({ isNew, visitCount = 0, className = '' }) {
  if (isNew || visitCount <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-700/60 shadow-2xs ${className}`}
        title="First-time clinic visit"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>New Patient</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider bg-indigo-50/80 text-indigo-800 ring-1 ring-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-700/60 ${className}`}
      title={`Patient has visited ${visitCount} time${visitCount > 1 ? 's' : ''}`}
    >
      <UserCheck size={11} className="text-indigo-600 dark:text-indigo-400" />
      <span>Visit #{visitCount}</span>
    </span>
  );
}
