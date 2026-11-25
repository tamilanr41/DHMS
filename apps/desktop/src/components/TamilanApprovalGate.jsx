import { useEffect, useState } from 'react';
import {
  ShieldCheck, Clock, Laptop, CheckCircle2, AlertTriangle,
  RefreshCw, Building2, UserCheck, ArrowRight, Sparkles, Plus, Copy, Check,
  Activity, Stethoscope, ChevronRight, MonitorCheck, ShieldAlert
} from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from './ui/Toast.jsx';
import heroTooth from '../assets/dental/hero-tooth.svg';
import { Modal } from './ui/Modal.jsx';

const MODULE_OPTIONS = [
  { id: 'appointments', label: 'Appointments & Waiting Lounge', desc: 'Patient scheduling and live check-in queue' },
  { id: 'chart', label: 'Interactive Dental Chart', desc: 'FDI tooth surface diagnostics and periodontal charting' },
  { id: 'plans', label: 'Treatment Planning', desc: 'Phased clinical procedures and cost estimations' },
  { id: 'prescriptions', label: 'Digital Prescriptions', desc: 'Rx pad with dosage safety and drug alerts' },
  { id: 'billing', label: 'Invoices & Billing', desc: 'Procedure invoicing, payments and tax receipts' },
  { id: 'labs', label: 'Dental Lab Workflows', desc: 'Fabrication tracking for crowns, bridges and prosthetics' },
  { id: 'inventory', label: 'Clinic Stock & Consumables', desc: 'Dental composites, anesthetics and batch inventory' },
  { id: 'reports', label: 'Analytics & Clinical Reports', desc: 'Daily collections, revenue and patient analytics' }
];

