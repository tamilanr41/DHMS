import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  UserRound,
  CalendarClock,
  Clock3,
  Stethoscope,
  Sparkles,
  Wrench,
  CalendarCheck,
  Flame,
  ClipboardCheck,
  UserCheck,
  Phone,
  MessageCircle,
  CheckCircle2,
  CalendarDays,
  ShieldAlert,
  ChevronRight,
  Info,
  X,
  Smile,
  Check
} from 'lucide-react';
import { api, ApiError } from '../../services/api.js';
import { useDentists } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import { formatDate, formatTime, todayISO, addDaysISO, initials } from '../../utils/format.js';
import heroTooth from '../../assets/dental/hero-tooth.svg';
import cleaningTooth from '../../assets/dental/cleaning-tooth.svg';
import whiteningTooth from '../../assets/dental/whitening-tooth.svg';
import implantTooth from '../../assets/dental/implant-tooth.svg';
import orthoTooth from '../../assets/dental/ortho-tooth.svg';

const PROCEDURE_PRESETS = [
  { value: 'consultation', label: 'Oral Checkup', desc: 'General exam & triage', iconImg: null, icon: Stethoscope },
  { value: 'cleaning', label: 'Teeth Cleaning', desc: 'Scaling & prophylaxis', iconImg: cleaningTooth, icon: Sparkles },
  { value: 'whitening', label: 'Teeth Whitening', desc: 'Aesthetic laser brightening', iconImg: whiteningTooth, icon: Sparkles },
  { value: 'procedure', label: 'Root Canal / Fillings', desc: 'RCT, restoration & crowns', iconImg: null, icon: Wrench },
  { value: 'implant', label: 'Dental Implants', desc: 'Surgical implant restoration', iconImg: implantTooth, icon: Sparkles },
  { value: 'ortho', label: 'Orthodontics', desc: 'Braces & clear aligners', iconImg: orthoTooth, icon: Smile }
];

const QUICK_DENTAL_CHIPS = [
  'Toothache / Acute Pain',
  'Teeth Scaling & Cleaning',
  'Cavity & Filling',
  'Root Canal Treatment (RCT)',
  'Crown / Bridge Fitting',
  'Bleeding Gums',
  'Wisdom Tooth Pain',
  'Broken / Chipped Tooth'
];

const DURATION_PRESETS = [
  { value: 15, label: '15m', hint: 'Quick Check' },
  { value: 30, label: '30m', hint: 'Standard' },
  { value: 45, label: '45m', hint: 'Procedure' },
  { value: 60, label: '60m', hint: 'RCT / Major' },
  { value: 90, label: '90m', hint: 'Surgery' }
];

const SOURCES = [
  ['reception', 'Walk-in / Reception Desk', UserCheck],
  ['phone', 'Phone Call', Phone],
  ['online', 'WhatsApp / Online Portal', MessageCircle],
  ['follow_up', 'Doctor Follow-up', CalendarClock]
];

function addMinutes(time, minutes) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + Number(minutes || 0);
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function minutesBetween(start, end) {
  const [h1, m1] = String(start).split(':').map(Number);
  const [h2, m2] = String(end).split(':').map(Number);
  return Math.max(15, h2 * 60 + m2 - (h1 * 60 + m1));
}

