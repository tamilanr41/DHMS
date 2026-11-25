import React from 'react';

/**
 * DoccureKpiCard
 * Matches the Waiting Queue screenshot card design:
 * - Upper-case label at top left (gray, bold, tracking-widest)
 * - Solid round circle icon button at top right (teal, amber, purple, emerald, rose, blue)
 * - Large bold number at bottom left
 * - Status / descriptor text right next to the number on the horizontal baseline
 * - Optional colored pulse / active dot
 */
export default function DoccureKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'teal',
  hasDot = false,
  className = ''
}) {
  const variants = {
    teal: {
      iconBg: 'bg-[#009da6] text-white shadow-[0_8px_20px_-4px_rgba(0,157,166,0.45)]',
      valueColor: 'text-slate-900 dark:text-white',
      subColor: 'text-slate-400 dark:text-slate-400',
      dotColor: 'bg-[#009da6]'
    },
    amber: {
      iconBg: 'bg-[#f39c12] text-white shadow-[0_8px_20px_-4px_rgba(243,156,18,0.45)]',
      valueColor: 'text-[#d97706] dark:text-amber-400',
      subColor: 'text-[#d97706] dark:text-amber-400',
      dotColor: 'bg-[#d97706]'
    },
    purple: {
      iconBg: 'bg-[#8b5cf6] text-white shadow-[0_8px_20px_-4px_rgba(139,92,246,0.45)]',
      valueColor: 'text-[#8b5cf6] dark:text-purple-400',
      subColor: 'text-[#8b5cf6] dark:text-purple-400',
      dotColor: 'bg-[#8b5cf6]'
    },
    emerald: {
      iconBg: 'bg-[#10b981] text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.45)]',
      valueColor: 'text-[#059669] dark:text-emerald-400',
      subColor: 'text-[#059669] dark:text-emerald-400',
      dotColor: 'bg-[#10b981]'
    },
    rose: {
      iconBg: 'bg-[#f43f5e] text-white shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)]',
      valueColor: 'text-[#e11d48] dark:text-rose-400',
      subColor: 'text-[#e11d48] dark:text-rose-400',
      dotColor: 'bg-[#f43f5e]'
    },
    blue: {
      iconBg: 'bg-[#3b82f6] text-white shadow-[0_8px_20px_-4px_rgba(59,130,246,0.45)]',
      valueColor: 'text-[#2563eb] dark:text-blue-400',
      subColor: 'text-[#2563eb] dark:text-blue-400',
      dotColor: 'bg-[#3b82f6]'
    }
  };

  const style = variants[variant] || variants.teal;

  return (
    <article
      className={`group relative overflow-hidden rounded-[26px] border border-slate-100/90 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {title}
        </p>
        {Icon && (
          <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105 ${style.iconBg}`}>
            <Icon size={21} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-2.5">
        <span className={`text-3xl font-black tracking-tight ${style.valueColor}`}>
          {value ?? 0}
        </span>
        {subtitle && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${style.subColor}`}>
            {hasDot && (
              <span className={`h-2 w-2 rounded-full ${style.dotColor}`} />
            )}
            {subtitle}
          </span>
        )}
      </div>
    </article>
  );
}