export default function TamilanApprovalGate({ verification, onRetry }) {
  const toast = useToast();
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
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

  const reason = verification?.reason || 'PENDING_APPROVAL';
  const clinic = verification?.clinic || null;

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
      const res = await api.post('/tamilan/register', registerForm);
      toast.success(res.data.message || 'Registration submitted successfully!');
      setRegisterModalOpen(false);
      onRetry?.();
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
    toast.success('Clinic code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isSeatLimit = reason === 'MAX_SYSTEMS_REACHED';
  const isSuspended = reason === 'SUSPENDED';
  const isExpired = reason === 'EXPIRED';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#070e17] px-4 py-8 text-slate-100 overflow-hidden font-sans selection:bg-teal-500 selection:text-white">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[140px]" />

      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[28px] border border-slate-700/60 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-[#0b1622]/95 p-7 sm:p-9 shadow-[0_25px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        {/* Subtle decorative tooth watermark */}
        <div className="pointer-events-none absolute right-2 top-8 opacity-[0.035]">
          <img src={heroTooth} alt="" className="h-64 translate-x-8 -translate-y-8 select-none" />
        </div>

        {/* Brand Bar */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#009da6] to-[#0d7d87] text-white shadow-lg shadow-teal-500/20">
              <Stethoscope size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">ZhanX DentalCare</span>
                <span className="rounded-md bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/25">
                  CLOUD
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Enterprise Clinic Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-800/50 px-3 py-1.5 text-[11px] font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
            <span>Live Security</span>
          </div>
        </div>

        {/* Status Center Banner */}
        <div className="relative z-10 mt-7 text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/80 to-slate-900/90 shadow-xl">
            {isSeatLimit ? (
              <Laptop size={32} className="text-amber-400" />
            ) : isSuspended || isExpired ? (
              <AlertTriangle size={32} className="text-rose-400" />
            ) : (
              <Clock size={32} className="text-[#00c5d1] animate-pulse" />
            )}
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-[26px]">
              {isSeatLimit
                ? 'Workstation Seat Limit Reached'
                : isSuspended
                ? 'Clinic Account Suspended'
                : isExpired
                ? 'Subscription Renew Required'
                : 'Account Verification in Progress'}
            </h1>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-400">
              {isSeatLimit
                ? `This clinic license is provisioned for ${verification?.maxSystems || 1} workstation(s). This computer is currently unauthorized. Contact your administrator to add or transfer seat licenses.`
                : isSuspended
                ? 'Your clinic workspace is temporarily paused. Contact your administrator to restore access.'
                : 'Your clinic registration is under review by the administrator. Full clinical modules and dental charting will unlock automatically once authorized.'}
            </p>
          </div>
        </div>

        {/* Clinic Summary Card (if clinic exists) */}
        {clinic && (
          <div className="relative z-10 mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">Clinic Identifier:</span>
                <span className="font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  {clinic.clinic_code}
                </span>
                <button
                  type="button"
                  onClick={copyClinicCode}
                  className="text-slate-400 hover:text-white transition p-1"
                  title="Copy Code"
                >
                  {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider border ${
                  clinic.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {clinic.status?.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11.5px]">
              <div>
                <span className="text-slate-500 block text-[10.5px]">Clinic Name</span>
                <span className="font-semibold text-slate-200 truncate block">{clinic.clinic_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10.5px]">Chief Clinician</span>
                <span className="font-semibold text-slate-200 truncate block">{clinic.doctor_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10.5px]">Allocated Workstations</span>
                <span className="font-mono font-semibold text-teal-300 block">
                  {clinic.max_systems} System{clinic.max_systems === 1 ? ' (Single Seat Lock)' : 's'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10.5px]">Verification Status</span>
                <span className="font-semibold text-amber-300/90 flex items-center gap-1">
                  <Activity size={12} className="text-amber-400" />
                  Pending Approval
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Live Auto-Sync Status Bar */}
        <div className="relative z-10 mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span>Automatic cloud synchronization active</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">Checking every 6s</span>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#009da6] to-[#0a7e89] py-3 text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:from-[#02b3bd] hover:to-[#0c909c] transition active:scale-[0.98] cursor-pointer disabled:opacity-75"
          >
            <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'Verifying Authorization…' : 'Check Access Status'}
          </button>

          <button
            type="button"
            onClick={() => setRegisterModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-slate-600 px-5 py-3 text-xs font-bold text-slate-200 transition active:scale-[0.98] cursor-pointer"
          >
            <Plus size={14} />
            Register Clinic
          </button>
        </div>
      </div>

      {/* Clean Enterprise Clinic Registration Modal */}
      <Modal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Register Dental Practice"
        subtitle="Provision a new clinic deployment on ZhanX DentalCare Cloud."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setRegisterModalOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRegisterSubmit}
              disabled={registerBusy}
              className="rounded-xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-5 py-2 text-xs font-bold text-white hover:opacity-95 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {registerBusy ? 'Submitting Registration…' : 'Submit for Authorization'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1">Clinic Name *</label>
            <input
              required
              value={registerForm.clinicName}
              onChange={(e) => setRegisterForm({ ...registerForm, clinicName: e.target.value })}
              placeholder="e.g. Apex Multispeciality Dental Hospital"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:ring-1 focus:ring-[#009da6] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Chief Doctor Name *</label>
              <input
                required
                value={registerForm.doctorName}
                onChange={(e) => setRegisterForm({ ...registerForm, doctorName: e.target.value })}
                placeholder="Dr. Rajesh MDS"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:ring-1 focus:ring-[#009da6] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Primary Mobile Number *</label>
              <input
                required
                value={registerForm.mobile}
                onChange={(e) => setRegisterForm({ ...registerForm, mobile: e.target.value })}
                placeholder="9876543210"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:ring-1 focus:ring-[#009da6] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">City</label>
              <input
                value={registerForm.city}
                onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
                placeholder="e.g. Chennai, Bangalore"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:ring-1 focus:ring-[#009da6] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Workstations Needed (Seat Lock)</label>
              <select
                value={registerForm.requestedSystems}
                onChange={(e) => setRegisterForm({ ...registerForm, requestedSystems: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none bg-white"
              >
                <option value="1">1 Computer (Single Workstation Lock)</option>
                <option value="2">2 Computers (Reception + Operatory)</option>
                <option value="3">3 Computers (Reception + 2 Operatories)</option>
                <option value="5">5 Computers (Dental Hospital Setup)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1.5">Required Clinical Modules</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {MODULE_OPTIONS.map((m) => {
                const checked = registerForm.requestedModules.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition ${
                      checked
                        ? 'border-teal-500/50 bg-teal-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
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
                      className="mt-0.5 rounded text-[#009da6] focus:ring-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-[11px]">{m.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{m.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
