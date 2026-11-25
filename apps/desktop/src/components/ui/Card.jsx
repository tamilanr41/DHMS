export default function Card({
  title,
  subtitle,
  actions,
  icon: Icon,
  children,
  className = '',
  bodyClass = 'p-6',
  noBody = false
}) {
  return (
    <section className={`card-base overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8c8] to-[#0a7f8b] text-white shadow-md">
                <Icon size={18} strokeWidth={2.2} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-black leading-tight text-slate-900 dark:text-white">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs leading-snug text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {noBody ? children : <div className={bodyClass}>{children}</div>}
    </section>
  );
}

const TONES = {
  navy: { chip: 'bg-teal-50 text-teal-700 ring-teal-100', bar: 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8]', glow: 'bg-teal-100/50' },
  accent: { chip: 'bg-teal-50 text-teal-700 ring-teal-100', bar: 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8]', glow: 'bg-teal-100/50' },
  aqua: { chip: 'bg-cyan-50 text-cyan-700 ring-cyan-100', bar: 'bg-gradient-to-r from-cyan-500 to-teal-400', glow: 'bg-cyan-100/60' },
  success: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', bar: 'bg-gradient-to-r from-emerald-500 to-teal-400', glow: 'bg-emerald-100/50' },
  warn: { chip: 'bg-amber-50 text-amber-700 ring-amber-100', bar: 'bg-gradient-to-r from-amber-500 to-orange-400', glow: 'bg-amber-100/50' },
  danger: { chip: 'bg-rose-50 text-rose-700 ring-rose-100', bar: 'bg-gradient-to-r from-rose-500 to-red-400', glow: 'bg-rose-100/50' }
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'accent', trend, className = '', accent = true }) {
  const palette = TONES[tone] || TONES.accent;
  return (
    <div className={`card-base group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(10,127,139,0.22)] ${className}`}>
      {accent && <span className={`absolute inset-x-0 top-0 h-[3px] ${palette.bar}`} />}
      <span aria-hidden="true" className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 ${palette.glow} opacity-60 group-hover:opacity-100`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8c8] to-[#0a7f8b] text-white shadow-md transition-transform duration-300 group-hover:scale-110">
            <Icon size={19} strokeWidth={2.2} />
          </span>
        )}
      </div>
      {hint && <p className="relative mt-2 truncate text-xs text-slate-400">{hint}</p>}
      {trend}
    </div>
  );
}

export { Card };
