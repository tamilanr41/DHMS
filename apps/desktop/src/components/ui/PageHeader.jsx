import { Link, useLocation } from 'react-router-dom';
import {
  ChevronRight, Home, LayoutDashboard, Users, CalendarDays, ListOrdered, Stethoscope,
  Activity, ClipboardList, Pill, ReceiptText, Wallet, Package, FlaskConical, BarChart3,
  UserCog, Settings, DatabaseBackup, ScrollText, Sparkles, Layers
} from 'lucide-react';

const MODULE_ICONS = [
  ['/patients', Users],
  ['/appointments', CalendarDays],
  ['/queue', ListOrdered],
  ['/consultations', Stethoscope],
  ['/chart', Activity],
  ['/treatment-plans', ClipboardList],
  ['/plans', ClipboardList],
  ['/prescriptions', Pill],
  ['/billing', ReceiptText],
  ['/payments', Wallet],
  ['/inventory', Package],
  ['/labs', FlaskConical],
  ['/reports', BarChart3],
  ['/masters', Layers],
  ['/users', UserCog],
  ['/settings', Settings],
  ['/backups', DatabaseBackup],
  ['/audit-logs', ScrollText],
  ['/audit', ScrollText]
];

function inferIcon(pathname) {
  if (pathname === '/' || pathname === '') return LayoutDashboard;
  const match = MODULE_ICONS.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : Sparkles;
}

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  breadcrumbs = [],
  icon,
  tone = 'accent',
  children,
  className = ''
}) {
  const location = useLocation();
  const Icon = icon || inferIcon(location.pathname);

  return (
    <div className={`mb-6 ${className}`}>
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2.5 flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumbs.map((crumb, idx) => (
            <span key={`${crumb.label}-${idx}`} className="flex min-w-0 items-center gap-1.5">
              {idx > 0 && <ChevronRight size={13} className="shrink-0 text-slate-300 dark:text-slate-600" />}
              {idx === 0 && crumb.to === '/' ? (
                <Link to="/" className="flex items-center gap-1 font-semibold text-slate-400 transition-colors hover:text-teal-600 dark:hover:text-teal-400" aria-label="Home">
                  <Home size={13} />
                </Link>
              ) : crumb.to ? (
                <Link to={crumb.to} className="truncate font-semibold text-slate-500 transition-colors hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400">
                  {crumb.label}
                </Link>
              ) : (
                <span className="max-w-[280px] truncate font-bold text-teal-700 dark:text-teal-400">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <span className="size-1.5 rounded-full bg-teal-500" />
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
