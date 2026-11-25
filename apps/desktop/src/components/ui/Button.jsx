import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white border-0 shadow-[0_4px_16px_rgba(10,127,139,0.25)] hover:shadow-[0_8px_22px_rgba(10,127,139,0.4)] hover:brightness-105 disabled:bg-slate-300 disabled:shadow-none disabled:from-slate-300 disabled:to-slate-300',
  accent: 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white border-0 shadow-[0_4px_16px_rgba(10,127,139,0.25)] hover:shadow-[0_8px_22px_rgba(10,127,139,0.4)] hover:brightness-105 disabled:bg-slate-300 disabled:shadow-none',
  secondary: 'bg-white/90 text-slate-700 border-slate-200/80 shadow-xs hover:bg-teal-50/60 hover:border-teal-300 hover:text-teal-800 disabled:text-slate-400 disabled:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-600 border-transparent hover:bg-teal-50/70 hover:text-teal-800 disabled:text-slate-400 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-gradient-to-r from-rose-600 to-red-500 text-white border-0 shadow-sm hover:brightness-105 disabled:bg-slate-300 disabled:shadow-none',
  subtle: 'bg-teal-50 text-teal-700 border-teal-200/70 hover:bg-teal-100 font-bold dark:bg-teal-950/60 dark:text-teal-300'
};

const SIZES = {
  sm: 'h-8 px-3 text-[12px] gap-1.5 rounded-xl',
  md: 'h-[38px] px-4 text-[13px] gap-2 rounded-2xl',
  lg: 'h-11 px-6 text-sm gap-2.5 rounded-2xl'
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  type = 'button',
  icon: Icon,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center border font-extrabold leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.2} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className = '', variant = 'ghost', size = 'md', ...rest }) {
  const dims = size === 'sm' ? 'h-8 w-8 rounded-xl' : size === 'lg' ? 'h-11 w-11 rounded-2xl' : 'h-9 w-9 rounded-xl';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${dims} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 18} strokeWidth={2.2} />
    </button>
  );
}
