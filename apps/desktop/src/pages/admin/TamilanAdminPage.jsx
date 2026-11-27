import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Users, Wallet, Clock, CheckCircle2, AlertTriangle,
  Monitor, Smartphone, Plus, RefreshCw, KeyRound, Lock, Search,
  ArrowRight, Check, X, Ban, Sparkles, MessageCircle, CreditCard,
  Building2, Laptop, CalendarClock, ChevronRight, UserCheck,
  ExternalLink, Wrench, ShieldAlert, Cpu, Stethoscope, Calendar,
  FileText, Activity, Unlock, Sliders, Trash2, Database, HardDrive,
  Copy, PlusCircle, Server, Cloud, Globe, Share2, Eye, EyeOff, User
} from 'lucide-react';
import { api, setAccessToken } from '../../services/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format.js';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';
import Logo from '../../components/ui/Logo.jsx';
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
  { id: 'reports', label: 'Clinical Analytics', desc: 'Audit-ready financial and clinical performance reports' }
];

export default function TamilanAdminPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Master Authentication Protection
  const [authPin, setAuthPin] = useState(() => localStorage.getItem('tamilan_pin_session') || '');
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pinError, setPinError] = useState(false);
  const isAuthenticated = authPin === 'tamilan' || authPin === '7788';

  const [activeTab, setActiveTab] = useState('live'); // live | clinics | payments | database
  const [search, setSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | active | suspended

  // Modal States
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [activationForm, setActivationForm] = useState({
    amount: '3000',
    paymentMethod: 'UPI',
    transactionRef: '',
    durationMonths: '1',
    maxSystems: '1',
    activeModules: ALL_MODULES.map((m) => m.id),
    notes: ''
  });

  // Direct Onboarding Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdResultModalOpen, setCreatedResultModalOpen] = useState(false);
  const [createdData, setCreatedData] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    clinicName: '',
    doctorName: '',
    mobile: '',
    email: '',
    city: '',
    address: '',
    planName: 'Growth Plan (₹28,000 / 3 Workstations / 1 Year)',
    maxSystems: '3',
    durationMonths: '12',
    initialPassword: 'Admin@12345',
    activeModules: ALL_MODULES.map((m) => m.id)
  });

  // Delete Clinic State
  const [deleteConfirmClinic, setDeleteConfirmClinic] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Factory Reset States
  const [factoryResetModalOpen, setFactoryResetModalOpen] = useState(false);
  const [resetConfirmKey, setResetConfirmKey] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // WhatsApp Templates Modal
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappClinic, setWhatsappClinic] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [deviceClinic, setDeviceClinic] = useState(null);

  // Quick-Fix & Issue Solver Toolkit States
  const [toolkitModalOpen, setToolkitModalOpen] = useState(false);
  const [toolkitClinic, setToolkitClinic] = useState(null);
  const [toolkitTab, setToolkitTab] = useState('solve'); // solve | password | modules | validity | seats
  const [newPasswordInput, setNewPasswordInput] = useState('Clinic@2026');
  const [selectedModules, setSelectedModules] = useState([]);
  const [extensionDays, setExtensionDays] = useState('30');
  const [seatLimitInput, setSeatLimitInput] = useState('1');
  const [isFixing, setIsFixing] = useState(false);
  const [liveClinicFilter, setLiveClinicFilter] = useState('all');

  // Queries
  const liveActivityQuery = useQuery({
    queryKey: ['tamilan-live-activity', liveClinicFilter],
    queryFn: async () => {
      const res = await api.get('/tamilan/live-activity', {
        params: { clinicId: liveClinicFilter }
      });
      return res?.data ?? res ?? { recentActivity: [], staff: [], todayOps: {}, todayFinance: {}, workstations: [], clinics: [] };
    },
    enabled: isAuthenticated,
    refetchInterval: 8_000
  });

  const statsQuery = useQuery({
    queryKey: ['tamilan-stats'],
    queryFn: async () => {
      const res = await api.get('/tamilan/stats');
      return res?.data ?? res ?? { totalClinics: 0, pendingApprovals: 0, activeClinics: 0, totalRevenue: 0, authorizedDevices: 0 };
    },
    enabled: isAuthenticated,
    refetchInterval: 10_000
  });

  const dbHealthQuery = useQuery({
    queryKey: ['tamilan-db-health'],
    queryFn: async () => {
      const res = await api.get('/tamilan/database-health');
      return res?.data ?? res ?? { totalTables: 48, databaseSize: '32 MB', counts: {} };
    },
    enabled: isAuthenticated && activeTab === 'database',
    refetchInterval: 15_000
  });

  const clinicsQuery = useQuery({
    queryKey: ['tamilan-clinics'],
    queryFn: async () => {
      const res = await api.get('/tamilan/clinics');
      const list = res?.data ?? res;
      return Array.isArray(list) ? list : [];
    },
    enabled: isAuthenticated,
    refetchInterval: 10_000
  });

  const paymentsQuery = useQuery({
    queryKey: ['tamilan-payments'],
    queryFn: async () => {
      const res = await api.get('/tamilan/payments');
      const list = res?.data ?? res;
      return Array.isArray(list) ? list : [];
    },
    enabled: isAuthenticated && activeTab === 'payments'
  });

  const clinicDevicesQuery = useQuery({
    queryKey: ['tamilan-clinic-devices', deviceClinic?.id],
    queryFn: async () => {
      const res = await api.get(`/tamilan/clinics/${deviceClinic.id}/devices`);
      const list = res?.data ?? res;
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(deviceClinic?.id)
  });

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const cleanKey = pinInput.trim().toLowerCase();
    if (cleanKey === 'tamilan' || cleanKey === '7788') {
      setAuthPin('tamilan');
      localStorage.setItem('tamilan_pin_session', 'tamilan');
      setPinError(false);
      toast.success('Welcome Master Platform Admin!');
    } else {
      setPinError(true);
      toast.error('Invalid Master Security Key. Please verify your credentials.');
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

  // 1. One-Click Support Impersonation: Enter Clinic Workspace to Solve Issues
  const handleImpersonate = async (clinic) => {
    try {
      const res = await api.post(`/tamilan/clinics/${clinic.id}/impersonate`);
      const { accessToken, clinic: clinicData } = res?.data || res;
      setAccessToken(accessToken);
      localStorage.setItem('zhanx_my_clinic_code', clinicData.clinicCode);
      sessionStorage.setItem(
        'tamilan_support_mode',
        JSON.stringify({
          clinicId: clinicData.id,
          clinicName: clinicData.clinicName,
          clinicCode: clinicData.clinicCode
        })
      );
      toast.success(`Entering ${clinicData.clinicName} workspace in Master Support Mode...`);
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (err) {
      toast.error(err.message || 'Failed to enter clinic workspace');
    }
  };

  // 2. Open Toolkit
  const openToolkit = (clinic) => {
    setToolkitClinic(clinic);
    setToolkitTab('solve');
    setNewPasswordInput('Clinic@2026');
    setSelectedModules(clinic.active_modules?.length ? clinic.active_modules : ALL_MODULES.map((m) => m.id));
    setExtensionDays('30');
    setSeatLimitInput(String(clinic.max_systems || 1));
    setToolkitModalOpen(true);
  };

  // 3. Reset Admin Password & Unlock Lockout
  const handleResetPassword = async () => {
    setIsFixing(true);
    try {
      const res = await api.post(`/tamilan/clinics/${toolkitClinic.id}/reset-admin-password`, {
        newPassword: newPasswordInput.trim()
      });
      toast.success(res.message || 'Password reset successfully!');
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsFixing(false);
    }
  };

  // 4. Update Clinical Modules
  const handleSaveModules = async () => {
    setIsFixing(true);
    try {
      await api.post(`/tamilan/clinics/${toolkitClinic.id}/modules`, {
        activeModules: selectedModules
      });
      toast.success('Clinical modules updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsFixing(false);
    }
  };

  // 5. Extend Validity
  const handleExtendValidity = async (days) => {
    setIsFixing(true);
    try {
      const res = await api.post(`/tamilan/clinics/${toolkitClinic.id}/extend-validity`, {
        daysToAdd: Number(days || extensionDays)
      });
      toast.success(res.message || 'Validity extended!');
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsFixing(false);
    }
  };

  // 6. Update Seat Limits
  const handleUpdateSeatLimit = async () => {
    setIsFixing(true);
    try {
      const res = await api.post(`/tamilan/clinics/${toolkitClinic.id}/seat-limit`, {
        maxSystems: Number(seatLimitInput)
      });
      toast.success(res.message || 'Seat limits updated!');
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsFixing(false);
    }
  };

  // 7. Reset all device hardware bindings
  const handleResetAllDevices = async () => {
    if (!window.confirm(`Are you sure you want to clear all workstation locks for ${toolkitClinic.clinic_name}?`)) return;
    setIsFixing(true);
    try {
      const res = await api.post(`/tamilan/clinics/${toolkitClinic.id}/reset-devices`);
      toast.success(res.message || 'Workstation locks cleared!');
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinic-devices'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsFixing(false);
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

  const handleDeleteClinic = async () => {
    if (!deleteConfirmClinic) return;
    setIsDeleting(true);
    try {
      await api.delete(`/tamilan/clinics/${deleteConfirmClinic.id}`);
      toast.success(`Clinic ${deleteConfirmClinic.clinic_name} permanently removed.`);
      setDeleteConfirmClinic(null);
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-stats'] });
    } catch (err) {
      toast.error(err.message || 'Failed to delete clinic');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFactoryReset = async () => {
    if (resetConfirmKey !== 'tamilan' && resetConfirmKey !== '7788') {
      toast.error('Invalid confirmation key. Please enter "tamilan" to confirm.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await api.post('/tamilan/factory-reset', { confirmationKey: resetConfirmKey });
      toast.success(res?.message || 'All clinics and data purged! System is 100% fresh.');
      setFactoryResetModalOpen(false);
      setResetConfirmKey('');
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Factory reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreateClinic = async (e) => {
    e.preventDefault();
    if (!createForm.clinicName.trim() || !createForm.doctorName.trim() || !createForm.mobile.trim()) {
      toast.error('Clinic name, doctor name, and mobile number are mandatory.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await api.post('/tamilan/clinics', {
        clinicName: createForm.clinicName.trim(),
        doctorName: createForm.doctorName.trim(),
        mobile: createForm.mobile.trim(),
        email: createForm.email.trim() || null,
        city: createForm.city.trim() || null,
        address: createForm.address.trim() || null,
        planName: createForm.planName,
        maxSystems: Number(createForm.maxSystems),
        durationMonths: Number(createForm.durationMonths),
        initialPassword: createForm.initialPassword.trim() || 'Admin@12345',
        activeModules: createForm.activeModules
      });

      toast.success(`Clinic ${createForm.clinicName} onboarded and activated!`);
      setCreatedData(res);
      setCreateModalOpen(false);
      setCreatedResultModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['tamilan-stats'] });

      // Reset form
      setCreateForm({
        clinicName: '',
        doctorName: '',
        mobile: '',
        email: '',
        city: '',
        address: '',
        planName: 'Growth Plan (₹28,000 / 3 Workstations / 1 Year)',
        maxSystems: '3',
        durationMonths: '12',
        initialPassword: 'Admin@12345',
        activeModules: ALL_MODULES.map((m) => m.id)
      });
    } catch (err) {
      toast.error(err.message || 'Failed to onboard clinic');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const sendWhatsAppMessage = (clinic, templateType) => {
    const clean = (clinic.mobile || '').replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    let message = '';
    const origin = window.location.origin;

    if (templateType === 'welcome') {
      message = `Vanakkam Dr. ${clinic.doctor_name}! Welcome to ZhanX DentalCare.
Your clinic workspace is officially activated and ready for clinical use!

🏥 Clinic: ${clinic.clinic_name}
🔑 Clinic Code: ${clinic.clinic_code}
💻 Authorized Systems: ${clinic.max_systems || 1} workstation(s)
🌐 Web Portal: ${origin}/
🗓️ License Valid Until: ${clinic.valid_until ? formatDate(clinic.valid_until) : '1 Year Active'}

For any onboarding support or printer/LAN setup, we are glad to help!`;
    } else if (templateType === 'expiry') {
      message = `Vanakkam Dr. ${clinic.doctor_name}, this is Master Admin regarding ZhanX DentalCare for ${clinic.clinic_name}.
Your clinical subscription is valid until ${clinic.valid_until ? formatDate(clinic.valid_until) : 'Upcoming Date'}.
Kindly complete the license renewal to avoid disruption to dental charts, appointments, and billing modules.
Contact us here for invoice and UPI/Bank transfer details. Thank you!`;
    } else {
      message = `Vanakkam Dr. ${clinic.doctor_name}, Master Support is checking in on ${clinic.clinic_name}.
If you or your staff have any questions regarding patient charts, prescriptions, multi-system networking or billing, reply to this message anytime.`;
    }

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const openWhatsApp = (clinic) => {
    setWhatsappClinic(clinic);
    setWhatsappModalOpen(true);
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

  // Master Authentication Gate Screen
  if (!isAuthenticated) {
    return (
      <main className="relative flex min-h-screen min-h-[100dvh] overflow-y-auto bg-[#0b1220] text-white selection:bg-teal-500 selection:text-white">
        {/* Background Image & Ambient Gradients */}
        <img
          src="/bg_img.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-60"
        />
        <div
          className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#0b1220]/95 via-[#0f172a]/85 to-[#0b1220]/60"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            backgroundImage:
              'radial-gradient(1100px 600px at -10% -10%, rgba(0,157,166,0.22), transparent 60%), radial-gradient(900px 560px at 110% 115%, rgba(14,165,233,0.18), transparent 55%)'
          }}
          aria-hidden="true"
        />

        {/* Left Branding Column (Visible on Desktop) */}
        <section className="relative hidden w-[48%] flex-col justify-between p-10 lg:flex xl:p-14 z-10">
          <div>
            <div className="flex items-center gap-3">
              <Logo className="h-11 w-11" />
              <span className="leading-tight">
                <span className="block font-display text-lg font-extrabold tracking-tight text-white">
                  ZHANX <span className="bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent">DENTALCARE</span>
                </span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400">
                  Master Platform Console
                </span>
              </span>
            </div>

            <div className="mt-14 max-w-md">
              <div className="mb-4">
                <img
                  src={heroTooth}
                  alt="Doccure 3D Mascot"
                  className="size-24 object-contain animate-float-doccure drop-shadow-[0_15px_30px_rgba(0,157,166,0.4)]"
                />
              </div>

              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-teal-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Enterprise Multi-Tenant SaaS
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl text-white">
                Master control,
                <br />
                <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-white bg-clip-text text-transparent">
                  governed simply.
                </span>
              </h1>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-slate-300">
                Centralized multi-clinic tenant provisioning, licensing approvals, automated database health telemetry, and subscription enforcement for all ZhanX practices.
              </p>
            </div>

            <ul className="mt-10 grid grid-cols-2 gap-4">
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-teal-400">
                  <Building2 size={18} />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs font-bold text-white">Clinic Provisioning</span>
                  <span className="block text-[11px] text-slate-400">Instant tenant setup</span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-teal-400">
                  <CheckCircle2 size={18} />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs font-bold text-white">Pending Approvals</span>
                  <span className="block text-[11px] text-slate-400">One-click activation</span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-teal-400">
                  <Database size={18} />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs font-bold text-white">Database Health</span>
                  <span className="block text-[11px] text-slate-400">Live storage monitoring</span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-teal-400">
                  <Activity size={18} />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs font-bold text-white">Realtime Telemetry</span>
                  <span className="block text-[11px] text-slate-400">Live clinical actions</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ZhanX SaaS Engine v2.4.0 · Tamilan Edition</span>
            <span>Secured with AES-256</span>
          </div>
        </section>

        {/* Right Form Column */}
        <section className="relative flex flex-1 items-center justify-center p-6 sm:p-10 z-10">
          <div className="w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900/85 p-8 shadow-2xl backdrop-blur-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#009da6] to-[#08636d] text-white shadow-lg shadow-teal-500/25">
                <ShieldCheck size={28} />
              </div>

              <span className="mt-4 inline-block rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-300">
                Super Admin Access
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                Master Platform Login
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Sign in to manage multi-clinic workspaces, subscriptions, and system operations.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Master Security Key
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={pinInput}
                    autoFocus
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinError) setPinError(false);
                    }}
                    placeholder="Enter master authorization key"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-11 py-3 text-sm font-semibold text-white placeholder-slate-500 focus:border-[#009da6] focus:outline-none focus:ring-2 focus:ring-[#009da6]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {pinError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs font-medium text-rose-400">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Invalid Master Authorization Key. Access denied.</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009da6] to-[#08636d] py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/25 hover:opacity-95 active:scale-98 transition cursor-pointer"
              >
                <span>Unlock Master Console</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition"
              >
                <span>← Back to Clinic Workstation Login</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
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
              MASTER COMMAND CENTER · LIVE CLINIC DIAGNOSTICS &amp; SUPPORT
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Clinic Operations &amp; Issue Resolution Console
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Monitor what each clinic is using, enter any clinic workspace in 1-click to solve problems, reset passwords, manage workstation locks, and configure live modules.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#08636d] hover:bg-teal-50 shadow-lg shadow-teal-950/20 transition cursor-pointer"
            >
              <PlusCircle size={15} className="text-[#009da6]" />
              + Onboard New Clinic
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('tamilan_pin_session');
                setAuthPin('');
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-black text-white hover:bg-white/25 backdrop-blur-sm transition border border-white/20 cursor-pointer"
            >
              <Lock size={13} />
              Lock Console
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
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
              onClick={() => setActiveTab('live')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Activity size={13} className="text-[#0a7f8b]" />
              Live Clinic Pulse &amp; Staff Actions
            </button>
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
              onClick={() => setActiveTab('database')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Database size={13} />
              System &amp; DB Health
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
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-3.5 py-1.5 text-xs font-black text-white hover:opacity-95 shadow-xs transition cursor-pointer"
            >
              <Plus size={14} />
              Onboard Clinic
            </button>
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['tamilan-live-activity'] });
                queryClient.invalidateQueries({ queryKey: ['tamilan-clinics'] });
                queryClient.invalidateQueries({ queryKey: ['tamilan-stats'] });
                queryClient.invalidateQueries({ queryKey: ['tamilan-db-health'] });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition shadow-2xs cursor-pointer"
              title="Refresh Registry"
            >
              <RefreshCw size={14} className={liveActivityQuery.isFetching || clinicsQuery.isFetching ? 'animate-spin text-[#0a7f8b]' : ''} />
            </button>
          </div>
        </div>

        {activeTab === 'live' ? (
          /* Live Clinic Pulse & Staff Activity Feed */
          <div className="space-y-6">
            {/* Today's Pulse Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 dark:border-emerald-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Today's Revenue</span>
                  <Wallet size={18} className="text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(liveActivityQuery.data?.todayFinance?.total_collected || 0)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] font-bold text-slate-500">
                  <span>Cash: {formatMoney(liveActivityQuery.data?.todayFinance?.cash_collected || 0)}</span>
                  <span>·</span>
                  <span>UPI: {formatMoney(liveActivityQuery.data?.todayFinance?.upi_collected || 0)}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent p-4 dark:border-teal-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#0a7f8b] dark:text-teal-300">Appointments Today</span>
                  <Calendar size={18} className="text-[#0a7f8b]" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {liveActivityQuery.data?.todayOps?.today_appointments ?? 0}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">Booked &amp; walk-in consultations</p>
              </div>

              <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-4 dark:border-blue-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Invoices Billed</span>
                  <FileText size={18} className="text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {liveActivityQuery.data?.todayOps?.today_invoices ?? 0}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">Receipts created at checkout</p>
              </div>

              <div className="rounded-3xl border border-purple-200/80 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-4 dark:border-purple-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">New Registrations</span>
                  <Users size={18} className="text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {liveActivityQuery.data?.todayOps?.today_new_patients ?? 0}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">New dental files created today</p>
              </div>
            </div>

            {/* Split Grid: Live Staff Audit Stream on Left, Staff Roster on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Live Staff Activity Feed (2 Cols) */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity size={16} className="text-[#0a7f8b] animate-pulse" />
                      Live Staff Activity Stream ("Who Did What in Which Clinic?")
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time chronological telemetry across all active dental clinics in India.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Clinic Filter Dropdown */}
                    <select
                      value={liveClinicFilter}
                      onChange={(e) => setLiveClinicFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    >
                      <option value="all">🏢 All Clinics ({liveActivityQuery.data?.clinics?.length || 0})</option>
                      {(liveActivityQuery.data?.clinics || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.clinic_name} ({c.clinic_code})
                        </option>
                      ))}
                    </select>

                    <div className="relative min-w-[180px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        placeholder="Filter staff or action..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Audit Stream List */}
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {(liveActivityQuery.data?.recentActivity || [])
                    .filter((a) => {
                      if (!activitySearch.trim()) return true;
                      const q = activitySearch.toLowerCase();
                      return (
                        (a.username || '').toLowerCase().includes(q) ||
                        (a.staff_name || '').toLowerCase().includes(q) ||
                        (a.action || '').toLowerCase().includes(q) ||
                        (a.clinic_name || '').toLowerCase().includes(q) ||
                        (a.entity_type || '').toLowerCase().includes(q)
                      );
                    })
                    .map((act) => {
                      const isDanger = /delete|void|cancel|lock|remove/.test(act.action);
                      const isSuccess = /create|collect|approve|paid|complete/.test(act.action);

                      return (
                        <div
                          key={act.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-[#0a7f8b] transition dark:bg-slate-850 dark:border-slate-800"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
                              isDanger
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                                : isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-teal-50 text-[#0a7f8b] border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300'
                            }`}>
                              {act.username?.slice(0, 2).toUpperCase() || 'ST'}
                            </div>
                            <div className="space-y-1">
                              {/* Clinic Badge & Staff Identity */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {act.clinic_name ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-[#0a7f8b] border border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40">
                                    🏥 {act.clinic_name} ({act.clinic_code})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
                                    🏢 System / Master
                                  </span>
                                )}

                                <span className="font-black text-slate-800 dark:text-slate-100 text-xs">
                                  {act.staff_name ? `${act.staff_name} (@${act.username || 'staff'})` : `@${act.username || 'system'}`}
                                </span>

                                {act.staff_role && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {act.staff_role}
                                  </span>
                                )}

                                <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                  isDanger ? 'bg-rose-100 text-rose-800' : isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {act.action}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 font-mono">
                                Target: {act.entity_type} {act.entity_id ? `(#${String(act.entity_id).slice(0, 8)})` : ''}
                              </p>
                              {act.details && (
                                <p className="text-[10.5px] text-slate-400 truncate max-w-md">
                                  {typeof act.details === 'object' ? JSON.stringify(act.details) : act.details}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="block text-[10.5px] font-bold text-slate-500 tabular-nums">
                              {formatDateTime(act.created_at)}
                            </span>
                            {act.ip && (
                              <span className="block text-[9.5px] font-mono text-slate-400">
                                IP: {act.ip}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {(liveActivityQuery.data?.recentActivity || []).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      No activity events logged yet today.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Staff Roster & Connected Workstations */}
              <div className="space-y-5">
                {/* Staff Roster Box */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:bg-slate-850 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                      <UserCheck size={14} className="text-[#0a7f8b]" />
                      Clinic Staff Roster
                    </h4>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {(liveActivityQuery.data?.staff || []).length} Users
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {(liveActivityQuery.data?.staff || []).map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50/80 p-2.5 text-xs dark:bg-slate-800/50"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {u.full_name}
                            <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </p>
                          <p className="text-[10.5px] text-slate-400">
                            @{u.username} · <span className="font-semibold text-[#0a7f8b]">{u.role_name || u.role_code}</span>
                          </p>
                          {u.clinic_name && (
                            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                              🏥 {u.clinic_name} ({u.clinic_code})
                            </p>
                          )}
                        </div>
                        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-200/60 dark:bg-slate-700">
                          {u.last_login_at ? formatDate(u.last_login_at) : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workstations Box */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:bg-slate-850 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Laptop size={14} className="text-[#0a7f8b]" />
                      Active Systems &amp; Workstations
                    </h4>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-[#0a7f8b]">
                      {(liveActivityQuery.data?.workstations || []).length} Connected
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {(liveActivityQuery.data?.workstations || []).map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50/80 p-2.5 text-xs dark:bg-slate-800/50"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Monitor size={12} className="text-[#0a7f8b]" />
                            {w.device_name || 'Clinic Workstation'}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            OS: {w.os_platform || 'Windows'} · Seen: {formatDateTime(w.last_seen_at)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Linked
                        </span>
                      </div>
                    ))}

                    {(liveActivityQuery.data?.workstations || []).length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        Primary browser active.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'clinics' ? (
          <>
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[260px] max-w-md">
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

                        {/* LIVE USAGE TELEMETRY (What they are using) */}
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/90 p-2.5 text-center text-xs dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Patients</span>
                            <span className="font-black text-sm text-slate-800 dark:text-white tabular-nums">
                              {c.patient_count ?? 0}
                            </span>
                          </div>
                          <div className="border-x border-slate-200/80 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Appts</span>
                            <span className="font-black text-sm text-[#0a7f8b] dark:text-teal-300 tabular-nums">
                              {c.appointment_count ?? 0}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Invoices</span>
                            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {c.invoice_count ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Workstations / Seat Lock */}
                        <div className="mt-3 rounded-2xl bg-teal-50/50 p-2.5 border border-teal-100/70 text-xs dark:bg-teal-950/20 dark:border-teal-900/40">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                              <Laptop size={13} className="text-[#0a7f8b]" />
                              Authorized Workstations:
                            </span>
                            <span className={`font-black font-mono px-2 py-0.5 rounded-lg text-[11px] ${
                              activeDevices >= maxSystems
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-white text-[#0a7f8b] border border-teal-200'
                            }`}>
                              {activeDevices} / {maxSystems} system{maxSystems === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        {/* Validity & Amount */}
                        <div className="mt-2.5 space-y-1 rounded-2xl bg-slate-50/80 p-2.5 text-xs dark:bg-slate-800/40">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-400">Valid Until:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {c.valid_until ? formatDate(c.valid_until) : 'Not Activated'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-400">Total Collected:</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatMoney(c.amount_paid)}
                            </span>
                          </div>
                        </div>

                        {/* Active Modules Chips */}
                        <div className="mt-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(c.active_modules?.length ? c.active_modules : c.requested_modules || []).slice(0, 4).map((mod) => (
                              <span key={mod} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {mod}
                              </span>
                            ))}
                            {(c.active_modules?.length ? c.active_modules : c.requested_modules || []).length > 4 && (
                              <span className="rounded-md bg-teal-50 px-1 py-0.5 text-[9.5px] font-bold text-[#0a7f8b]">
                                +{(c.active_modules?.length ? c.active_modules : c.requested_modules || []).length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {/* Solve Issue / Open Workspace */}
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleImpersonate(c)}
                              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:from-teal-600 hover:to-cyan-700 transition cursor-pointer"
                              title="Enter Clinic Workspace in Master Support Mode to troubleshoot or solve any problem"
                            >
                              <ExternalLink size={12} />
                              <span>Solve in Workspace</span>
                            </button>
                          )}

                          {/* Quick-Fix Toolkit Modal Button */}
                          <button
                            type="button"
                            onClick={() => openToolkit(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs"
                            title="Master Diagnostics & Quick Fix Toolkit"
                          >
                            <Wrench size={13} />
                          </button>

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
                            onClick={() => setDeleteConfirmClinic(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                            title="Delete & Purge Clinic Tenant"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openActivation(c)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-3 py-1.5 text-xs font-black text-white hover:opacity-95 shadow-sm transition cursor-pointer"
                          >
                            <CreditCard size={12} />
                            {isPending ? 'Approve & Activate' : 'Renew / License'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : activeTab === 'payments' ? (
          /* Payments Ledger */
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Master Admin Fee Collection History
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
        ) : (
          /* System & Database Health Tab */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Database size={16} className="text-[#0a7f8b]" />
                  Central Database &amp; System Health Telemetry
                </h3>
                <p className="text-xs text-slate-400">
                  Live database storage consumption, total records across all clinics, and cloud uptime metrics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['tamilan-db-health'] })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <RefreshCw size={12} className={dbHealthQuery.isFetching ? 'animate-spin text-[#0a7f8b]' : ''} />
                Refresh DB Stats
              </button>
            </div>

            {/* Health KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 dark:bg-teal-950/20 dark:border-teal-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#0a7f8b]">DB Storage Used</span>
                  <HardDrive size={18} className="text-[#0a7f8b]" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.databaseSize || '32 MB'}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">PostgreSQL on-disk footprint</p>
              </div>

              <div className="rounded-2xl border border-purple-200/80 bg-purple-50/50 p-4 dark:bg-purple-950/20 dark:border-purple-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">Schema Tables</span>
                  <Database size={18} className="text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.totalTables || 48} tables
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">Base clinical &amp; billing schema</p>
              </div>

              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total Patients</span>
                  <Users size={18} className="text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.counts?.total_patients ?? 0}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">Stored across all clinics</p>
              </div>

              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 dark:bg-blue-950/20 dark:border-blue-900/40">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Total Appts</span>
                  <Calendar size={18} className="text-blue-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.counts?.total_appointments ?? 0}
                </p>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1">Clinical consultations scheduled</p>
              </div>
            </div>

            {/* Platform Wide Record Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:bg-slate-800 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <FileText size={15} className="text-[#0a7f8b]" />
                  <span>Financial Invoices &amp; Receipts</span>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.counts?.total_invoices ?? 0} generated
                </p>
                <p className="text-[11px] text-slate-400">All procedure billings and GST receipts</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:bg-slate-800 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Activity size={15} className="text-emerald-600" />
                  <span>Dental Prescriptions</span>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.counts?.total_prescriptions ?? 0} issued
                </p>
                <p className="text-[11px] text-slate-400">Digital and stylus signed dental Rx</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:bg-slate-800 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <UserCheck size={15} className="text-purple-600" />
                  <span>Doctors &amp; Clinical Staff</span>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {dbHealthQuery.data?.counts?.total_users ?? 0} active users
                </p>
                <p className="text-[11px] text-slate-400">Multi-clinic admin and doctor accounts</p>
              </div>
            </div>

            {/* Cloud Architecture Status */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:bg-slate-800/40 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Server size={14} className="text-[#0a7f8b]" />
                Live Cloud Deployment Architecture
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:bg-slate-900 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Backend Web Service</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live / Healthy
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[#0a7f8b] mt-1 truncate">dhms-73i8.onrender.com</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Node.js Express + REST Engine</p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:bg-slate-900 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Relational Database</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-purple-600 mt-1 truncate">PostgreSQL 18 (SSL Enabled)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Connection pooling &amp; multi-tenancy</p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:bg-slate-900 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Frontend Web Host</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Global CDN
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-teal-600 mt-1 truncate">dhmsn.netlify.app</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">React 19 + Vite 6 + PWA ready</p>
                </div>
              </div>
            </div>

            {/* Danger Zone: Master Factory Reset */}
            <div className="rounded-3xl border border-rose-300/80 bg-rose-50/40 p-5 dark:bg-rose-950/20 dark:border-rose-900/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <Trash2 size={16} />
                    Danger Zone: Master Factory Reset (Start 100% Fresh)
                  </h4>
                  <p className="text-xs text-rose-800/80 dark:text-rose-300/80 max-w-2xl leading-relaxed">
                    Purge all clinic tenants, user accounts, patients, appointments, dental charts, prescriptions, and invoices. Master roles and permissions are preserved so clinics can register fresh from scratch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirmKey('');
                    setFactoryResetModalOpen(true);
                  }}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  Wipe All Data &amp; Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MASTER ISSUE RESOLUTION & DIAGNOSTICS TOOLKIT MODAL                       */}
      {/* ========================================================================= */}
      <Modal
        open={toolkitModalOpen}
        onClose={() => setToolkitModalOpen(false)}
        title={toolkitClinic ? `Troubleshoot & Fix: ${toolkitClinic.clinic_name}` : 'Clinic Issue Resolution'}
        subtitle="One-stop master tools to solve passwords, module locks, workstation limits, and validity issues."
        size="lg"
      >
        {toolkitClinic && (
          <div className="space-y-4">
            {/* Top Diagnostics Card */}
            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 text-xs dark:bg-purple-950/20 dark:border-purple-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200/60 pb-2.5">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm">{toolkitClinic.clinic_name}</h4>
                  <p className="text-slate-500 mt-0.5 font-mono">{toolkitClinic.clinic_code} · {toolkitClinic.doctor_name} · {toolkitClinic.mobile}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleImpersonate(toolkitClinic)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-95 shadow-sm transition cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Launch Workspace &amp; Fix</span>
                </button>
              </div>

              {/* Telemetry Row */}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-white/80 p-2 dark:bg-slate-900/60">
                  <span className="block text-[10px] font-bold text-slate-400">Patients</span>
                  <span className="font-black text-sm text-slate-800 dark:text-white">{toolkitClinic.patient_count ?? 0}</span>
                </div>
                <div className="rounded-xl bg-white/80 p-2 dark:bg-slate-900/60">
                  <span className="block text-[10px] font-bold text-slate-400">Appointments</span>
                  <span className="font-black text-sm text-[#0a7f8b] dark:text-teal-300">{toolkitClinic.appointment_count ?? 0}</span>
                </div>
                <div className="rounded-xl bg-white/80 p-2 dark:bg-slate-900/60">
                  <span className="block text-[10px] font-bold text-slate-400">Invoices</span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{toolkitClinic.invoice_count ?? 0}</span>
                </div>
                <div className="rounded-xl bg-white/80 p-2 dark:bg-slate-900/60">
                  <span className="block text-[10px] font-bold text-slate-400">Workstations</span>
                  <span className="font-black text-sm text-purple-600 dark:text-purple-400">{toolkitClinic.active_devices_count ?? 0}/{toolkitClinic.max_systems}</span>
                </div>
              </div>
            </div>

            {/* Sub-tabs for toolkit actions */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => setToolkitTab('solve')}
                className={`pb-2 text-xs font-bold transition cursor-pointer ${
                  toolkitTab === 'solve'
                    ? 'border-b-2 border-purple-600 text-purple-700 dark:text-purple-300'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                1. Password &amp; Lockout Fix
              </button>
              <button
                type="button"
                onClick={() => setToolkitTab('modules')}
                className={`pb-2 text-xs font-bold transition cursor-pointer ${
                  toolkitTab === 'modules'
                    ? 'border-b-2 border-purple-600 text-purple-700 dark:text-purple-300'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                2. Clinical Modules ({selectedModules.length})
              </button>
              <button
                type="button"
                onClick={() => setToolkitTab('seats')}
                className={`pb-2 text-xs font-bold transition cursor-pointer ${
                  toolkitTab === 'seats'
                    ? 'border-b-2 border-purple-600 text-purple-700 dark:text-purple-300'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                3. Workstation Hardware Lock
              </button>
              <button
                type="button"
                onClick={() => setToolkitTab('validity')}
                className={`pb-2 text-xs font-bold transition cursor-pointer ${
                  toolkitTab === 'validity'
                    ? 'border-b-2 border-purple-600 text-purple-700 dark:text-purple-300'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                4. Subscription Extension
              </button>
            </div>

            {/* TAB 1: Password & Lockout Fix */}
            {toolkitTab === 'solve' && (
              <div className="space-y-3.5 py-1 text-xs">
                <p className="text-slate-500 text-[11.5px]">
                  If the doctor forgot their password or had multiple failed logins resulting in an account lockout, you can reset it instantly here:
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new password (e.g. Clinic@2026)"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs font-bold text-slate-800 focus:border-purple-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={handleResetPassword}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-black text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Unlock size={13} />
                    <span>Reset Password &amp; Clear Lockout</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Modules Manager */}
            {toolkitTab === 'modules' && (
              <div className="space-y-3 py-1 text-xs">
                <p className="text-slate-500 text-[11.5px]">
                  Enable or disable specific dental features for this clinic in real-time without re-deploying:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {ALL_MODULES.map((m) => {
                    const checked = selectedModules.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition ${
                          checked
                            ? 'border-purple-500 bg-purple-50/70 text-slate-900 font-bold dark:bg-purple-950/40 dark:text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedModules, m.id]
                              : selectedModules.filter((id) => id !== m.id);
                            setSelectedModules(next);
                          }}
                          className="mt-0.5 rounded text-purple-600 focus:ring-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs truncate">{m.label}</p>
                          <p className="text-[10px] text-slate-400 truncate font-normal">{m.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={handleSaveModules}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-black text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>Save Feature Modules</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Workstations & Hardware Lock */}
            {toolkitTab === 'seats' && (
              <div className="space-y-3.5 py-1 text-xs">
                <p className="text-slate-500 text-[11.5px]">
                  Manage how many computers this clinic can run on simultaneously, or unbind all PCs if they bought new hardware:
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-48">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Workstation Quota</label>
                    <select
                      value={seatLimitInput}
                      onChange={(e) => setSeatLimitInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 focus:border-purple-600 focus:outline-none"
                    >
                      <option value="1">1 Computer (Strict Single Seat)</option>
                      <option value="2">2 Computers (Reception + Chair)</option>
                      <option value="3">3 Computers (Reception + 2 Chairs)</option>
                      <option value="5">5 Computers (Hospital Setup)</option>
                      <option value="10">10 Computers (Enterprise)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={handleUpdateSeatLimit}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-black text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <span>Update Seat Limit</span>
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">Hardware Lock Emergency Reset</p>
                      <p className="text-[11px] text-slate-400">If the clinic replaced their computers or reinstalled Windows and are locked out:</p>
                    </div>
                    <button
                      type="button"
                      disabled={isFixing}
                      onClick={handleResetAllDevices}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                    >
                      <AlertTriangle size={13} />
                      <span>Clear All PC Bindings</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Subscription Validity */}
            {toolkitTab === 'validity' && (
              <div className="space-y-3.5 py-1 text-xs">
                <p className="text-slate-500 text-[11.5px]">
                  Extend subscription validity or grant bonus trial days with a single click:
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={() => handleExtendValidity(30)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3.5 py-2 text-xs font-bold text-purple-700 transition cursor-pointer"
                  >
                    <span>+30 Days</span>
                  </button>
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={() => handleExtendValidity(90)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3.5 py-2 text-xs font-bold text-purple-700 transition cursor-pointer"
                  >
                    <span>+90 Days (Quarterly)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isFixing}
                    onClick={() => handleExtendValidity(365)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-black text-white transition shadow-sm cursor-pointer"
                  >
                    <span>+1 Year (365 Days)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

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
            <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4 text-xs">
              <p className="font-black text-slate-900 text-sm">{selectedClinic.clinic_name} ({selectedClinic.clinic_code})</p>
              <p className="text-slate-600 mt-0.5 font-medium">Doctor: {selectedClinic.doctor_name} · Mobile: {selectedClinic.mobile}</p>
            </div>

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

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Feature Modules Granted ({activationForm.activeModules.length} selected)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {ALL_MODULES.map((m) => {
                    const checked = activationForm.activeModules.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-start gap-2 rounded-xl border p-2 text-xs cursor-pointer transition ${
                          checked
                            ? 'border-teal-500 bg-teal-50/60 text-slate-900 font-bold'
                            : 'border-slate-200 bg-slate-50/60 text-slate-400 hover:border-slate-300'
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
                          className="mt-0.5 rounded text-[#009da6] focus:ring-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{m.label}</p>
                          <p className="text-[10px] text-slate-400 font-normal truncate">{m.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Private Admin Notes
                </label>
                <textarea
                  rows={2}
                  value={activationForm.notes}
                  onChange={(e) => setActivationForm({ ...activationForm, notes: e.target.value })}
                  placeholder="Add notes about payment or license agreement..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#009da6] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Authorized Devices / Seat Lock Inspection Modal */}
      <Modal
        open={devicesModalOpen}
        onClose={() => setDevicesModalOpen(false)}
        title={deviceClinic ? `Hardware Workstations: ${deviceClinic.clinic_name}` : 'Authorized Workstations'}
        subtitle={`Provisioned for ${deviceClinic?.max_systems || 1} workstation seat(s). You can revoke broken or replaced computers.`}
        size="md"
      >
        <div className="space-y-3">
          {clinicDevicesQuery.isLoading ? (
            <div className="py-8 text-center">
              <RefreshCw size={20} className="mx-auto animate-spin text-[#0a7f8b]" />
            </div>
          ) : (clinicDevicesQuery.data || []).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <Laptop size={32} className="mx-auto text-slate-300 mb-2" />
              No computers currently bound to this clinic workspace.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(clinicDevicesQuery.data || []).map((dev) => (
                <div key={dev.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Monitor size={13} className="text-[#0a7f8b]" />
                      {dev.device_name || 'Clinic Workstation'}
                    </p>
                    <p className="text-[10.5px] font-mono text-slate-400">
                      ID: {dev.device_fingerprint} · OS: {dev.os_platform || 'Windows'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Last seen: {formatDateTime(dev.last_seen_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => revokeDevice(dev.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <X size={12} />
                    <span>Revoke Seat</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 1. DIRECT ONBOARDING MODAL */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Direct Clinic Onboarding & Provisioning"
        subtitle="Instantly register, license and provision an active clinic workspace."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateClinic}
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-5 py-2 text-xs font-black text-white hover:opacity-95 shadow-md shadow-teal-700/25 transition cursor-pointer disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Provisioning Clinic...
                </>
              ) : (
                <>
                  <PlusCircle size={14} />
                  Provision &amp; Activate Clinic
                </>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateClinic} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinic Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={createForm.clinicName}
                onChange={(e) => setCreateForm({ ...createForm, clinicName: e.target.value })}
                placeholder="e.g. Apex Multispeciality Dental"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Doctor / Owner Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={createForm.doctorName}
                onChange={(e) => setCreateForm({ ...createForm, doctorName: e.target.value })}
                placeholder="e.g. Dr. K. Ramesh MDS"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Number (WhatsApp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={createForm.mobile}
                onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Doctor Email (Optional)
              </label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="doctor@clinic.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                City / Location
              </label>
              <input
                type="text"
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                placeholder="e.g. Chennai, Coimbatore, Madurai"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Initial Admin Password
              </label>
              <input
                type="text"
                value={createForm.initialPassword}
                onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
                placeholder="Admin@12345"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Subscription Plan
              </label>
              <select
                value={createForm.planName}
                onChange={(e) => setCreateForm({ ...createForm, planName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
              >
                <option value="Starter Plan (₹15,000 / 1 Workstation / 1 Year)">Starter Plan (₹15,000 / 1 Workstation)</option>
                <option value="Growth Plan (₹28,000 / 3 Workstations / 1 Year)">Growth Plan (₹28,000 / 3 Workstations)</option>
                <option value="Enterprise Plan (₹45,000 / Unlimited / 1 Year)">Enterprise Plan (₹45,000 / Unlimited Workstations)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Workstation Seats Limit
              </label>
              <select
                value={createForm.maxSystems}
                onChange={(e) => setCreateForm({ ...createForm, maxSystems: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
              >
                <option value="1">1 System (Single Chair / Laptop)</option>
                <option value="2">2 Systems (Reception + Dental Chair)</option>
                <option value="3">3 Systems (Reception + 2 Operatories)</option>
                <option value="5">5 Systems (Hospital Multi-room)</option>
                <option value="10">10 Systems (Full Enterprise Network)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Validity Duration
              </label>
              <select
                value={createForm.durationMonths}
                onChange={(e) => setCreateForm({ ...createForm, durationMonths: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
              >
                <option value="1">1 Month Trial / Evaluation</option>
                <option value="3">3 Months (Quarterly)</option>
                <option value="6">6 Months (Semi-Annual)</option>
                <option value="12">12 Months (Full 1-Year License)</option>
                <option value="24">24 Months (2-Year Enterprise)</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* 2. CREATED CLINIC SUCCESS / CREDENTIALS MODAL */}
      <Modal
        open={createdResultModalOpen}
        onClose={() => setCreatedResultModalOpen(false)}
        title="Clinic Provisioned & Ready!"
        subtitle="Account and workspace have been successfully initialized."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreatedResultModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Close
            </button>
            {createdData?.data && (
              <button
                type="button"
                onClick={() => sendWhatsAppMessage(createdData.data, 'welcome')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm"
              >
                <MessageCircle size={14} />
                Send to WhatsApp
              </button>
            )}
          </div>
        }
      >
        {createdData && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-center space-y-1">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-black text-slate-900 text-base mt-2">
                {createdData.data?.clinic_name}
              </h4>
              <p className="text-xs text-slate-600">
                Dr. {createdData.data?.doctor_name} · {createdData.data?.mobile}
              </p>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Clinic Code:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-[#0a7f8b] text-sm">
                    {createdData.credentials?.clinicCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdData.credentials?.clinicCode, 'Clinic Code')}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Copy"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Admin Username:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800">
                    {createdData.credentials?.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdData.credentials?.username, 'Username')}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Copy"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800">
                    {createdData.credentials?.password}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdData.credentials?.password, 'Password')}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Copy"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Workstation Seats:</span>
                <span className="font-mono font-bold text-slate-800">
                  {createdData.data?.max_systems} System(s)
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. DELETE CLINIC CONFIRMATION MODAL */}
      <Modal
        open={Boolean(deleteConfirmClinic)}
        onClose={() => setDeleteConfirmClinic(null)}
        title="Delete Clinic Tenant"
        subtitle="Irreversible super admin deletion."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmClinic(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteClinic}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        }
      >
        {deleteConfirmClinic && (
          <div className="space-y-3 text-xs">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 space-y-1">
              <p className="font-black text-sm">
                Permanently purge {deleteConfirmClinic.clinic_name}?
              </p>
              <p className="text-[11px] leading-relaxed">
                Clinic Code: <strong className="font-mono">{deleteConfirmClinic.clinic_code}</strong>.
                This will delete all staff users, registered workstations, and license history for this clinic.
              </p>
            </div>
            <p className="text-slate-500 text-[11px]">
              This action cannot be undone. Are you sure you wish to proceed?
            </p>
          </div>
        )}
      </Modal>

      {/* 4. WHATSAPP COMMUNICATION HUB MODAL */}
      <Modal
        open={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title={whatsappClinic ? `WhatsApp Doctor: ${whatsappClinic.doctor_name}` : 'WhatsApp Hub'}
        subtitle={`Message ${whatsappClinic?.clinic_name} (${whatsappClinic?.mobile})`}
        size="md"
      >
        {whatsappClinic && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-500 font-medium">
              Choose a message template to send directly via WhatsApp:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  sendWhatsAppMessage(whatsappClinic, 'welcome');
                  setWhatsappModalOpen(false);
                }}
                className="w-full text-left rounded-2xl border border-slate-200 p-3.5 hover:border-emerald-500 hover:bg-emerald-50/40 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 group-hover:text-emerald-700">
                    1. Welcome &amp; Workspace Login Details
                  </span>
                  <MessageCircle size={14} className="text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Sends clinic code, portal link, and authorized workstations greeting.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  sendWhatsAppMessage(whatsappClinic, 'expiry');
                  setWhatsappModalOpen(false);
                }}
                className="w-full text-left rounded-2xl border border-slate-200 p-3.5 hover:border-amber-500 hover:bg-amber-50/40 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 group-hover:text-amber-700">
                    2. License Renewal &amp; Expiry Reminder
                  </span>
                  <CalendarClock size={14} className="text-amber-600" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Alerts the doctor that subscription is due with bank/UPI payment details.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  sendWhatsAppMessage(whatsappClinic, 'support');
                  setWhatsappModalOpen(false);
                }}
                className="w-full text-left rounded-2xl border border-slate-200 p-3.5 hover:border-blue-500 hover:bg-blue-50/40 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 group-hover:text-blue-700">
                    3. Technical Support &amp; Helpdesk Check-in
                  </span>
                  <Wrench size={14} className="text-blue-600" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Reaches out to assist with LAN networking, printer setup, or clinical modules.
                </p>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* FACTORY RESET CONFIRMATION MODAL                                          */}
      {/* ========================================================================= */}
      <Modal
        open={factoryResetModalOpen}
        onClose={() => setFactoryResetModalOpen(false)}
        title="⚠️ Confirm Master Factory Reset"
        subtitle="This action will permanently purge all clinic records, users, and clinical data."
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-2xl border border-rose-300 bg-rose-50/70 p-4 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 space-y-2">
            <p className="font-black text-sm">Are you absolutely sure?</p>
            <p className="leading-relaxed">
              This will permanently delete <strong>all registered clinics, staff logins, patients, appointments, invoices, dental charts, and payments</strong>.
            </p>
            <p className="font-semibold text-[11px] text-rose-700 dark:text-rose-400">
              ✓ Master roles, permissions, and security keys will remain intact so you can onboard new clinics cleanly.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Type <span className="font-mono font-black text-rose-600">tamilan</span> to confirm:
            </label>
            <input
              type="text"
              value={resetConfirmKey}
              onChange={(e) => setResetConfirmKey(e.target.value)}
              placeholder="tamilan"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFactoryResetModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFactoryReset}
              disabled={resetConfirmKey !== 'tamilan' && resetConfirmKey !== '7788' || isResetting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 font-black text-white hover:bg-rose-700 shadow-md transition cursor-pointer disabled:opacity-40"
            >
              {isResetting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Wiping System...
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  Confirm &amp; Factory Reset Now
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
