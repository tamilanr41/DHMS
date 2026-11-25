import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Users, Wallet, Clock, CheckCircle2, AlertTriangle,
  Monitor, Smartphone, Plus, RefreshCw, KeyRound, Lock, Search,
  ArrowRight, Check, X, Ban, Sparkles, MessageCircle, CreditCard,
  Building2, Laptop, CalendarClock, ChevronRight, UserCheck
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format.js';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';
import { Modal } from '../../components/ui/Modal.jsx';

const ALL_MODULES = [
  { id: 'appointments', label: 'Appointments & Queue', desc: 'Calendar scheduling and live lounge triage' },
  { id: 'chart', label: 'Dental Chart & Odontogram', desc: 'FDI tooth surfaces, restorations and perio tracking' },
  { id: 'plans', label: 'Treatment Plans', desc: 'Multi-visit phased dental care plans' },
  { id: 'prescriptions', label: 'Prescriptions & Safety', desc: 'Rx authoring with drug interactions & stylus pad' },
  { id: 'billing', label: 'Billing, Invoices & Tax', desc: 'Procedure invoicing, receipts and GST tax ledger' },
  { id: 'labs', label: 'Dental Lab Tracking', desc: 'Crowns, bridges, aligners and fabrication turnarounds' },
  { id: 'inventory', label: 'Inventory & Pharmacy', desc: 'Clinical composites, anesthetics and batch expiry' },
  { id: 'claims', label: 'Insurance & Claims', desc: 'TPA pre-authorizations and copay settlements' },
  { id: 'reports', label: 'Reports & Analytics', desc: 'Audit-ready financial and clinical performance reports' }
];

