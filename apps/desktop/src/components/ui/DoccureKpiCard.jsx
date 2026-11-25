import React from 'react';
import heroTooth from '../../assets/dental/hero-tooth.svg';
import receivedTodayTooth from '../../assets/dental/received-today-tooth.svg';
import cleaningTooth from '../../assets/dental/cleaning-tooth.svg';
import implantTooth from '../../assets/dental/implant-tooth.svg';
import revenueCoinsTooth from '../../assets/dental/revenue-coins-tooth.svg';
import whiteningTooth from '../../assets/dental/whitening-tooth.svg';

/**
 * DoccureKpiCard
 * Signature Doccure Dental KPI stat card with 3D tooth mascot illustrations:
 * - Upper-case label at top left (gray, bold, tracking-widest)
 * - Solid round circle icon button at top right (teal, amber, purple, emerald, rose, blue)
 * - 3D Dental Mascot Illustration (heroTooth, cleaningTooth, revenueCoinsTooth, etc.)
 * - Large bold number at bottom left
 * - Status / descriptor text right next to the number on the horizontal baseline
 * - Optional colored pulse / active dot
 */
export default function DoccureKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  image,
  variant = 'teal',
  hasDot = false,
  className = ''
}) {
  const variants = {
    teal: {
      iconBg: 'bg-[#009da6] text-white shadow-[0_8px_20px_-4px_rgba(0,157,166,0.45)]',
      valueColor: 'text-slate-900 dark:text-white',
      subColor: 'text-slate-400 dark:text-slate-400',
      dotColor: 'bg-[#009da6]',
      glow: 'from-teal-500/10 to-transparent',
      defaultMascot: heroTooth
    },
    amber: {
      iconBg: 'bg-[#f39c12] text-white shadow-[0_8px_20px_-4px_rgba(243,156,18,0.45)]',
      valueColor: 'text-[#d97706] dark:text-amber-400',
      subColor: 'text-[#d97706] dark:text-amber-400',
      dotColor: 'bg-[#d97706]',
      glow: 'from-amber-500/10 to-transparent',
      defaultMascot: receivedTodayTooth
    },
    purple: {
      iconBg: 'bg-[#8b5cf6] text-white shadow-[0_8px_20px_-4px_rgba(139,92,246,0.45)]',
      valueColor: 'text-[#8b5cf6] dark:text-purple-400',
      subColor: 'text-[#8b5cf6] dark:text-purple-400',
      dotColor: 'bg-[#8b5cf6]',
      glow: 'from-purple-500/10 to-transparent',
      defaultMascot: implantTooth
    },
    emerald: {
      iconBg: 'bg-[#10b981] text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.45)]',
      valueColor: 'text-[#059669] dark:text-emerald-400',
      subColor: 'text-[#059669] dark:text-emerald-400',
      dotColor: 'bg-[#10b981]',
      glow: 'from-emerald-500/10 to-transparent',
      defaultMascot: revenueCoinsTooth
    },
    rose: {
      iconBg: 'bg-[#f43f5e] text-white shadow-[0_8px_20px_-4px_rgba(244,63,94,0.45)]',
      valueColor: 'text-[#e11d48] dark:text-rose-400',
      subColor: 'text-[#e11d48] dark:text-rose-400',
      dotColor: 'bg-[#f43f5e]',
      glow: 'from-rose-500/10 to-transparent',
      defaultMascot: whiteningTooth
    },
    blue: {
      iconBg: 'bg-[#3b82f6] text-white shadow-[0_8px_20px_-4px_rgba(59,130,246,0.45)]',
      valueColor: 'text-[#2563eb] dark:text-blue-400',
      subColor: 'text-[#2563eb] dark:text-blue-400',
      dotColor: 'bg-[#3b82f6]',
      glow: 'from-blue-500/10 to-transparent',
      defaultMascot: cleaningTooth
    }
  };

  const style = variants[variant] || variants.teal;
  const mascotImg = image !== undefined ? image : style.defaultMascot;

  return (
    <article
      className={`group relative overflow-hidden rounded-[26px] border border-slate-100/90 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.09)] dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {/* Decorative background ambient glow */}
      <div
        className={`pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-gradient-to-br ${style.glow} blur-2xl transition-opacity duration-300 group-hover:scale-125 group-hover:opacity-100 opacity-60`}
        aria-hidden="true"
      />

      {/* Decorative 3D Tooth Mascot Watermark in card background */}
      {mascotImg && (
        <div className="pointer-events-none absolute right-3 bottom-2 select-none opacity-20 transition-all duration-300 group-hover:opacity-35 group-hover:scale-110 dark:opacity-15 dark:group-hover:opacity-30">
          <img
            src={mascotImg}
            alt=""
            className="h-16 w-16 object-contain drop-shadow"
            loading="lazy"
          />
        </div>
      )}

      {/* Top Header: Title and Icon Badge + Mascot */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {title}
        </p>

        <div className="flex items-center gap-2">
          {/* 3D Mascot thumbnail alongside icon */}
          {mascotImg && (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50/80 p-1 backdrop-blur-xs transition-transform duration-300 group-hover:scale-110 dark:bg-slate-800/80">
              <img
                src={mascotImg}
                alt=""
                className="h-full w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.12)]"
                loading="lazy"
              />
            </div>
          )}

          {/* Solid circular action/status icon */}
          {Icon && (
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105 ${style.iconBg}`}>
              <Icon size={20} strokeWidth={2.2} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Large Value & Baseline Subtitle */}
      <div className="relative z-10 mt-5 flex items-baseline gap-2.5">
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
