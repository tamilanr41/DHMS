import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, X, Loader2, ChevronDown, ChevronRight, KeyRound, LogOut, Bell,
  Plus, UserPlus, CalendarPlus, ReceiptText, Stethoscope, CheckCircle2,
  PackageX, AlertTriangle, LayoutDashboard, CalendarDays, Boxes, ShieldCheck,
  Layers, Sun, Moon, Tablet, Menu, Sparkles, Volume2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { useTheme } from '../services/theme.jsx';
import { useClinic } from '../hooks/useClinic.js';
import { formatDate, initials } from '../utils/format.js';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { requestNotificationPermission, playChimeSound } from '../services/soundAndNotification.js';

function useOutsideClose(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

const CRUMBS = [
  { match: /^\/$/, trail: ['Home', 'Dashboard'] },
  { match: /^\/patients$/, trail: ['Dental Clinic', 'Patients'] },
  { match: /^\/patients\/new$/, trail: ['Dental Clinic', 'Patients', 'Register'] },
  { match: /^\/patients\/[^/]+\/edit$/, trail: ['Dental Clinic', 'Patients', 'Edit'] },
  { match: /^\/patients\/[^/]+$/, trail: ['Dental Clinic', 'Patients', 'Profile'] },
  { match: /^\/appointments$/, trail: ['Dental Clinic', 'Appointments'] },
  { match: /^\/queue$/, trail: ['Main', 'Waiting Queue'] },
  { match: /^\/consultations$/, trail: ['Clinical Suite', 'Consultations'] },
  { match: /^\/consultations\/[^/]+$/, trail: ['Clinical Suite', 'Consultations', 'Workspace'] },
  { match: /^\/dental-chart/, trail: ['Clinical Suite', 'Dental Chart'] },
  { match: /^\/treatment-plans$/, trail: ['Clinical Suite', 'Treatment Plans'] },
  { match: /^\/treatment-plans\/[^/]+$/, trail: ['Clinical Suite', 'Treatment Plans', 'Plan'] },
  { match: /^\/prescriptions$/, trail: ['Clinical Suite', 'Prescriptions'] },
  { match: /^\/invoices$/, trail: ['Billing & Finance', 'Invoices'] },
  { match: /^\/invoices\/new$/, trail: ['Billing & Finance', 'Invoices', 'New Invoice'] },
  { match: /^\/invoices\/[^/]+$/, trail: ['Billing & Finance', 'Invoices', 'Invoice Details'] },
  { match: /^\/payments$/, trail: ['Billing & Finance', 'Transactions'] },
  { match: /^\/claims$/, trail: ['Billing & Finance', 'Insurance Claims'] },
  { match: /^\/inventory$/, trail: ['Operations', 'Inventory'] },
  { match: /^\/labs$/, trail: ['Operations', 'Dental Labs'] },
  { match: /^\/reports$/, trail: ['Operations', 'Reports & Analytics'] },
  { match: /^\/masters$/, trail: ['Administration', 'Master Records'] },
  { match: /^\/admin\/users$/, trail: ['Administration', 'Users & Roles'] },
  { match: /^\/admin\/clinic$/, trail: ['Administration', 'Clinic Settings'] },
  { match: /^\/admin\/backups$/, trail: ['Administration', 'Backup & Restore'] },
  { match: /^\/admin\/audit$/, trail: ['Administration', 'Audit Logs'] },
  { match: /^\/change-password$/, trail: ['Account', 'Change Password'] }
];

function useTrail() {
  const { pathname } = useLocation();
  return useMemo(() => CRUMBS.find((c) => c.match.test(pathname))?.trail || ['Home', 'Workspace'], [pathname]);
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const ref = useOutsideClose(() => setOpen(false));

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: async () => {
      if (!debounced) return { patients: [] };
      const res = await api.get(`/patients?q=${encodeURIComponent(debounced)}&pageSize=5`);
      return { patients: res.data || [] };
    },
    enabled: Boolean(debounced),
    staleTime: 30_000
  });

  const results = data?.patients || [];

  const goToPatient = (p) => {
    setOpen(false);
    setQ('');
    navigate(`/patients/${p.id}`);
  };

  return (
    <div ref={ref} className="relative w-full max-w-[160px] sm:max-w-[260px] md:max-w-[340px] lg:max-w-[420px]">
      <div
        className={`flex h-9 sm:h-10 w-full items-center gap-2 sm:gap-2.5 rounded-full border bg-white/90 px-2.5 sm:px-3.5 text-xs shadow-sm transition-all duration-200 dark:bg-slate-800/90 ${
          focused
            ? 'border-[#0a7f8b] ring-2 ring-[#0a7f8b]/20 shadow-[0_4px_16px_rgba(10,127,139,0.15)]'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
        }`}
      >
        <Search size={14} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder="Search..."
          className="w-full bg-transparent text-[12px] sm:text-[12.5px] font-medium text-slate-800 placeholder-slate-400 outline-none dark:text-slate-100"
        />
        {isFetching ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-primary-600" />
        ) : q ? (
          <button type="button" onClick={() => setQ('')} className="text-slate-400 hover:text-slate-600">
            <X size={13} />
          </button>
        ) : (
          <span className="hidden items-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            ⌘K
          </span>
        )}
      </div>

      {open && debounced && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {results.length > 0 ? (
            <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto py-1 dark:divide-slate-700/60">
              {results.map((p, idx) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => goToPatient(p)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-primary-50/60 dark:hover:bg-slate-700/60"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                      {initials(p.fullName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                        {p.fullName}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {p.patientNo} · {p.mobile}
                      </span>
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-center text-xs text-slate-400">
              {isFetching ? 'Searching clinical database…' : 'No patients found matching this query.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function QuickBookButton() {
  const navigate = useNavigate();
  const { has } = useAuth();
  if (!has('appointments.manage') && !has('patients.create')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/appointments?new=1')}
      className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_20px_-6px_rgba(10,127,139,0.5)] transition hover:opacity-95 sm:inline-flex"
    >
      <CalendarPlus size={14} className="text-white" />
      <span className="text-white font-bold">+ Book Appointment</span>
    </button>
  );
}

function Notifications() {
  const { has } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const allowed = has('inventory.view');

  const { data } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => (await api.get('/inventory/alerts')).data,
    enabled: allowed,
    refetchInterval: 120_000
  });

  const low = data?.lowStock?.length || 0;
  const expiring = data?.expiring?.length || 0;
  const total = low + expiring;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="btn-header"
      >
        <Bell size={16} />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Alerts</span>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-[#0a7f8b] dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60">
              {total} Pending
            </span>
          </div>

          {/* Doctor Phone Notification Enabler */}
          <div className="border-b border-slate-100 p-2.5 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-800 dark:text-white">Mobile &amp; Sound Alerts</p>
                <p className="text-[10px] text-slate-400">Ring chime when patient arrives</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  playChimeSound('arrival');
                  await requestNotificationPermission();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#0a7f8b] px-2 py-1 text-[10.5px] font-bold text-white shadow-xs hover:bg-[#086771]"
                title="Enable sound & push alerts"
              >
                <Volume2 size={12} />
                <span>Test Alert</span>
              </button>
            </div>
          </div>
          <div className="p-1">
            {total === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                <CheckCircle2 size={16} className="text-emerald-500" />
                All supplies and clinic alerts are normal.
              </div>
            ) : (
              <div className="space-y-1">
                {low > 0 && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); navigate('/inventory?lowStock=true'); }}
                    className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
                  >
                    <PackageX size={16} className="mt-0.5 text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{low} supplies low on stock</p>
                      <p className="text-[11px] text-slate-400">Order replacements</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="btn-header"
    >
      {isDark ? (
        <Sun size={16} className="text-amber-400" />
      ) : (
        <Moon size={16} className="text-slate-600 dark:text-slate-300" />
      )}
    </button>
  );
}

function KioskButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/kiosk')}
      aria-label="Open Tablet Self Check-in"
      title="Open Receptionist Tablet Self Check-in Kiosk"
      className="btn-header hidden sm:inline-flex"
    >
      <Tablet size={16} className="text-primary-600 dark:text-primary-400" />
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-1 pr-3 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/90"
      >
        <div className="relative">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white shadow-sm">
            {initials(user?.fullName)}
          </span>
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
        </div>
        <div className="hidden text-left xl:block">
          <p className="max-w-[120px] truncate text-[12px] font-bold text-slate-800 dark:text-white">
            {user?.fullName || 'Dr. Sathish'}
          </p>
          <p className="text-[10px] font-medium text-slate-400">
            {user?.roleName || 'Dentist'}
          </p>
        </div>
        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.fullName}</p>
            <p className="text-[11px] text-slate-400">@{user?.username} · Online</p>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/change-password'); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <KeyRound size={14} className="text-slate-400" /> Change password
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirm(true); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Sign out"
        message="You will be returned to the sign-in screen. Any unsaved changes will be lost."
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={async () => {
          setConfirm(false);
          await logout();
          navigate('/login');
        }}
      />
    </div>
  );
}

