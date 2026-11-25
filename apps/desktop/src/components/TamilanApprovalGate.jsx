import { useState, useEffect } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FlaskConical,
  Laptop,
  AlertTriangle,
  Lock,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  User,
  Workflow,
  KeyRound,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from './ui/Toast.jsx';
import Logo from './ui/Logo.jsx';
import { getClientDeviceFingerprint, getClientDeviceInfo } from '../services/deviceFingerprint.js';
import heroTooth from '../assets/dental/hero-tooth.svg';

const MODULE_OPTIONS = [
  { id: 'appointments', label: 'Appointments & Queue', desc: 'Calendar & lounge triage' },
  { id: 'chart', label: 'Interactive Dental Chart', desc: 'Odontogram & FDI charting' },
  { id: 'plans', label: 'Treatment Planning', desc: 'Phased clinical procedures' },
  { id: 'prescriptions', label: 'Digital Prescriptions', desc: 'Rx pad & drug safety' },
  { id: 'billing', label: 'Invoices & Billing', desc: 'Invoicing & payment receipts' },
  { id: 'labs', label: 'Dental Lab Tracking', desc: 'Crowns, bridges & orders' },
  { id: 'inventory', label: 'Inventory & Consumables', desc: 'Stock levels & alerts' },
  { id: 'reports', label: 'Clinical Analytics', desc: 'Daily revenue & audits' }
];

const PILLARS = [
  { icon: Workflow, title: 'Clinical workflow', sub: 'Queue to consult' },
  { icon: Stethoscope, title: 'Patient records', sub: 'Complete history' },
  { icon: FlaskConical, title: 'Labs & reports', sub: 'Integrated results' },
  { icon: ShieldCheck, title: 'Role-based', sub: 'Audit-ready access' }
];

const HOSPITAL = {
  name: 'ZhanX DentalCare',
  systemName: 'ZHANX DENTALCARE MANAGEMENT SYSTEM',
  campus: 'Clinic Edition',
  version: '2.4.0',
  supportExtension: 'Ext. 200'
};