export default function AppointmentFormModal({ open, onClose, defaultDate, defaultPatient = null, appointment = null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const dentists = useDentists();
  const [patient, setPatient] = useState(defaultPatient);
  const [dentistId, setDentistId] = useState('');
  const [date, setDate] = useState(defaultDate || todayISO());
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [appointmentType, setAppointmentType] = useState('consultation');
  const [reason, setReason] = useState('');
  const [bookingSource, setBookingSource] = useState('reception');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setConflicts(null);
    if (appointment) {
      setPatient({
        id: appointment.patientId,
        fullName: appointment.patientName,
        patientNo: appointment.patientNo,
        mobile: appointment.mobile,
        allergies: appointment.allergies || null
      });
      setDentistId(appointment.dentistId);
      setDate(appointment.appointmentDate);
      setStartTime(String(appointment.startTime).slice(0, 5));
      setDuration(minutesBetween(appointment.startTime, appointment.endTime));
      setAppointmentType(appointment.appointmentType || 'consultation');
      setReason(appointment.reason || '');
      setBookingSource(appointment.bookingSource || 'reception');
      setNotes(appointment.notes || '');
      setStatus(['scheduled', 'confirmed'].includes(appointment.status) ? appointment.status : 'scheduled');
    } else {
      setPatient(defaultPatient);
      setDentistId('');
      setDate(defaultDate || todayISO());
      setStartTime('10:00');
      setDuration(30);
      setAppointmentType('consultation');
      setReason('');
      setBookingSource('reception');
      setNotes('');
      setStatus('scheduled');
    }
    setError(null);
  }, [open, appointment, defaultDate, defaultPatient]);

  useEffect(() => {
    if (open && !appointment && dentists.data?.length === 1) {
      setDentistId(dentists.data[0].id);
    }
  }, [open, appointment, dentists.data]);

  const endTime = useMemo(() => addMinutes(startTime, duration), [startTime, duration]);

  const selectedDentist = useMemo(() => {
    return (dentists.data || []).find((d) => d.id === dentistId);
  }, [dentists.data, dentistId]);

  const handleChipClick = (chipText) => {
    if (!reason.trim()) {
      setReason(chipText);
    } else if (!reason.includes(chipText)) {
      setReason(`${reason}, ${chipText}`);
    }
  };

  const save = async () => {
    setError(null);
    if (!patient?.id) return setError('Please select a patient to book the appointment');
    if (!dentistId) return setError('Please select a treating dentist');
    if (!date) return setError('Please select an appointment date');
    if (!startTime || endTime <= startTime) return setError('Please choose a valid appointment time and duration');
    setSaving(true);
    try {
      const payload = {
        dentistId,
        appointmentDate: date,
        startTime,
        endTime,
        appointmentType,
        reason: reason || null,
        bookingSource,
        notes: notes || null,
        status: status === 'confirmed' ? 'confirmed' : 'scheduled'
      };
      if (appointment) {
        await api.patch(`/appointments/${appointment.id}`, payload);
        toast.success('Appointment rescheduled successfully');
      } else {
        await api.post('/appointments', { ...payload, patientId: patient.id });
        toast.success('Appointment booked successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'APPOINTMENT_CONFLICT') {
        setConflicts(err.details?.conflicts || []);
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
        {/* Doccure Dental Luxury Modal Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0a7f8b] via-[#0e95a3] to-[#14b8c8] px-6 py-5 text-white">
          <div className="pointer-events-none absolute -right-4 -bottom-6 opacity-20">
            <img src={heroTooth} alt="" className="h-40 w-40 object-contain" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 p-2 backdrop-blur-md shadow-inner">
                <img src={heroTooth} alt="" className="h-full w-full object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  {appointment ? `Reschedule Appointment: ${appointment.appointmentNo}` : 'Book Dental Appointment'}
                </h2>
                <p className="text-xs text-white/85">
                  {appointment ? 'Modify chair slot, attending dentist or procedure' : 'Schedule patient visit into clinical operatory chair.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 text-white hover:bg-white/30 backdrop-blur-sm transition"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[calc(88vh-140px)] overflow-y-auto">
          {/* Quick Slot Recap Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-900/40 dark:bg-teal-950/20">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0a7f8b] to-[#14b8c8] text-white shadow-sm">
                <CalendarClock size={20} />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0a7f8b] dark:text-teal-400">Selected Chair Slot</p>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                  <span>{formatDate(date)}</span>
                  <span>·</span>
                  <span className="font-mono text-[#0a7f8b] dark:text-teal-300">{formatTime(startTime)} – {formatTime(endTime)}</span>
                  <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-slate-700 shadow-2xs dark:bg-slate-800 dark:text-slate-200">
                    {duration} mins
                  </span>
                </div>
              </div>
            </div>

            {/* Status Quick Toggle */}
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setStatus('scheduled')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  status === 'scheduled'
                    ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-300 shadow-xs dark:bg-sky-950/50 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${status === 'scheduled' ? 'bg-sky-500' : 'bg-slate-300'}`} />
                Scheduled
              </button>
              <button
                type="button"
                onClick={() => setStatus('confirmed')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  status === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 shadow-xs dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${status === 'confirmed' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                Confirmed
              </button>
            </div>
          </div>

          {/* 2-Column Responsive Form Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Patient & Procedure */}
            <div className="space-y-5 lg:col-span-7">
              {/* Step 1: Patient Details */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Step 1: Patient Record</span>
                  {patient && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      ✓ Patient Selected
                    </span>
                  )}
                </div>
                <PatientPicker value={patient} onChange={setPatient} required label="Find Patient (Name, Mobile, ID)" />

                {patient && (
                  <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                      <PatientAvatar
                        patient={patient}
                        size={42}
                        className="rounded-2xl shadow-xs"
                      />
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white text-sm">{patient.fullName}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-slate-400">{patient.patientNo}</span>
                          {patient.mobile && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600 font-bold">📞 {patient.mobile}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {patient.allergies && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700 ring-1 ring-rose-200">
                        <ShieldAlert size={12} /> {patient.allergies}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Dental Procedure Selection (Visual Cards) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850">
                <span className="mb-3 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Step 2: Dental Procedure Type
                </span>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {PROCEDURE_PRESETS.map((p) => {
                    const active = appointmentType === p.value;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setAppointmentType(p.value)}
                        className={`group flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? 'border-[#0a7f8b] bg-teal-50/70 shadow-sm ring-1 ring-[#0a7f8b] dark:bg-teal-950/40 dark:border-teal-600'
                            : 'border-slate-200/80 bg-white hover:border-teal-300 hover:bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800'
                        }`}
                      >
                        <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${
                          active
                            ? 'bg-[#0a7f8b] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 group-hover:bg-teal-50 group-hover:text-[#0a7f8b]'
                        }`}>
                          {p.iconImg ? (
                            <img src={p.iconImg} alt="" className="h-5 w-5 object-contain" />
                          ) : (
                            <Icon size={16} />
                          )}
                        </span>
                        <p className={`text-xs font-black leading-tight ${active ? 'text-[#0a7f8b] dark:text-teal-300' : 'text-slate-800 dark:text-white'}`}>
                          {p.label}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400 font-semibold">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Chief Complaint & Quick Chips */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Step 3: Reason for Visit / Chief Complaint
                </span>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Severe toothache, wisdom tooth review, scaling..."
                  className="mb-3 text-xs"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400">Quick Symptoms:</span>
                  {QUICK_DENTAL_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-[#0a7f8b] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Doctor, Time, Channel & Summary */}
            <div className="space-y-5 lg:col-span-5">
              {/* Step 4: Attending Dentist */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Step 4: Attending Dentist &amp; Operatory
                </span>
                <Select
                  required
                  value={dentistId}
                  onChange={(e) => setDentistId(e.target.value)}
                  className="text-xs font-bold"
                >
                  <option value="">Select Dentist…</option>
                  {(dentists.data || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.fullName}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Step 5: Schedule Timing & Slot Duration */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Step 5: Schedule Timing
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDate(todayISO())}
                      className="rounded-xl bg-slate-100 px-2.5 py-1 text-[10.5px] font-black text-slate-600 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-300"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(addDaysISO(todayISO(), 1))}
                      className="rounded-xl bg-slate-100 px-2.5 py-1 text-[10.5px] font-black text-slate-600 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-300"
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    label="Appointment Date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      label="Start Time"
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-xs"
                    />
                    <div>
                      <label className="label-base text-[11px] font-bold">End Time (Auto)</label>
                      <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {formatTime(endTime)}
                      </div>
                    </div>
                  </div>

                  {/* Duration Presets */}
                  <div>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">
                      Chair Slot Duration:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                      {DURATION_PRESETS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setDuration(d.value)}
                          className={`rounded-xl border px-2 py-1.5 text-center transition-all ${
                            duration === d.value
                              ? 'border-[#0a7f8b] bg-[#0a7f8b] text-white font-black shadow-xs'
                              : 'border-slate-200/80 bg-white text-slate-700 hover:border-teal-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <p className="text-xs font-black">{d.label}</p>
                          <p className={`text-[9px] ${duration === d.value ? 'text-white/80' : 'text-slate-400'}`}>
                            {d.hint}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 6: Booking Channel & Notes */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Step 6: Channel &amp; Operatory Notes
                </span>
                <div className="space-y-3">
                  <Select
                    label="Booking Source"
                    value={bookingSource}
                    onChange={(e) => setBookingSource(e.target.value)}
                    className="text-xs"
                  >
                    {SOURCES.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Select>

                  <Textarea
                    label="Clinical Notes / Pre-visit requirements"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Patient requested Dr. Sathish, pre-medication advised..."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Double-Booking Conflict Callout */}
          {conflicts && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-center gap-2 text-sm font-black text-amber-900 dark:text-amber-200">
                <AlertTriangle size={18} className="text-amber-600" />
                <span>Doctor Double-Booking Conflict Detected</span>
              </div>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                The selected dentist already has overlapping appointments in this timeframe:
              </p>
              <ul className="mt-2 space-y-1.5 border-t border-amber-200 pt-2 dark:border-amber-800">
                {conflicts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-xl bg-amber-100/70 px-3 py-1.5 text-xs font-bold text-amber-950 dark:bg-amber-900/60 dark:text-amber-100">
                    <span>{c.appointment_no} · {c.patient_name || c.patientName}</span>
                    <span className="font-mono">{formatTime(c.start_time)} – {formatTime(c.end_time)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertTriangle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            {patient && <span className="font-black text-slate-900 dark:text-white">{patient.fullName}</span>}
            {selectedDentist && (
              <>
                <span>·</span>
                <span>Dr. {selectedDentist.fullName}</span>
              </>
            )}
            {date && startTime && (
              <>
                <span>·</span>
                <span className="font-mono font-bold text-[#0a7f8b]">{formatDate(date)} ({formatTime(startTime)})</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-5 py-2 text-xs font-black text-white shadow-md hover:opacity-95 transition"
            >
              <CheckCircle2 size={16} />
              {saving ? 'Saving...' : appointment ? 'Save Rescheduled Slot' : 'Confirm & Book Appointment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
