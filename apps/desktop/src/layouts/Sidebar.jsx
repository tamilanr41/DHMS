import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, ListOrdered, Stethoscope, Grid3X3, ClipboardList,
  Pill, ReceiptText, Wallet, Package, FlaskConical, BarChart3, UserCog, Settings, DatabaseBackup,
  ScrollText, ChevronsLeft, ChevronsRight, LogOut, KeyRound, BellRing, ShieldCheck, Layers,
  Activity, Sparkles, ChevronDown, X
} from 'lucide-react';
import { useAuth } from '../services/auth.jsx';
import { useClinic, useBrandImage } from '../hooks/useClinic.js';
import { initials } from '../utils/format.js';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import Logo from '../components/ui/Logo.jsx';
import heroTooth from '../assets/dental/hero-tooth.svg';

const NAV = [
  {
    title: 'Main',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
      { to: '/queue', label: 'Waiting Queue', icon: ListOrdered, permission: 'queue.view', badge: 'Live' }
    ]
  },
  {
    title: 'Dental Clinic',
    items: [
      { to: '/appointments', label: 'Appointments', icon: CalendarDays, permission: 'appointments.view' },
      { to: '/patients', label: 'Patients', icon: Users, permission: 'patients.view' },
      { to: '/recalls', label: 'Recall Visits', icon: BellRing, permission: 'patients.view' }
    ]
  },
  {
    title: 'Clinical Suite',
    items: [
      { to: '/consultations', label: 'Consultations', icon: Stethoscope, permission: 'consultations.view' },
      { to: '/dental-chart', label: 'Dental Chart', icon: Grid3X3, permission: 'chart.view' },
      { to: '/treatment-plans', label: 'Treatment Plans', icon: ClipboardList, permission: 'plans.view' },
      { to: '/prescriptions', label: 'Prescriptions', icon: Pill, permission: 'prescriptions.view' }
    ]
  },
  {
    title: 'Billing & Finance',
    items: [
      { to: '/invoices', label: 'Invoices', icon: ReceiptText, permission: 'invoices.view' },
      { to: '/payments', label: 'Transactions', icon: Wallet, permission: 'payments.view' },
      { to: '/claims', label: 'Insurance Claims', icon: ShieldCheck, permission: 'claims.view' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Package, permission: 'inventory.view' },
      { to: '/labs', label: 'Dental Labs', icon: FlaskConical, permission: 'labs.view', labOnly: true },
      { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, permission: 'reports.view' }
    ]
  },
  {
    title: 'Administration',
    items: [
      { to: '/masters', label: 'Master Records', icon: Layers, permission: 'settings.manage' },
      { to: '/admin/users', label: 'Users & Roles', icon: UserCog, permission: 'users.manage' },
      { to: '/admin/clinic', label: 'Clinic Settings', icon: Settings, permission: 'settings.manage' },
      { to: '/admin/backups', label: 'Backup & Restore', icon: DatabaseBackup, permission: 'backups.manage' },
      { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText, permission: 'audit.view' }
    ]
  }
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { user, has, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: clinic } = useClinic();
  const labEnabled = clinic?.labModuleEnabled !== false;
  const [signOutOpen, setSignOutOpen] = useState(false);
  const navRef = useRef(null);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/95 ${
        mobileOpen
          ? 'translate-x-0 w-[280px] shadow-2xl'
          : '-translate-x-full lg:translate-x-0'
      } ${collapsed ? 'lg:w-[78px]' : 'lg:w-[276px]'}`}
      aria-label="Sidebar"
    >
      {/* Brand Header */}
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
        <NavLink to="/" onClick={() => onCloseMobile?.()} className="flex min-w-0 items-center gap-3">
          <Logo className="h-10 w-10 shrink-0 shadow-[0_8px_16px_-4px_rgba(10,127,139,0.35)]" />
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0 leading-tight">
              <span className="block font-sans text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {clinic?.name || 'ZhanX Dental'}
              </span>
              <span className="block text-[11px] font-bold text-[#0a7f8b] dark:text-[#14b8c8]">
                Clinic Management
              </span>
            </div>
          )}
        </NavLink>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden cursor-pointer"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>

        {/* Desktop Collapse Toggle */}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+B)"
          >
            <ChevronsLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav ref={navRef} className="no-scrollbar flex-1 overflow-y-auto px-3.5 py-4" aria-label="Main navigation">
        {NAV.map((group, groupIndex) => {
          const visible = group.items.filter((item) => has(item.permission) && (!item.labOnly || labEnabled));
          if (!visible.length) return null;
          return (
            <div key={group.title} className={groupIndex === 0 ? '' : 'mt-5'}>
              {!collapsed || mobileOpen ? (
                <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                  {group.title}
                </p>
              ) : groupIndex > 0 ? (
                <div className="mx-2 mb-2 h-px bg-slate-200 dark:bg-slate-800" />
              ) : null}
              <div className="space-y-1">
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => onCloseMobile?.()}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                        collapsed && !mobileOpen ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                      } ${
                        isActive
                          ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-[0_8px_20px_-6px_rgba(10,127,139,0.6)] font-bold'
                          : 'text-slate-600 hover:bg-[#eaf8fa] hover:text-[#0a7f8b] dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-[#38bdf8]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={18}
                          strokeWidth={isActive ? 2.2 : 1.8}
                          className={
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 transition-colors group-hover:text-[#0a7f8b] dark:group-hover:text-[#38bdf8]'
                          }
                        />
                        {(!collapsed || mobileOpen) && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {(!collapsed || mobileOpen) && item.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Footer Card */}
      <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
        {collapsed && !mobileOpen ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Expand sidebar"
              title="Expand sidebar (Ctrl+B)"
            >
              <ChevronsRight size={16} />
            </button>
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                {initials(user?.fullName)}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            </div>
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <>
            {/* Doccure Dental Clinic Promo Card */}
            <div className="promo-card mb-3">
              <span className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full bg-white/20 blur-xl" />
              <div className="relative flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100">Clinic Status</p>
                  <p className="mt-0.5 text-base font-extrabold text-white">99.4% Ready</p>
                  <p className="mt-0.5 text-[11px] text-teal-100/90">4 Chairs Sanitized</p>
                </div>
                <img
                  src={heroTooth}
                  alt="Dental Care"
                  className="size-14 shrink-0 object-contain drop-shadow-[0_8px_16px_rgba(4,66,75,0.4)] animate-float-doccure"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    {initials(user?.fullName)}
                  </span>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                    {user?.fullName || 'Doctor'}
                  </p>
                  <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {user?.roleName || 'Dentist'} · Online
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/change-password')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <KeyRound size={13} /> Password
                </button>
                <button
                  type="button"
                  onClick={() => setSignOutOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200/80 bg-red-50/80 px-2 py-1.5 text-[11px] font-semibold text-red-600 shadow-sm transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out"
        message="You will be returned to the sign-in screen. Any unsaved form changes will be lost."
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={async () => {
          setSignOutOpen(false);
          await logout();
          navigate('/login');
        }}
      />
    </aside>
  );
}