export default function TamilanAdminPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Master Pin Protection
  const [authPin, setAuthPin] = useState(() => localStorage.getItem('tamilan_pin_session') || '');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const isAuthenticated = authPin === '7788';

  const [activeTab, setActiveTab] = useState('clinics'); // clinics | payments
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | active | suspended

  // Modal States
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [activationForm, setActivationForm] = useState({
    amount: '3000',
    paymentMethod: 'UPI',
    transactionRef: '',
    durationMonths: '1',
    maxSystems: '1', // User requirement: default 1 system
    activeModules: ALL_MODULES.map((m) => m.id),
    notes: ''
  });

  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [deviceClinic, setDeviceClinic] = useState(null);

  // Queries
  const statsQuery = useQuery({
    queryKey: ['tamilan-stats'],
    queryFn: async () => {
      const res = await api.get('/tamilan/stats');
      return res?.data || res;
    },
    enabled: isAuthenticated,
    refetchInterval: 10_000
  });

  const clinicsQuery = useQuery({
    queryKey: ['tamilan-clinics'],
    queryFn: async () => {
      const res = await api.get('/tamilan/clinics');
      return res?.data || res || [];
    },
    enabled: isAuthenticated,
    refetchInterval: 10_000
  });

  const paymentsQuery = useQuery({
    queryKey: ['tamilan-payments'],
    queryFn: async () => {
      const res = await api.get('/tamilan/payments');
      return res?.data || res || [];
    },
    enabled: isAuthenticated && activeTab === 'payments'
  });

  const clinicDevicesQuery = useQuery({
    queryKey: ['tamilan-clinic-devices', deviceClinic?.id],
    queryFn: async () => {
      const res = await api.get(`/tamilan/clinics/${deviceClinic.id}/devices`);
      return res?.data || res || [];
    },
    enabled: Boolean(deviceClinic?.id)
  });

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.trim() === '7788') {
      setAuthPin('7788');
      localStorage.setItem('tamilan_pin_session', '7788');
      setPinError(false);
      toast.success('Welcome Master Admin!');
    } else {
      setPinError(true);
      toast.error('Invalid Master PIN. Please enter correct authorization code.');
    }
  };

  const openActivation = (clinic) => {
    setSelectedClinic(clinic);
    setActivationForm({
      amount: clinic.amount_paid > 0 ? '3000' : '5000',
      paymentMethod: 'UPI',
      transactionRef: '',
      durationMonths: '1',
      maxSystems: String(clinic.max_systems || 1),
      activeModules: clinic.active_modules?.length ? clinic.active_modules : clinic.requested_modules || ALL_MODULES.map((m) => m.id),
      notes: `Subscription activation for ${clinic.clinic_name}`
    });
    setActivateModalOpen(true);
  };

  const handleApprovePayment = async () => {
    try {
      await api.post(`/tamilan/clinics/${selectedClinic.id}/approve-payment`, {
        amount: Number(activationForm.amount),
        paymentMethod: activationForm.paymentMethod,
        transactionRef: activationForm.transactionRef,
        durationMonths: Number(activationForm.durationMonths),
        maxSystems: Number(activationForm.maxSystems),
        activeModules: activationForm.activeModules,
        notes: activationForm.notes
      });

      toast.success(`Clinic ${selectedClinic.clinic_name} activated successfully for ${activationForm.maxSystems} system(s)!`);
      setActivateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-payments'] });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (clinic) => {
    const nextStatus = clinic.status === 'active' ? 'suspended' : 'active';
    try {
      await api.post(`/tamilan/clinics/${clinic.id}/status`, { status: nextStatus });
      toast.success(`Clinic ${clinic.clinic_name} status set to ${nextStatus}`);
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-stats'] });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const revokeDevice = async (deviceId) => {
    try {
      await api.delete(`/tamilan/devices/${deviceId}`);
      toast.success('System binding revoked. Clinic can now link a replacement computer.');
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinic-devices'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openWhatsApp = (clinic) => {
    const clean = (clinic.mobile || '').replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    const msg = encodeURIComponent(
      `Vanakkam Dr. ${clinic.doctor_name}, this is Tamilan Admin regarding ZhanX DentalCare for ${clinic.clinic_name}. Your account status is currently ${clinic.status.toUpperCase()} with ${clinic.max_systems} system license(s). Contact us here for activations, renewals or adding more system seats. Thank you!`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const filteredClinics = useMemo(() => {
    const list = clinicsQuery.data || [];
    return list.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.clinic_name.toLowerCase().includes(search.toLowerCase()) ||
        c.doctor_name.toLowerCase().includes(search.toLowerCase()) ||
        c.clinic_code.toLowerCase().includes(search.toLowerCase()) ||
        c.mobile.includes(search);

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && c.status === 'pending_approval') ||
        (statusFilter === 'active' && c.status === 'active') ||
        (statusFilter === 'suspended' && c.status === 'suspended');

      return matchSearch && matchStatus;
    });
  }, [clinicsQuery.data, search, statusFilter]);

  // Master Pin Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-[#073038] p-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-teal-500/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#009da6] to-[#08636d] text-white shadow-lg shadow-teal-500/25">
            <ShieldCheck size={32} />
          </div>

          <div>
            <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#009da6] border border-teal-500/20">
              Restricted Master Console
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
              Enterprise Super Admin
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Enter master security authorization PIN to manage multi-clinic licenses, device locks &amp; subscriptions.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-digit Master PIN (7788)"
                className="w-full rounded-2xl border border-slate-700 bg-slate-800/80 pl-11 pr-4 py-3 text-sm font-black tracking-widest text-center text-white placeholder-slate-500 focus:border-[#009da6] focus:outline-none focus:ring-2 focus:ring-[#009da6]/20 transition"
              />
            </div>

            {pinError && (
              <p className="text-xs font-bold text-rose-400 animate-shake">
                Incorrect Master PIN. Please retry.
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-[#009da6] to-[#08636d] py-3 text-xs font-black text-white hover:opacity-95 shadow-lg shadow-teal-700/30 transition cursor-pointer"
            >
              Unlock Admin Console →
            </button>
          </form>

          <p className="text-[11px] text-slate-500 font-mono">
            Default Master Security PIN: <strong>7788</strong>
          </p>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data || {
    totalClinics: 0,
    pendingApprovals: 0,
    activeClinics: 0,
    totalRevenue: 0,
    authorizedDevices: 0
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Tamilan Signature Command Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#08636d] p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-15 pointer-events-none">
          <img src={heroTooth} alt="" className="h-64 translate-x-12" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-0.5 text-xs font-black tracking-wide text-white backdrop-blur-sm">
              <ShieldCheck size={14} className="stroke-[2.5]" />
              ENTERPRISE MASTER ADMIN · SaaS LICENSING SUITE
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Clinic Registration &amp; Device Seat Control
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Verify clinic signups, collect subscription fees, lock usage to authorized single/multi computers, grant module permissions, and manage recurring renewals.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('tamilan_pin_session');
                setAuthPin('');
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2 text-xs font-black text-white hover:bg-white/25 backdrop-blur-sm transition border border-white/20 cursor-pointer"
            >
              <Lock size={13} />
              Lock Console
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: Strictly Matches Waiting Queue Screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="TOTAL CLINICS"
          value={stats.totalClinics}
          subtitle="registered clinics"
          icon={Building2}
          variant="teal"
        />
        <DoccureKpiCard
          title="PENDING APPROVALS"
          value={stats.pendingApprovals}
          subtitle="awaiting verification"
          icon={Clock}
          variant="amber"
          hasDot={stats.pendingApprovals > 0}
        />
        <DoccureKpiCard
          title="ACTIVE SUBSCRIBERS"
          value={stats.activeClinics}
          subtitle={`${stats.authorizedDevices} systems active`}
          icon={CheckCircle2}
          variant="emerald"
        />
        <DoccureKpiCard
          title="SUBSCRIPTION REVENUE"
          value={formatMoney(stats.totalRevenue)}
          subtitle="collected fees"
          icon={Wallet}
          variant="purple"
        />
      </div>

      {/* Main Workspace */}
      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
        {/* Navigation Tabs and Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('clinics')}
              className={`rounded-xl px-4 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'clinics'
                  ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Clinic Licenses ({stats.totalClinics})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`rounded-xl px-4 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'payments'
                  ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Fee Collection Ledger
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
                queryClient.invalidateQueries({ queryKey: ['tamilan-stats'] });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition shadow-2xs cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} className={clinicsQuery.isFetching ? 'animate-spin text-[#0a7f8b]' : ''} />
            </button>
          </div>
        </div>

        {activeTab === 'clinics' ? (
          <>
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clinic code, name, doctor or mobile..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:bg-white focus:outline-none dark:bg-slate-800/60 dark:border-slate-700 dark:text-white transition"
                />
              </div>

              <div className="flex items-center gap-1 rounded-2xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-500'
                  }`}
                >
                  All ({clinicsQuery.data?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'pending' ? 'bg-amber-50 text-amber-700 shadow-2xs dark:bg-amber-950/60 dark:text-amber-300' : 'text-slate-500'
                  }`}
                >
                  Pending ({stats.pendingApprovals})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'active' ? 'bg-emerald-50 text-emerald-700 shadow-2xs dark:bg-emerald-950/60 dark:text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  Active ({stats.activeClinics})
                </button>
              </div>
            </div>

            {/* Clinics Cards Grid */}
            {clinicsQuery.isLoading ? (
              <div className="py-16 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-[#0a7f8b]" />
                <p className="mt-2 text-xs font-bold text-slate-400">Loading clinics registry...</p>
              </div>
            ) : filteredClinics.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                <Building2 size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <h3 className="mt-3 text-sm font-black text-slate-800 dark:text-slate-200">No clinics match filters</h3>
                <p className="mt-1 text-xs text-slate-400">Adjust search or register a new clinic above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {filteredClinics.map((c) => {
                  const isPending = c.status === 'pending_approval';
                  const isActive = c.status === 'active';
                  const activeDevices = Number(c.active_devices_count || 0);
                  const maxSystems = Number(c.max_systems || 1);

                  return (
                    <article
                      key={c.id}
                      className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-[#0a7f8b] hover:shadow-lg hover:-translate-y-0.5 transition-all dark:bg-slate-850 dark:border-slate-800"
                    >
                      <div>
                        {/* Top: Code & Status */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">
                            {c.clinic_code}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${
                              isPending
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                                : isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {isPending ? 'Pending Approval' : c.status}
                          </span>
                        </div>

                        {/* Clinic & Doctor Details */}
                        <div className="mt-3.5 space-y-1">
                          <h4 className="text-base font-black text-slate-900 group-hover:text-[#0a7f8b] dark:text-white transition-colors">
                            {c.clinic_name}
                          </h4>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <UserCheck size={13} className="text-[#0a7f8b]" />
                            {c.doctor_name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {c.mobile} {c.email ? `· ${c.email}` : ''} {c.city ? `· ${c.city}` : ''}
                          </p>
                        </div>

                        {/* Seat / System Lock Indicator (User Requirement) */}
                        <div className="mt-3.5 rounded-2xl bg-teal-50/50 p-3 border border-teal-100/70 text-xs dark:bg-teal-950/20 dark:border-teal-900/40">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                              <Laptop size={14} className="text-[#0a7f8b]" />
                              Authorized Computers:
                            </span>
                            <span className={`font-black font-mono px-2 py-0.5 rounded-lg text-xs ${
                              activeDevices >= maxSystems
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-white text-[#0a7f8b] border border-teal-200'
                            }`}>
                              {activeDevices} / {maxSystems} system{maxSystems === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className="mt-1 text-[10.5px] text-slate-500 font-medium">
                            {maxSystems === 1
                              ? 'Strict 1-system lock. Gated if opened on secondary computer.'
                              : `Multi-seat license permitting up to ${maxSystems} systems.`}
                          </p>
                        </div>

                        {/* Validity & Amount */}
                        <div className="mt-3 space-y-1.5 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Valid Until:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {c.valid_until ? formatDate(c.valid_until) : 'Not Activated'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Total Paid:</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatMoney(c.amount_paid)}
                            </span>
                          </div>
                        </div>

                        {/* Active Modules Chips */}
                        <div className="mt-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Permitted Modules:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(c.active_modules?.length ? c.active_modules : c.requested_modules || []).slice(0, 4).map((mod) => (
                              <span key={mod} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {mod}
                              </span>
                            ))}
                            {(c.active_modules?.length ? c.active_modules : c.requested_modules || []).length > 4 && (
                              <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-[#0a7f8b]">
                                +{(c.active_modules?.length ? c.active_modules : c.requested_modules || []).length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openWhatsApp(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                            title="Message Doctor on WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeviceClinic(c);
                              setDevicesModalOpen(true);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                            title="View / Revoke Registered Computers"
                          >
                            <Laptop size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(c)}
                            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer shadow-2xs ${
                              isActive
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            title={isActive ? 'Suspend access' : 'Unsuspend access'}
                          >
                            {isActive ? <Ban size={13} /> : <Check size={13} />}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => openActivation(c)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-3.5 py-1.5 text-xs font-black text-white hover:opacity-95 shadow-sm transition cursor-pointer"
                        >
                          <CreditCard size={13} />
                          {isPending ? 'Approve & Activate' : 'Renew / Seat'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Payments Ledger */
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Tamilan Super Admin Fee Collection History
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10.5px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Clinic &amp; Doctor</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Mode &amp; Ref</th>
                    <th className="px-4 py-3">Seats / Systems</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(paymentsQuery.data || []).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-[#0a7f8b]">{p.receipt_no}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{p.clinic_name}</p>
                        <p className="text-[10.5px] text-slate-400">{p.doctor_name} · {p.mobile}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(p.payment_date)}</td>
                      <td className="px-4 py-3 font-black text-emerald-600 tabular-nums">{formatMoney(p.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold">
                          {p.payment_method}
                        </span>
                        {p.transaction_ref && <span className="block text-[10px] font-mono text-slate-400">{p.transaction_ref}</span>}
                      </td>
                      <td className="px-4 py-3 font-bold font-mono">{p.systems_granted} System(s)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Collect Payment & Activate Modal */}
      <Modal
        open={activateModalOpen}
        onClose={() => setActivateModalOpen(false)}
        title={selectedClinic ? `Activate & License: ${selectedClinic.clinic_name}` : 'Clinic Activation'}
        subtitle="Record fee collection, set authorized system seats, and grant module permissions."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setActivateModalOpen(false)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprovePayment}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-6 py-2.5 text-xs font-black text-white hover:opacity-95 shadow-md shadow-teal-700/25 transition cursor-pointer"
            >
              <CheckCircle2 size={15} />
              Confirm Payment &amp; Unlock Access
            </button>
          </div>
        }
      >
        {selectedClinic && (
          <div className="space-y-4">
            {/* Clinic Mini Card */}
            <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4 text-xs">
              <p className="font-black text-slate-900 text-sm">{selectedClinic.clinic_name} ({selectedClinic.clinic_code})</p>
              <p className="text-slate-600 mt-0.5 font-medium">Doctor: {selectedClinic.doctor_name} · Mobile: {selectedClinic.mobile}</p>
            </div>

            {/* Payment & Systems Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Collected (₹)
                </label>
                <input
                  type="number"
                  value={activationForm.amount}
                  onChange={(e) => setActivationForm({ ...activationForm, amount: e.target.value })}
                  placeholder="3000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={activationForm.paymentMethod}
                  onChange={(e) => setActivationForm({ ...activationForm, paymentMethod: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Cash">Direct Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Validity Duration (Months)
                </label>
                <select
                  value={activationForm.durationMonths}
                  onChange={(e) => setActivationForm({ ...activationForm, durationMonths: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
                >
                  <option value="1">1 Month (30 Days)</option>
                  <option value="3">3 Months (Quarterly)</option>
                  <option value="6">6 Months (Half-Yearly)</option>
                  <option value="12">1 Year (Annual)</option>
                  <option value="120">10 Years (Lifetime)</option>
                </select>
              </div>

              {/* Authorized Systems / Seats Selection (User Requirement) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Authorized Computers / Seats (Lock)
                </label>
                <select
                  value={activationForm.maxSystems}
                  onChange={(e) => setActivationForm({ ...activationForm, maxSystems: e.target.value })}
                  className="w-full rounded-xl border border-teal-200 bg-teal-50/30 px-3 py-2 text-xs font-black text-[#009da6] focus:border-[#009da6] focus:outline-none"
                >
                  <option value="1">1 System Only (Single PC Lock)</option>
                  <option value="2">2 Systems (Doctor Chair + Reception)</option>
                  <option value="3">3 Systems (2 Chairs + Reception)</option>
                  <option value="5">5 Systems (Hospital / Multi-chair)</option>
                  <option value="10">10 Systems (Full Enterprise)</option>
                </select>
                <p className="mt-1 text-[10.5px] text-slate-400 font-medium">
                  Software locks to exactly this number of computers.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transaction Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={activationForm.transactionRef}
                  onChange={(e) => setActivationForm({ ...activationForm, transactionRef: e.target.value })}
                  placeholder="e.g. UPI Ref 349129034821 or Bank Txn ID"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:outline-none"
                />
              </div>
            </div>

            {/* Permitted Modules Checkboxes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Authorized Module Permissions
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {ALL_MODULES.map((m) => {
                  const checked = activationForm.activeModules.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition cursor-pointer ${
                        checked ? 'border-teal-200 bg-teal-50/40 text-slate-900' : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...activationForm.activeModules, m.id]
                            : activationForm.activeModules.filter((id) => id !== m.id);
                          setActivationForm({ ...activationForm, activeModules: next });
                        }}
                        className="mt-0.5 rounded text-[#009da6] focus:ring-[#009da6]"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-black">{m.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{m.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Authorized Devices / Computer Binding Modal */}
      <Modal
        open={devicesModalOpen}
        onClose={() => setDevicesModalOpen(false)}
        title={deviceClinic ? `Authorized Computers: ${deviceClinic.clinic_name}` : 'Authorized Computers'}
        subtitle={`This clinic is authorized for ${deviceClinic?.max_systems || 1} system(s).`}
        size="md"
        footer={
          <button
            type="button"
            onClick={() => setDevicesModalOpen(false)}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        }
      >
        <div className="space-y-3">
          {(clinicDevicesQuery.data || []).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <Laptop size={32} className="mx-auto text-slate-300 mb-2" />
              No computers bound yet. The first computer the clinic opens will automatically bind as Seat 1.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(clinicDevicesQuery.data || []).map((dev, idx) => (
                <div key={dev.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">Seat {idx + 1}: {dev.device_name || 'Clinic Computer'}</span>
                      <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 text-[9.5px] font-black uppercase">
                        Authorized
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                      ID: {dev.device_fingerprint} · Last active: {formatDateTime(dev.last_seen_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeDevice(dev.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shrink-0"
                    title="Remove device authorization to free up seat"
                  >
                    <X size={12} /> Revoke Seat
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
            Revoking a seat frees it up immediately so the clinic can bind a new replacement computer if their PC was formatted or upgraded.
          </p>
        </div>
      </Modal>
    </div>
  );
}
