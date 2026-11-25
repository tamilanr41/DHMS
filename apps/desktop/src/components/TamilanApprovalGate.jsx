import { useState } from 'react';
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
  Workflow
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
  const [registerBusy, setRegisterBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [justRegisteredClinic, setJustRegisteredClinic] = useState(null);

  const savedCode = typeof window !== 'undefined' ? localStorage.getItem('zhanx_my_clinic_code') : null;
  const reason = verification?.reason || 'REGISTER_REQUIRED';
  const clinic = justRegisteredClinic || verification?.clinic || null;

  // Determine whether to show Registration form or Verification In Progress
  const isRegistered = Boolean(justRegisteredClinic) || (reason !== 'REGISTER_REQUIRED' && Boolean(clinic?.clinic_code || savedCode));

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      await onRetry?.();
    } finally {
      setTimeout(() => setIsChecking(false), 600);
    }
  };

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

  const copyClinicCode = () => {
    if (!clinic?.clinic_code) return;
    navigator.clipboard.writeText(clinic.clinic_code);
    setCopiedCode(true);
    toast.success('Clinic code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isSeatLimit = reason === 'MAX_SYSTEMS_REACHED';
  const isSuspended = reason === 'SUSPENDED';
  const isExpired = reason === 'EXPIRED';

  return (
    <main className="relative flex min-h-screen min-h-[100dvh] overflow-y-auto bg-[#0b1220] text-white font-sans selection:bg-teal-500 selection:text-white">
      {/* Background Image */}
      <img
        src="/bg_img.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />

      {/* Warm clinical overlays — deep evergreen with blue horizon */}
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
              Patient records, appointments, dental charts, billing, and clinical workflows in one
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

          {/* Glassmorphic Form Card */}
          <div className="relative rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] sm:p-8">
            {/* ================================================================ */}
            {/* CASE A: UNREGISTERED -> REGISTER YOUR PRACTICE FORM               */}
            {/* ================================================================ */}
            {!isRegistered && !isSeatLimit && (
              <div>
                <div className="mb-5">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300">
                    New Clinic Setup
                  </p>
                  <h2 className="text-[26px] font-bold tracking-tight text-white">
                    Register Your Dental Practice
                  </h2>
                  <p className="mt-1 text-[13px] text-white/70">
                    Enter your clinic details to initialize your practice workspace
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

                  {/* City & Workstations */}
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
                          placeholder="e.g. Chennai, Madurai"
                          className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13.5px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-white/85">
                        Computer Workstations
                      </label>
                      <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                        <Laptop className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                        <select
                          value={registerForm.requestedSystems}
                          onChange={(e) => setRegisterForm({ ...registerForm, requestedSystems: e.target.value })}
                          className="w-full flex-1 border-0 bg-transparent px-2.5 py-2.5 text-[13px] font-semibold text-accent-300 outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white"
                        >
                          <option value="1">1 Computer (Single Seat Lock)</option>
                          <option value="2">2 Computers (Reception + Operatory)</option>
                          <option value="3">3 Computers (Reception + 2 Operatories)</option>
                          <option value="5">5 Computers (Hospital Setup)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Modules */}
                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-white/85">
                      Required Clinical Modules
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {MODULE_OPTIONS.map((m) => {
                        const checked = registerForm.requestedModules.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-start gap-2 rounded-xl border p-2 cursor-pointer transition ${
                              checked
                                ? 'border-accent-400/50 bg-white/[0.12] text-white'
                                : 'border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20'
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
              </div>
            )}

            {/* ================================================================ */}
            {/* CASE B: REGISTERED -> ACCOUNT VERIFICATION IN PROGRESS             */}
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
                      ? `This clinic license is provisioned for ${clinic?.max_systems || verification?.maxSystems || 1} workstation(s). Contact your administrator to add additional seat licenses.`
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
                        <span className="font-semibold text-amber-300/90 flex items-center gap-1">
                          <Activity size={12} className="text-amber-400" />
                          Pending Review
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-brand-400 to-accent-500 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-6px_rgba(20,184,200,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(20,184,200,0.6)] transition active:scale-[0.98] cursor-pointer disabled:opacity-75"
                  >
                    <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
                    {isChecking ? 'Verifying Authorization…' : 'Check Verification Status'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('zhanx_my_clinic_code');
                      setJustRegisteredClinic(null);
                      window.location.reload();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/30 px-4 py-3 text-xs font-semibold text-white transition active:scale-[0.98] cursor-pointer"
                  >
                    <Plus size={14} />
                    Register New
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