export default function TamilanApprovalGate({ verification, onRetry }) {
  const toast = useToast();

  // Mode: 'register' (New clinic) or 'connect' (Existing clinic code for 2nd/3rd device)
  const [viewMode, setViewMode] = useState('register');

  const [registerForm, setRegisterForm] = useState({
    clinicName: '',
    doctorName: '',
    mobile: '',
    email: '',
    city: '',
    address: '',
    requestedSystems: '1',
    requestedModules: ['appointments', 'chart', 'plans', 'prescriptions', 'billing']
  });

  const [connectForm, setConnectForm] = useState({
    clinicCode: '',
    deviceName: ''
  });

  const [registerBusy, setRegisterBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [justRegisteredClinic, setJustRegisteredClinic] = useState(null);

  // Prepopulate device name on mount
  useEffect(() => {
    try {
      const meta = getClientDeviceInfo();
      if (meta?.deviceName) {
        setConnectForm((prev) => ({ ...prev, deviceName: meta.deviceName }));
      }
    } catch (e) {}
  }, []);

  const savedCode = typeof window !== 'undefined' ? localStorage.getItem('zhanx_my_clinic_code') : null;
  const reason = verification?.reason || 'REGISTER_REQUIRED';
  const clinic = justRegisteredClinic || verification?.clinic || null;

  // Determine whether to show Initial forms (Register / Connect) or Status Screens
  const isRegistered =
    Boolean(justRegisteredClinic) ||
    (reason !== 'REGISTER_REQUIRED' && reason !== 'CLINIC_NOT_FOUND' && Boolean(clinic?.clinic_code || savedCode));

  const isSeatLimit = reason === 'MAX_SYSTEMS_REACHED';
  const isSuspended = reason === 'SUSPENDED';
  const isExpired = reason === 'EXPIRED';

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      await onRetry?.();
    } finally {
      setTimeout(() => setIsChecking(false), 600);
    }
  };

  // Submit New Clinic Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.clinicName || !registerForm.doctorName || !registerForm.mobile) {
      toast.error('Clinic name, doctor name, and mobile number are required.');
      return;
    }

    setRegisterBusy(true);
    try {
      const fingerprint = await getClientDeviceFingerprint();
      const meta = getClientDeviceInfo();

      const payload = {
        ...registerForm,
        deviceFingerprint: fingerprint,
        deviceName: meta.deviceName,
        osPlatform: meta.osPlatform,
        browserInfo: meta.browserInfo
      };

      const res = await api.post('/tamilan/register', payload);
      const newClinic = res?.data || res;

      if (newClinic?.clinic_code) {
        localStorage.setItem('zhanx_my_clinic_code', newClinic.clinic_code);
        setJustRegisteredClinic(newClinic);
      }

      toast.success('Registration submitted! Your clinic workspace is now awaiting activation.');
      await onRetry?.(newClinic?.clinic_code);
    } catch (err) {
      toast.error(err.message || 'Failed to submit registration');
    } finally {
      setRegisterBusy(false);
    }
  };

  // Connect Existing Clinic Device via Clinic Code
  const handleConnectSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = connectForm.clinicCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('Please enter your clinic code.');
      return;
    }

    setConnectBusy(true);
    try {
      const fingerprint = await getClientDeviceFingerprint();
      const meta = getClientDeviceInfo();

      const res = await api.post('/tamilan/device/verify', {
        clinicCode: cleanCode,
        deviceFingerprint: fingerprint,
        deviceName: connectForm.deviceName.trim() || meta.deviceName || 'Secondary Workstation',
        osPlatform: meta.osPlatform,
        browserInfo: meta.browserInfo
      });

      const data = res?.data ?? res;

      if (data.allowed) {
        localStorage.setItem('zhanx_my_clinic_code', cleanCode);
        toast.success(`Workstation connected! Welcome to ${data.clinic?.clinic_name || cleanCode}.`);
        await onRetry?.(cleanCode);
      } else if (data.reason === 'CLINIC_NOT_FOUND') {
        toast.error(data.message || `Clinic code '${cleanCode}' was not found. Please verify the code.`);
      } else if (data.reason === 'MAX_SYSTEMS_REACHED') {
        localStorage.setItem('zhanx_my_clinic_code', cleanCode);
        toast.error(`Workstation seat limit reached (${data.activeSystems}/${data.maxSystems} active)!`);
        await onRetry?.(cleanCode);
      } else if (data.reason === 'PENDING_APPROVAL') {
        localStorage.setItem('zhanx_my_clinic_code', cleanCode);
        toast.info('This practice is pending activation by the administrator.');
        await onRetry?.(cleanCode);
      } else {
        localStorage.setItem('zhanx_my_clinic_code', cleanCode);
        toast.error(data.message || 'Authorization failed.');
        await onRetry?.(cleanCode);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to connect device. Please verify your connection.');
    } finally {
      setConnectBusy(false);
    }
  };

  const copyClinicCode = () => {
    if (!clinic?.clinic_code) return;
    navigator.clipboard.writeText(clinic.clinic_code);
    setCopiedCode(true);
    toast.success('Clinic code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleResetOrSwitchClinic = () => {
    localStorage.removeItem('zhanx_my_clinic_code');
    setJustRegisteredClinic(null);
    setViewMode('connect');
    onRetry?.(null);
  };

  return (
    <main className="relative flex min-h-screen min-h-[100dvh] overflow-y-auto bg-[#0b1220] text-white font-sans selection:bg-teal-500 selection:text-white">
      {/* Background Image */}
      <img
        src="/bg_img.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />

      {/* Warm clinical overlays */}
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#0b1220]/95 via-[#0f172a]/80 to-[#0b1220]/50"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 tooth-mesh opacity-40"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1100px 600px at -10% -10%, rgba(59,130,246,0.26), transparent 60%), radial-gradient(900px 560px at 110% 115%, rgba(20,184,200,0.26), transparent 55%)'
        }}
        aria-hidden="true"
      />

      {/* Branding Section (Left) - Exact match with LoginPage */}
      <section className="relative hidden w-[45%] flex-col justify-between p-10 lg:flex xl:p-12 z-10">
        <div className="relative">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <span className="leading-tight">
              <span className="block font-display text-lg font-extrabold tracking-tight text-white">
                ZHANX{' '}
                <span className="bg-gradient-to-r from-accent-300 to-brand-300 bg-clip-text text-transparent">
                  DENTAL
                </span>
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-300">
                {HOSPITAL.name}
              </span>
            </span>
          </div>

          <div className="mt-12 max-w-md">
            <div className="mb-4">
              <img
                src={heroTooth}
                alt="Doccure 3D Mascot"
                className="size-24 object-contain animate-float-doccure drop-shadow-[0_15px_30px_rgba(20,184,200,0.4)]"
              />
            </div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Enterprise Practice Suite
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] xl:text-5xl text-white">
              Better care,
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-white bg-clip-text text-transparent">
                organized simply.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-white/80">
              Patient records, appointments, dental charts, billing, and multi-chair workflows in one
              secure workspace for your practice team.
            </p>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-5">
            {PILLARS.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 ring-1 ring-white/10">
                  <item.icon className="h-[18px] w-[18px] text-accent-300" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold text-white">
                    {item.title}
                  </span>
                  <span className="block text-[11.5px] text-white/65">{item.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[12px] text-white/55">
          <span>
            Version {HOSPITAL.version} · {HOSPITAL.campus}
          </span>
          <span>Support {HOSPITAL.supportExtension}</span>
        </div>
      </section>

      {/* Form Section (Right) */}
      <section className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden z-10">
        <div className="my-auto w-full max-w-[540px]">
          {/* Mobile Header */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold tracking-wide text-white">
                ZHANX <span className="text-accent-300">DENTAL</span>
              </p>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/65">
                {HOSPITAL.systemName}
              </p>
            </div>
          </div>

          {/* Glassmorphic Card */}
          <div className="relative rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] sm:p-8">
            {/* ================================================================ */}
            {/* CASE A: UNREGISTERED -> REGISTER OR CONNECT DEVICE VIA CODE       */}
            {/* ================================================================ */}
            {!isRegistered && !isSeatLimit && (
              <div>
                {/* Segmented Mode Switcher */}
                <div className="mb-5 flex rounded-xl border border-white/15 bg-white/[0.06] p-1 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setViewMode('register')}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                      viewMode === 'register'
                        ? 'bg-gradient-to-r from-accent-400 to-brand-400 text-white shadow-md'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Register New Clinic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('connect')}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                      viewMode === 'connect'
                        ? 'bg-gradient-to-r from-accent-400 to-brand-400 text-white shadow-md'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Laptop size={14} />
                    <span>Connect With Clinic Code</span>
                  </button>
                </div>

                {/* ── SUB-VIEW 1: REGISTER NEW CLINIC ───────────────────────────── */}
                {viewMode === 'register' && (
                  <div>
                    <div className="mb-5">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300">
                        New Practice Setup
                      </p>
                      <h2 className="text-[25px] font-bold tracking-tight text-white">
                        Register Your Dental Practice
                      </h2>
                      <p className="mt-1 text-[13px] text-white/70">
                        Initialize your main clinic account to request access and obtain your Clinic Code
                      </p>
                    </div>

                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left text-xs" noValidate>
                      {/* Clinic Name */}
                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-white/85">
                          Clinic Name *
                        </label>
                        <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                          <Building2 className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                          <input
                            required
                            value={registerForm.clinicName}
                            onChange={(e) => setRegisterForm({ ...registerForm, clinicName: e.target.value })}
                            placeholder="e.g. Apex Multispeciality Dental Hospital"
                            className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13.5px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                          />
                        </div>
                      </div>

                      {/* Doctor & Mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-white/85">
                            Chief Doctor Name *
                          </label>
                          <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                            <User className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                            <input
                              required
                              value={registerForm.doctorName}
                              onChange={(e) => setRegisterForm({ ...registerForm, doctorName: e.target.value })}
                              placeholder="Dr. Rajesh MDS"
                              className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13.5px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-white/85">
                            Mobile Number *
                          </label>
                          <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                            <Phone className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                            <input
                              required
                              value={registerForm.mobile}
                              onChange={(e) => setRegisterForm({ ...registerForm, mobile: e.target.value })}
                              placeholder="9876543210"
                              className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13.5px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* City & Address */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-white/85">
                            City / District
                          </label>
                          <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                            <MapPin className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                            <input
                              value={registerForm.city}
                              onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
                              placeholder="Chennai / Madurai"
                              className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13.5px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-white/85">
                            Workstations Needed
                          </label>
                          <select
                            value={registerForm.requestedSystems}
                            onChange={(e) => setRegisterForm({ ...registerForm, requestedSystems: e.target.value })}
                            className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2.5 text-[13px] text-white backdrop-blur-md outline-none focus:border-accent-300"
                          >
                            <option value="1" className="bg-slate-900 text-white">1 Workstation (Doctor Chair)</option>
                            <option value="2" className="bg-slate-900 text-white">2 Workstations (Chair + Reception)</option>
                            <option value="3" className="bg-slate-900 text-white">3 Workstations (2 Chairs + Reception)</option>
                            <option value="5" className="bg-slate-900 text-white">5 Workstations (Multi-chair Hospital)</option>
                            <option value="10" className="bg-slate-900 text-white">10 Workstations (Enterprise)</option>
                          </select>
                        </div>
                      </div>

                      {/* Modules Checklist */}
                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-white/85">
                          Requested Modules
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto rounded-xl border border-white/15 bg-white/[0.04] p-2.5 backdrop-blur-sm">
                          {MODULE_OPTIONS.map((m) => {
                            const checked = registerForm.requestedModules.includes(m.id);
                            return (
                              <label
                                key={m.id}
                                className={`flex items-start gap-2 p-1.5 rounded-lg border transition cursor-pointer ${
                                  checked
                                    ? 'bg-accent-500/15 border-accent-400/40 text-white'
                                    : 'border-transparent text-white/60 hover:text-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...registerForm.requestedModules, m.id]
                                      : registerForm.requestedModules.filter((id) => id !== m.id);
                                    setRegisterForm({ ...registerForm, requestedModules: next });
                                  }}
                                  className="mt-0.5 rounded text-accent-400 focus:ring-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-[11px] truncate">{m.label}</div>
                                  <div className="text-[10px] text-white/50 truncate">{m.desc}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={registerBusy}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-brand-400 to-accent-500 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-6px_rgba(20,184,200,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(20,184,200,0.6)] transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          {registerBusy ? 'Registering Clinic...' : 'Register Practice & Request Access'}
                        </button>
                      </div>
                    </form>

                    {/* Bottom Link to Connect Device */}
                    <div className="mt-5 pt-4 border-t border-white/10 text-center">
                      <p className="text-[11.5px] text-white/65 mb-2">
                        Already registered your clinic? Adding Chair 2, Reception desk, or a mobile tablet?
                      </p>
                      <button
                        type="button"
                        onClick={() => setViewMode('connect')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent-300/40 bg-accent-400/10 hover:bg-accent-400/20 px-3.5 py-1.5 text-xs font-bold text-accent-300 transition cursor-pointer"
                      >
                        <Laptop size={14} />
                        <span>Enter Clinic Code to Connect This Device</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── SUB-VIEW 2: CONNECT EXISTING CLINIC CODE ───────────────────── */}
                {viewMode === 'connect' && (
                  <div>
                    <div className="mb-5">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300">
                        Multi-Device Authorization
                      </p>
                      <h2 className="text-[25px] font-bold tracking-tight text-white">
                        Connect Workstation to Practice
                      </h2>
                      <p className="mt-1 text-[13px] text-white/70">
                        Enter your existing Clinic Code to link this computer or mobile device to your clinic license
                      </p>
                    </div>

                    <form onSubmit={handleConnectSubmit} className="space-y-4 text-left text-xs" noValidate>
                      {/* Clinic Code */}
                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-white/85">
                          Practice Clinic Code *
                        </label>
                        <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                          <KeyRound className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                          <input
                            required
                            autoFocus
                            value={connectForm.clinicCode}
                            onChange={(e) =>
                              setConnectForm({ ...connectForm, clinicCode: e.target.value.toUpperCase() })
                            }
                            placeholder="e.g. CLI-839201"
                            className="w-full flex-1 border-0 bg-transparent px-3 py-3 font-mono text-[15px] font-bold tracking-widest text-white placeholder:text-white/35 outline-none focus:ring-0 shadow-none uppercase"
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-white/50">
                          The unique code issued to your clinic during initial registration (e.g. CLI-XXXXXX).
                        </p>
                      </div>

                      {/* Station / Device Identifier */}
                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-white/85">
                          Workstation / Device Identifier (Optional)
                        </label>
                        <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                          <Laptop className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                          <input
                            value={connectForm.deviceName}
                            onChange={(e) => setConnectForm({ ...connectForm, deviceName: e.target.value })}
                            placeholder="e.g. Doctor Chair 2 or Reception Desk"
                            className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13.5px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                          />
                        </div>
                        <p className="mt-1 text-[10.5px] text-white/50">
                          Helps identify this computer in your clinic's device manager.
                        </p>
                      </div>

                      {/* License seat reminder badge */}
                      <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-cyan-200 flex items-start gap-2.5">
                        <ShieldCheck size={18} className="shrink-0 text-cyan-300 mt-0.5" />
                        <div className="text-[11.5px] leading-relaxed">
                          <strong className="text-white">Seat Availability:</strong> If your clinic license includes 2 or more workstations (e.g. Chair 1 + Reception), this device will be automatically authorized and bound to your clinic workspace.
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={connectBusy}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-brand-400 to-accent-500 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-6px_rgba(20,184,200,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(20,184,200,0.6)] transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          {connectBusy ? 'Authorizing Workstation...' : 'Authorize & Connect Workstation'}
                        </button>
                      </div>
                    </form>

                    {/* Bottom Link to Register */}
                    <div className="mt-5 pt-4 border-t border-white/10 text-center">
                      <p className="text-[11.5px] text-white/65 mb-2">
                        Don't have a registered clinic yet?
                      </p>
                      <button
                        type="button"
                        onClick={() => setViewMode('register')}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-300 hover:text-white transition cursor-pointer"
                      >
                        <Building2 size={13} />
                        <span>Register a New Dental Practice Instead →</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* CASE B: REGISTERED -> ACCOUNT VERIFICATION OR SEAT LIMIT GATE    */}
            {/* ================================================================ */}
            {(isRegistered || isSeatLimit) && (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-xl shadow-xl">
                  {isSeatLimit ? (
                    <Laptop size={30} className="text-amber-400" />
                  ) : isSuspended || isExpired ? (
                    <AlertTriangle size={30} className="text-rose-400" />
                  ) : (
                    <Clock size={30} className="text-accent-300 animate-pulse" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300">
                    Clinic Authorization Gateway
                  </p>
                  <h2 className="text-[25px] font-bold tracking-tight text-white">
                    {isSeatLimit
                      ? 'Workstation Seat Limit Reached'
                      : isSuspended
                      ? 'Practice Workspace Suspended'
                      : isExpired
                      ? 'Subscription Renewal Required'
                      : 'Account Verification in Progress'}
                  </h2>
                  <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-white/70">
                    {isSeatLimit
                      ? `This clinic license is provisioned for ${clinic?.max_systems || verification?.maxSystems || 1} workstation(s) (currently ${verification?.activeSystems || clinic?.max_systems || 1} active). Contact your administrator to add additional seat licenses.`
                      : isSuspended
                      ? 'Your clinic workspace is temporarily paused. Contact your administrator to restore access.'
                      : 'Your clinic registration has been submitted to the administrator. Access will unlock automatically once your practice is approved.'}
                  </p>
                </div>

                {/* Clinic Summary Card */}
                {clinic && (
                  <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4 text-xs text-left space-y-2.5 backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-white/60">Clinic Code:</span>
                        <span className="font-mono font-bold text-accent-300 bg-white/10 px-2 py-0.5 rounded border border-white/15">
                          {clinic.clinic_code}
                        </span>
                        <button
                          type="button"
                          onClick={copyClinicCode}
                          className="text-white/60 hover:text-white transition p-1"
                          title="Copy Code"
                        >
                          {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                          clinic.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {clinic.status?.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11.5px]">
                      <div>
                        <span className="text-white/50 block text-[10.5px]">Clinic Name</span>
                        <span className="font-semibold text-white truncate block">{clinic.clinic_name}</span>
                      </div>
                      <div>
                        <span className="text-white/50 block text-[10.5px]">Chief Clinician</span>
                        <span className="font-semibold text-white truncate block">{clinic.doctor_name}</span>
                      </div>
                      <div>
                        <span className="text-white/50 block text-[10.5px]">Allocated Seats</span>
                        <span className="font-mono font-semibold text-accent-300 block">
                          {clinic.max_systems} Workstation{clinic.max_systems === 1 ? ' (Single Seat)' : 's'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50 block text-[10.5px]">Approval State</span>
                        <span className={`font-semibold flex items-center gap-1 ${
                          clinic.status === 'active' ? 'text-emerald-300' : 'text-amber-300/90'
                        }`}>
                          <Activity size={12} className={clinic.status === 'active' ? 'text-emerald-400' : 'text-amber-400'} />
                          {clinic.status === 'active' ? 'Active License' : 'Pending Review'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-brand-400 to-accent-500 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-6px_rgba(20,184,200,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(20,184,200,0.6)] transition active:scale-[0.98] cursor-pointer disabled:opacity-75"
                  >
                    <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
                    {isChecking ? 'Checking Authorization…' : 'Check Authorization Status'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetOrSwitchClinic}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/30 px-3.5 py-3 text-xs font-semibold text-white transition active:scale-[0.98] cursor-pointer"
                    title="Connect with another Clinic Code or Register new"
                  >
                    <Laptop size={14} />
                    Switch Clinic Code
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
