import { useEffect, useState } from 'react';
import {
  ShieldAlert, Clock, Laptop, CheckCircle2, MessageCircle, AlertTriangle,
  RefreshCw, Building2, UserCheck, ArrowRight, Sparkles, Plus, Copy, Check
} from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from './ui/Toast.jsx';
import { getClientDeviceFingerprint, getClientDeviceInfo } from '../services/deviceFingerprint.js';
import heroTooth from '../assets/dental/hero-tooth.svg';
import { Modal } from './ui/Modal.jsx';

const MODULE_OPTIONS = [
  { id: 'appointments', label: 'Appointments & Waiting Queue' },
  { id: 'chart', label: 'Dental Chart & Odontogram' },
  { id: 'plans', label: 'Phased Treatment Plans' },
  { id: 'prescriptions', label: 'Prescriptions & Safety Warnings' },
  { id: 'billing', label: 'Invoices, Receipts & Tax Ledger' },
  { id: 'labs', label: 'Dental Laboratory Orders' },
  { id: 'inventory', label: 'Clinic Stock & Consumables' },
  { id: 'claims', label: 'Insurance & Claims' },
  { id: 'reports', label: 'Audit-ready Analytics Reports' }
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
    requestedModules: ['appointments', 'queue', 'chart', 'plans', 'prescriptions', 'billing']
  });
  const [registerBusy, setRegisterBusy] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const reason = verification?.reason || 'PENDING_APPROVAL';
  const clinic = verification?.clinic || null;

  // Auto-poll every 8 seconds if waiting for Tamilan approval
  useEffect(() => {
    if (reason === 'PENDING_APPROVAL') {
      const timer = setInterval(() => {
        onRetry?.();
      }, 8000);
      return () => clearInterval(timer);
    }
  }, [reason, onRetry]);

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
      toast.error(err.message);
    } finally {
      setRegisterBusy(false);
    }
  };

  const copyUpi = () => {
    navigator.clipboard.writeText('tamilan@upi');
    setCopiedUpi(true);
    toast.success('Tamilan UPI ID copied!');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      `Vanakkam Tamilan Admin, I am Dr. ${clinic?.doctor_name || 'Dentist'} from ${clinic?.clinic_name || 'Dental Clinic'}. My clinic code is ${clinic?.clinic_code || 'NEW'}. I have submitted registration for ${clinic?.max_systems || 1} system(s). Please verify payment and unlock my clinic access. Thank you!`
    );
    window.open(`https://wa.me/919876543210?text=${msg}`, '_blank');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-[#072d34] p-4 text-white">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-teal-500/30 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-10 pointer-events-none">
          <img src={heroTooth} alt="" className="h-64 translate-x-12" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#009da6] to-[#08636d] text-white shadow-lg shadow-teal-500/25">
            {reason === 'MAX_SYSTEMS_REACHED' ? (
              <Laptop size={32} />
            ) : reason === 'EXPIRED' || reason === 'SUSPENDED' ? (
              <AlertTriangle size={32} />
            ) : (
              <Clock size={32} />
            )}
          </div>

          <div>
            <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#009da6] border border-teal-500/20">
              TAMILAN CLINIC ACCESS GATE
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {reason === 'MAX_SYSTEMS_REACHED'
                ? 'System Limit Exceeded (Seat Lock)'
                : reason === 'SUSPENDED'
                ? 'Clinic Account Suspended'
                : reason === 'EXPIRED'
                ? 'Subscription Expired'
                : 'Awaiting Tamilan Admin Approval'}
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {reason === 'MAX_SYSTEMS_REACHED'
                ? `This clinic license is authorized for only ${verification?.maxSystems || 1} system(s). You are attempting to open from a secondary computer.`
                : reason === 'SUSPENDED'
                ? 'Your clinic workspace is temporarily paused. Contact Tamilan Admin to reactivate.'
                : 'Your registration is pending verification and fee clearance by Tamilan Master Admin.'}
            </p>
          </div>
        </div>

        {/* Clinic Status Card */}
        {clinic && (
          <div className="relative z-10 mt-6 rounded-2xl border border-slate-700/80 bg-slate-800/60 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="font-mono text-teal-400 font-bold">{clinic.clinic_code}</span>
              <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10.5px] font-black uppercase">
                {clinic.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Clinic Name:</span>
              <span className="font-bold text-white">{clinic.clinic_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prescribing Doctor:</span>
              <span className="font-bold text-white">{clinic.doctor_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Licensed Systems:</span>
              <span className="font-bold text-teal-300 font-mono">
                {clinic.max_systems} System{clinic.max_systems === 1 ? ' (Single PC Lock)' : 's'}
              </span>
            </div>
          </div>
        )}

        {/* Payment & Contact Details for Tamilan */}
        <div className="relative z-10 mt-5 rounded-2xl bg-teal-500/10 border border-teal-500/20 p-4 space-y-2.5 text-xs text-teal-100">
          <p className="font-black text-white text-xs flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#009da6]" />
            Direct Tamilan Admin Payment Clearance:
          </p>
          <div className="flex items-center justify-between bg-slate-900/60 rounded-xl p-2.5 border border-teal-500/20">
            <span className="font-mono text-xs font-bold text-white">GPay / PhonePe UPI: tamilan@upi</span>
            <button
              type="button"
              onClick={copyUpi}
              className="text-[11px] font-black text-teal-400 hover:text-white flex items-center gap-1"
            >
              {copiedUpi ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedUpi ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Send payment confirmation screenshot to Tamilan Admin on WhatsApp. Your account unlocks automatically within seconds of approval.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={openWhatsApp}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-black text-white shadow-lg shadow-emerald-900/30 transition cursor-pointer"
          >
            <MessageCircle size={16} />
            Contact Tamilan Admin on WhatsApp
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRetry?.()}
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-xs font-bold text-slate-300 transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={13} />
              Check Status
            </button>

            <button
              type="button"
              onClick={() => setRegisterModalOpen(true)}
              className="flex-1 rounded-2xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 py-2.5 text-xs font-bold text-teal-300 transition flex items-center justify-center gap-1.5"
            >
              <Plus size={13} />
              Register New Clinic
            </button>
          </div>
        </div>

        {/* Super Admin Shortcut Link */}
        <div className="relative z-10 mt-5 pt-3 border-t border-slate-800 text-center">
          <a
            href="/tamilan"
            className="text-[11px] text-slate-500 hover:text-teal-400 transition font-mono"
          >
            Master Admin Login (Tamilan Control Suite) →
          </a>
        </div>
      </div>

      {/* Register New Clinic Modal */}
      <Modal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Register Dental Clinic for ZhanX Care"
        subtitle="Submit clinic details to Tamilan Admin for licensing & approval."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRegisterModalOpen(false)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRegisterSubmit}
              disabled={registerBusy}
              className="rounded-2xl bg-gradient-to-r from-[#009da6] to-[#08636d] px-5 py-2 text-xs font-black text-white hover:opacity-95 transition"
            >
              {registerBusy ? 'Submitting...' : 'Submit to Tamilan Admin'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Clinic Name *</label>
            <input
              required
              value={registerForm.clinicName}
              onChange={(e) => setRegisterForm({ ...registerForm, clinicName: e.target.value })}
              placeholder="e.g. Apex Multispeciality Dental"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Doctor Name *</label>
              <input
                required
                value={registerForm.doctorName}
                onChange={(e) => setRegisterForm({ ...registerForm, doctorName: e.target.value })}
                placeholder="Dr. Rajesh MDS"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile Number (WhatsApp) *</label>
              <input
                required
                value={registerForm.mobile}
                onChange={(e) => setRegisterForm({ ...registerForm, mobile: e.target.value })}
                placeholder="9876543210"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">City</label>
              <input
                value={registerForm.city}
                onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
                placeholder="Chennai / Coimbatore"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#009da6] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Number of Systems / PCs Needed</label>
              <select
                value={registerForm.requestedSystems}
                onChange={(e) => setRegisterForm({ ...registerForm, requestedSystems: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#009da6] focus:outline-none"
              >
                <option value="1">1 System (Single Computer)</option>
                <option value="2">2 Systems (Reception + Doctor Chair)</option>
                <option value="3">3 Systems (Reception + 2 Chairs)</option>
                <option value="5">5 Systems (Hospital)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Requested Modules</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {MODULE_OPTIONS.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={registerForm.requestedModules.includes(m.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...registerForm.requestedModules, m.id]
                        : registerForm.requestedModules.filter((id) => id !== m.id);
                      setRegisterForm({ ...registerForm, requestedModules: next });
                    }}
                    className="rounded text-[#009da6]"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