export default function Topbar({ onToggleSidebar, onToggleMobile }) {
  const trail = useTrail();
  const page = trail[trail.length - 1];

  return (
    <header className="sticky top-2 sm:top-3 z-30 mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-1.5rem)] max-w-[1680px] rounded-2xl border border-white/80 bg-white/80 px-2.5 sm:px-4 py-2 sm:py-2.5 shadow-[0_16px_36px_-18px_rgba(10,127,139,0.22)] backdrop-blur-2xl transition-all dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-[0_16px_36px_-18px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Sidebar Toggle + Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={onToggleMobile}
            aria-label="Open mobile menu"
            className="btn-header lg:hidden cursor-pointer"
          >
            <Menu size={18} />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            className="btn-header hidden lg:flex cursor-pointer"
          >
            <Menu size={17} />
          </button>

          <nav aria-label="Breadcrumb">
            <ol className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
              {trail.map((item, idx) => (
                <li key={item} className="flex items-center gap-1.5">
                  {idx > 0 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />}
                  <span className={idx === trail.length - 1 ? 'font-bold text-slate-800 dark:text-white' : ''}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
            <span className="block md:hidden text-xs font-bold text-slate-800 dark:text-white truncate max-w-[110px] sm:max-w-[180px]">
              {page}
            </span>
          </nav>
        </div>

        {/* Center: Global Search */}
        <div className="flex flex-1 justify-center px-1 sm:px-2 min-w-0">
          <GlobalSearch />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <QuickBookButton />
          <Notifications />
          <KioskButton />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
