import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stethoscope, Clock, CheckCircle2, User, Phone, Sparkles, ChevronRight,
  ShieldCheck, AlertCircle, ArrowLeft, RefreshCw, X, HeartPulse, Building2,
  Calendar, Check, UserCheck
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useClinic } from '../../hooks/useClinic.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';

const DENTAL_REASONS = [
  { id: 'toothache', title: 'Severe Toothache', tamil: 'கடும் பல் வலி', icon: '⚡', desc: 'Throbbing pain, night pain, sensitivity' },
  { id: 'cleaning', title: 'Cleaning & Polishing', tamil: 'பற்கள் சுத்தம் செய்தல்', icon: '✨', desc: 'Routine scaling, tartar removal, fresh breath' },
  { id: 'cavity', title: 'Cavity / Food Lodgement', tamil: 'பல் சொத்தை / அடைத்தல்', icon: '🔍', desc: 'Hole in tooth, food packing, mild ache' },
  { id: 'bleeding_gums', title: 'Bleeding / Sore Gums', tamil: 'ஈறு வீக்கம் / ரத்தப்போக்கு', icon: '🩸', desc: 'Bleeding while brushing, red gums' },
  { id: 'braces', title: 'Teeth Alignment / Braces', tamil: 'பல் சீரமைப்பு / கிளிப்', icon: '📏', desc: 'Irregular teeth, gap closure, clear aligners' },
  { id: 'wisdom_tooth', title: 'Wisdom Tooth Pain', tamil: 'ஞானப்பல் வலி / வீக்கம்', icon: '⚠️', desc: 'Back jaw pain, difficulty opening mouth' },
  { id: 'broken_tooth', title: 'Broken / Chipped Tooth', tamil: 'உடைந்த / ஆடும் பல்', icon: '🦷', desc: 'Trauma, fractured crown, sharp edge' },
  { id: 'checkup', title: 'General Dental Checkup', tamil: 'பொது பல் பரிசோதனை', icon: '📋', desc: 'Routine consultation & oral screening' }
];

const HEALTH_ALERTS = [
  { id: 'bp', label: 'High Blood Pressure (BP)', tamil: 'உயர் ரத்த அழுத்தம்' },
  { id: 'diabetes', label: 'Diabetes (Sugar)', tamil: 'சர்க்கரை நோய்' },
  { id: 'blood_thinners', label: 'Blood Thinners (Aspirin)', tamil: 'ரத்தம் உறையா மாத்திரைகள்' },
  { id: 'penicillin_allergy', label: 'Penicillin / Amox Allergy', tamil: 'பென்சிலின் அலர்ஜி' },
  { id: 'cardiac', label: 'Heart Condition', tamil: 'இதய பிரச்சனை' },
  { id: 'pregnancy', label: 'Pregnancy', tamil: 'கர்ப்பம்' }
];

