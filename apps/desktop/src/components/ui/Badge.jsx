import { STATUS_META, humanize } from '../../utils/format.js';

const TONES = {
  neutral: { cls: 'bg-slate-100 text-slate-700 border-slate-200/80', dot: 'bg-slate-400' },
  info: { cls: 'bg-sky-50 text-sky-700 border-sky-200/80', dot: 'bg-sky-500' },
  accent: { cls: 'bg-teal-50 text-teal-800 border-teal-200/80', dot: 'bg-teal-500' },
  success: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  warn: { cls: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500' },
  danger: { cls: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  aqua: { cls: 'bg-cyan-50 text-cyan-800 border-cyan-200/80', dot: 'bg-cyan-500' }
};

export default function Badge({ status, children, tone, className = '', dot }) {
  const meta = STATUS_META[status];
  const finalTone = tone || meta?.tone || 'neutral';
  const palette = TONES[finalTone] || TONES.neutral;
  const showDot = dot ?? Boolean(meta);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold leading-tight shadow-xs ${palette.cls} ${className}`}>
      {showDot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} />}
      {children ?? meta?.label ?? humanize(status)}
    </span>
  );
}

export function CountPill({ children, tone = 'neutral', className = '' }) {
  const palette = TONES[tone] || TONES.neutral;
  return <span className={`inline-flex min-w-5 items-center justify-center rounded-full border px-2 py-0.5 text-[10.5px] font-black leading-tight shadow-xs ${palette.cls} ${className}`}>{children}</span>;
}