export default function PatientKioskPage() {
  const navigate = useNavigate();
  const { data: clinic } = useClinic();

  const [step, setStep] = useState(1); // 1: Info, 2: Reason & Health, 3: Success Token
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [selectedReason, setSelectedReason] = useState('checkup');
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Success ticket state
  const [ticket, setTicket] = useState(null);
  const [countdown, setCountdown] = useState(10);

  // Live clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer for automatic reset on success screen
  useEffect(() => {
    if (step !== 3) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resetKiosk();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const resetKiosk = () => {
    setFullName('');
    setMobile('');
    setAge('');
    setGender('male');
    setSelectedReason('checkup');
    setSelectedAlerts([]);
    setError(null);
    setTicket(null);
    setStep(1);
    setCountdown(10);
  };

  const toggleAlert = (alertId) => {
    setSelectedAlerts((prev) =>
      prev.includes(alertId) ? prev.filter((a) => a !== alertId) : [...prev, alertId]
    );
  };

  const handleNext = (e) => {
    e.preventDefault();
    setError(null);
    const cleanName = fullName.trim();
    const cleanPhone = mobile.replace(/\D/g, '');

    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full name (குறைந்தது 2 எழுத்துக்கள்)');
      return;
    }
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number (10 இலக்க போன் நம்பர்)');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const chosenReasonObj = DENTAL_REASONS.find((r) => r.id === selectedReason);
      const chosenAlertsLabels = selectedAlerts.map(
        (id) => HEALTH_ALERTS.find((h) => h.id === id)?.label
      ).filter(Boolean);

      const res = await api.post('/patients/kiosk-checkin', {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        age: age ? Number.parseInt(age, 10) : null,
        gender,
        primaryComplaint: chosenReasonObj ? `${chosenReasonObj.title} (${chosenReasonObj.tamil})` : 'Dental Consultation',
        medicalAlerts: chosenAlertsLabels
      });

      setTicket(res.data);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Check-in failed. Please speak to the receptionist.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-accent-500 selection:text-white">
      {/* ── Kiosk Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent-600 via-accent to-aqua-400 text-white shadow-lg ring-2 ring-accent-400/30">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>{clinic?.clinicName || 'ZhanX DentalCare'}</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                Self Check-in Kiosk
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              வரவேற்பறை சுய முன்பதிவு முனை · Touch Reception Tablet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Live Clock */}
          <div className="text-right hidden sm:block">
            <div className="text-base font-bold tabular-nums text-slate-200">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[11px] text-slate-400">
              {currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Exit Kiosk Button (Staff Return) */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Exit reception tablet kiosk and return to main clinic software?')) {
                navigate('/');
              }
            }}
            className="rounded-xl border border-slate-700/80 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5"
            title="Clinic Staff Exit"
          >
            <ArrowLeft size={14} />
            <span>Staff Portal</span>
          </button>
        </div>
      </header>

      {/* ── Main Kiosk Body ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl">

          {/* ── STEP 1: Basic Patient Info ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-3 py-1 text-xs font-bold text-accent-400 ring-1 ring-accent-500/20 mb-2">
                  <Sparkles size={13} />
                  Step 1 of 2: Quick Information
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Welcome to our Dental Clinic
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  நல்வரவு! தயவுசெய்து உங்கள் பெயர் மற்றும் மொபைல் எண்ணை உள்ளிடவும்.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleNext} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Patient Full Name / நோயாளி பெயர் <span className="text-accent-400">*</span>
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Karthik Raja / கார்த்திக் ராஜா"
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 pl-12 pr-4 py-3.5 text-base sm:text-lg font-medium text-white placeholder-slate-500 focus:border-accent-400 focus:ring-4 focus:ring-accent-500/20 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Mobile Number / மொபைல் எண் <span className="text-accent-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 98765 43210"
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 pl-12 pr-4 py-3.5 text-base sm:text-lg font-mono font-medium text-white placeholder-slate-500 focus:border-accent-400 focus:ring-4 focus:ring-accent-500/20 outline-none transition"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Already visited before? Just enter your registered phone number.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Age / வயது (உத்தேசமாக)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="115"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 28"
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-base font-medium text-white placeholder-slate-500 focus:border-accent-400 focus:ring-4 focus:ring-accent-500/20 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Gender / பாலினம்
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'male', label: 'Male', icon: '👨' },
                        { val: 'female', label: 'Female', icon: '👩' },
                        { val: 'other', label: 'Other', icon: '🧑' }
                      ].map((g) => (
                        <button
                          key={g.val}
                          type="button"
                          onClick={() => setGender(g.val)}
                          className={`rounded-2xl border py-2.5 text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                            gender === g.val
                              ? 'border-accent-400 bg-accent-500/20 text-white ring-2 ring-accent-400/30'
                              : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-base">{g.icon}</span>
                          <span>{g.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gradient-to-r from-accent-600 to-accent-500 py-4 text-base sm:text-lg font-black text-white shadow-xl hover:from-accent-500 hover:to-accent-400 active:scale-[0.99] transition flex items-center justify-center gap-2"
                  >
                    <span>Next: Dental Symptoms & Reason</span>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STEP 2: Reason for Visit & Health Conditions ────────────────────── */}
          {step === 2 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <span className="rounded-full bg-accent-500/10 px-3 py-1 text-xs font-bold text-accent-400 ring-1 ring-accent-500/20">
                  Step 2 of 2: Symptoms & Precaution
                </span>
              </div>

              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Why are you visiting today?
                </h2>
                <p className="text-xs text-slate-400">
                  இன்று உங்களுக்கு உள்ள பல் பிரச்சனை அல்லது தேவை என்ன?
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Dental Reason Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {DENTAL_REASONS.map((r) => {
                  const active = selectedReason === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReason(r.id)}
                      className={`rounded-2xl border p-3.5 text-left transition flex flex-col justify-between ${
                        active
                          ? 'border-accent-400 bg-accent-500/20 text-white ring-2 ring-accent-400/40 shadow-lg'
                          : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{r.icon}</span>
                        {active && <CheckCircle2 size={16} className="text-accent-400" />}
                      </div>
                      <div className="mt-2.5">
                        <p className="text-xs font-bold text-white leading-tight">{r.title}</p>
                        <p className="text-[10px] text-accent-300/80 font-medium mt-0.5">{r.tamil}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Health Precaution Chips */}
              <div className="border-t border-slate-800 pt-6 mb-8">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
                  <HeartPulse size={14} className="text-rose-400" />
                  <span>Any Medical Conditions? (மருத்துவ குறிப்புகள் - விருப்பம்)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {HEALTH_ALERTS.map((alert) => {
                    const checked = selectedAlerts.includes(alert.id);
                    return (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => toggleAlert(alert.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                          checked
                            ? 'border-rose-400/60 bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30'
                            : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${checked ? 'border-rose-400 bg-rose-500 text-white' : 'border-slate-600'}`}>
                          {checked && <Check size={10} strokeWidth={3} />}
                        </span>
                        <span>{alert.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 py-4 text-base sm:text-lg font-black text-white shadow-xl hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    <span>Booking your queue spot…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={22} />
                    <span>Confirm & Get Waiting Token / முன்பதிவு செய்</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 3: Success Token Ticket ─────────────────────────────────── */}
          {step === 3 && ticket && (
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden">
              {/* Confetti Glow Background */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-400/40 mb-4 shadow-lg">
                  <CheckCircle2 size={36} />
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Check-in Complete! நல்வரவு!
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Welcome, <strong className="text-white font-bold">{ticket.patient?.fullName}</strong>! You have been checked into the clinic queue.
                </p>

                {/* Big Token Number Card */}
                <div className="my-8 mx-auto max-w-sm rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-b from-emerald-950/60 to-slate-900 p-6 shadow-2xl">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Your Queue Token Number
                  </p>
                  <div className="mt-2 text-5xl sm:text-6xl font-black tracking-tight text-white font-mono">
                    {ticket.tokenNumber || 'TK-01'}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-300">
                    <Clock size={14} className="text-emerald-400" />
                    <span>Estimated wait time: <strong>~10–15 mins</strong></span>
                  </div>

                  {ticket.isNewPatient ? (
                    <div className="mt-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
                      ★ First Time Patient Registration
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-300">
                      Welcome Back! Returning Patient (Visit #{ticket.visitCount || 2})
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <p>தயவுசெய்து வரவேற்பறை சோபாவில் இளைப்பாறவும். உங்கள் எண் அழைக்கப்படும் போது உள்ளே வரவும்.</p>
                  <p className="text-[11px] text-slate-500">Please relax in the waiting area. Our dental team will call your token shortly.</p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Auto-resetting in <strong className="text-emerald-400 font-bold">{countdown}s</strong> for next patient…
                  </span>
                  <button
                    type="button"
                    onClick={resetKiosk}
                    className="rounded-xl bg-accent-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-accent-500 transition shadow-md"
                  >
                    Next Patient / அடுத்த நோயாளி
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Kiosk Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 px-6 py-3 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between">
        <span>{clinic?.clinicName || 'ZhanX DentalCare'} · Patient Self Check-in System</span>
        <span>Helpline: {clinic?.phone || '+91 94441 23456'}</span>
      </footer>
    </div>
  );
}
