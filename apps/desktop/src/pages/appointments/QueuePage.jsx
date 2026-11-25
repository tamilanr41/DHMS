import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, Play, CheckCircle2, UserCheck, RefreshCw, Stethoscope, Hourglass, Users,
  MessageCircle, Sparkles, Armchair, ChevronRight, Activity, CalendarDays, ArrowUpRight,
  UserPlus, BellRing, Timer
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { todayISO, formatDate, formatTime, humanize, initials } from '../../utils/format.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { EmptyState, Spinner, ErrorState } from '../../components/ui/States.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import PatientTypeBadge from '../../components/PatientTypeBadge.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const DENTAL_CHAIRS = [
  { id: 'chair-1', name: 'Chair 1 · Surgical Suite', type: 'Implants & Oral Surgery', doctor: 'Dr. Sathish' },
  { id: 'chair-2', name: 'Chair 2 · Restorative Operatory', type: 'RCT & Aesthetic Fillings', doctor: 'Dr. Sathish' },
  { id: 'chair-3', name: 'Chair 3 · Ortho & Smile Studio', type: 'Clear Aligners & Braces', doctor: 'Dr. Sathish' },
  { id: 'chair-4', name: 'Chair 4 · Hygiene & Prophylaxis', type: 'Ultrasonic Scaling & Whitening', doctor: 'Dr. Sathish' }
];

export default function QueuePage() {
  const { has, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['queue', date],
    queryFn: async () => (await api.get(`/appointments/queue?date=${date}`)).data,
    refetchInterval: 30_000
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.post(`/appointments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Patient status updated');
    },
    onError: (err) => toast.error(err.message)
  });

  const startConsultation = async (appointment) => {
    try {
      const res = await api.post('/consultations', {
        patientId: appointment.patientId,
        appointmentId: appointment.id
      });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      navigate(`/consultations/${res.data.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openWhatsApp = (e, mobile, patientName) => {
    e.stopPropagation();
    if (!mobile) {
      toast.error('No mobile number on file');
      return;
    }
    const clean = mobile.replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    const msg = encodeURIComponent(
      `Hello ${patientName}, your dental chair is ready at ZhanX Dental Clinic. Please step in.`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const groups = {
    waiting: (data || []).filter((r) => ['checked_in', 'waiting'].includes(r.status)),
    consulting: (data || []).filter((r) => r.status === 'in_consultation')
  };

  const summary = useMemo(() => {
    const total = (data || []).length;
    const checkedIn = (data || []).filter((r) => r.status === 'checked_in').length;
    const completed = (data || []).filter((r) => r.status === 'completed').length;
    return {
      total,
      waiting: groups.waiting.length,
      consulting: groups.consulting.length,
      checkedIn,
      completed
    };
  }, [data, groups.waiting.length, groups.consulting.length]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Doccure Dental Page Header ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-r from-teal-50/80 via-white to-cyan-50/50 p-6 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900">
        <span className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-teal-200/40 blur-3xl dark:bg-teal-900/20" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/70 bg-teal-50 px-3 py-0.5 text-xs font-bold text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Operatory Triage
              </span>
              <span className="text-xs font-semibold text-slate-400">· Downtown Branch</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Waiting Lounge & Chair Flow
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Live patient queue, chair seating triage, and consultation status in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Queue date"
            />
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin text-teal-600' : 'text-slate-500'} />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/appointments?new=1')}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-4 text-xs font-bold text-white shadow-[0_8px_20px_-6px_rgba(10,127,139,0.5)] transition hover:opacity-95"
            >
              <UserPlus size={15} />
              <span>Check-in Patient</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Doccure 4 KPI Summary Cards (Matches Screenshot 1:1) ──────────────── */}
      <section aria-labelledby="queue-kpi-heading">
        <h2 className="sr-only" id="queue-kpi-heading">Queue summary</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DoccureKpiCard
            title="SCHEDULED VISITS"
            value={summary.total}
            subtitle="on roster"
            icon={CalendarDays}
            variant="teal"
          />
          <DoccureKpiCard
            title="WAITING LOUNGE"
            value={summary.waiting}
            subtitle="triage checked-in"
            icon={Clock}
            variant="amber"
          />
          <DoccureKpiCard
            title="IN OPERATORY CHAIR"
            value={summary.consulting}
            subtitle="active care"
            icon={Stethoscope}
            variant="purple"
            hasDot={true}
          />
          <DoccureKpiCard
            title="COMPLETED CARE"
            value={summary.completed}
            subtitle="treated today"
            icon={CheckCircle2}
            variant="emerald"
          />
        </div>
      </section>

      {/* ── Doccure Spotlight: NOW SERVING & CLINIC HEALTH SCORE ──────── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left (8 cols): NOW SERVING - CHAIR 1 Live Spotlight */}
        <div className="lg:col-span-8 rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                <Armchair size={15} />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Live Chair Spotlight
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Care
            </span>
          </div>

          <div className="my-4">
            {groups.consulting.length > 0 ? (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a7f8b] via-[#0d8f9d] to-[#14b8c8] p-5 text-white shadow-md">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-teal-100">
                  <span>NOW SERVING · CHAIR 1</span>
                  <span className="flex items-center gap-1.5 font-mono text-xs">
                    <Timer size={13} className="text-teal-200" />
                    18:42 elapsed
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-4">
                  <PatientAvatar
                    patient={{ id: groups.consulting[0].patientId, fullName: groups.consulting[0].patientName, hasPhoto: groups.consulting[0].hasPhoto }}
                    size={48}
                    className="rounded-2xl ring-2 ring-white/40"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-white">{groups.consulting[0].patientName}</p>
                    <p className="truncate text-xs text-teal-100 font-medium">
                      {groups.consulting[0].reason || humanize(groups.consulting[0].appointmentType)} · Dr. {groups.consulting[0].dentistName}
                    </p>
                  </div>
                </div>

                {/* Animated Glowing Progress Bar */}
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-3/4 rounded-full bg-emerald-300 shadow-sm animate-pulse" />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/20">
                  <span className="text-xs text-teal-100 font-bold">
                    Slot: {formatTime(groups.consulting[0].startTime)} – {formatTime(groups.consulting[0].endTime)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startConsultation(groups.consulting[0])}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-black text-[#0a7f8b] shadow-xs hover:bg-slate-100 transition"
                  >
                    <Stethoscope size={13} />
                    <span>Open Clinical Record</span>
                  </button>
                </div>
              </div>
            ) : groups.waiting.length > 0 ? (
              <div className="rounded-2xl bg-gradient-to-r from-[#0a7f8b] via-[#0d8f9d] to-[#14b8c8] p-5 text-white shadow-md">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-teal-100">
                  <span>NOW SERVING · CHAIR 1</span>
                  <span className="rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-xs text-emerald-100 font-bold">Ready</span>
                </div>
                <div className="mt-2.5">
                  <p className="text-base font-black text-white">Chair 1 Sanitized &amp; Ready for Next Patient</p>
                  <p className="text-xs text-teal-100 mt-0.5">
                    {groups.waiting[0].patientName} is waiting in the lounge.
                  </p>
                </div>
                {has('queue.manage') && (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ id: groups.waiting[0].id, status: 'in_consultation' })}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-[#0a7f8b] shadow-xs hover:bg-slate-100 transition"
                  >
                    <Play size={13} className="fill-[#0a7f8b]" />
                    <span>Seat Next Patient ({groups.waiting[0].patientName.split(' ')[0]})</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-800 dark:bg-slate-850">
                <p className="text-sm font-black text-slate-800 dark:text-white">Operatory Chairs in Standby</p>
                <p className="text-xs text-slate-400 mt-1">Chairs sanitized and ready for check-in patients.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right (4 cols): Clinic Health Score Widget */}
        <div className="lg:col-span-4 rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              Clinic Health Score
            </h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40">
              <span className="size-2 rounded-full bg-emerald-500" />
              Excellent
            </span>
          </div>

          <div className="my-2 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              <svg className="h-28 w-44 overflow-visible" viewBox="0 0 160 90">
                <path
                  d="M 20 80 A 60 60 0 0 1 140 80"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 20 80 A 60 60 0 0 1 140 80"
                  fill="none"
                  stroke="url(#queueHealthGradient)"
                  strokeWidth="12"
                  strokeDasharray="188.5"
                  strokeDashoffset="28.27"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="queueHealthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#14b8c8" />
                    <stop offset="100%" stopColor="#0a7f8b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute bottom-1 text-center">
                <span className="text-3xl font-black text-slate-900 dark:text-white">85</span>
                <p className="text-[10px] font-bold text-slate-400">out of 100</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">86%</p>
              <p className="text-[10px] text-slate-400 font-bold">Chair use</p>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">92%</p>
              <p className="text-[10px] text-slate-400 font-bold">On-time</p>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">88%</p>
              <p className="text-[10px] text-slate-400 font-bold">Collection</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dental Operatory Chairs Live Floor Matrix ────────────────── */}
      <section className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <Armchair size={17} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Operatory Chairs · Live Clinical Floor
              </h2>
              <p className="text-xs text-slate-400">Real-time room occupancy and chair transitions</p>
            </div>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            {groups.consulting.length} of 4 Chairs Occupied
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DENTAL_CHAIRS.map((chair, i) => {
            const occupant = groups.consulting[i];
            return (
              <div
                key={chair.id}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                  occupant
                    ? 'border-teal-200/90 bg-gradient-to-br from-teal-50/70 via-white to-white shadow-[0_8px_20px_-8px_rgba(10,127,139,0.2)] dark:border-teal-900/50 dark:from-slate-900 dark:to-slate-900'
                    : 'border-slate-200/80 bg-slate-50/40 hover:border-teal-300 hover:bg-teal-50/30 dark:border-slate-800 dark:bg-slate-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-extrabold text-slate-800 dark:text-white">
                      {chair.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        occupant
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${occupant ? 'bg-teal-600 animate-pulse' : 'bg-emerald-500'}`} />
                      {occupant ? 'In Treatment' : 'Ready'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">{chair.type}</p>

                  {occupant ? (
                    <div className="mt-3.5 rounded-xl border border-teal-100/80 bg-white/90 p-2.5 shadow-sm dark:border-teal-900/40 dark:bg-slate-800/90">
                      <div className="flex items-center gap-2.5">
                        <PatientAvatar
                          patient={{ id: occupant.patientId, fullName: occupant.patientName, hasPhoto: occupant.hasPhoto }}
                          size={34}
                          className="rounded-xl shadow-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                            {occupant.patientName}
                          </p>
                          <p className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">
                            {chair.doctor} · {humanize(occupant.appointmentType)}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            Slot: {formatTime(occupant.startTime)} – {formatTime(occupant.endTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-4 py-1 text-center text-xs font-semibold text-slate-400">
                      Chair sanitized & ready for next patient
                    </div>
                  )}
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  {occupant ? (
                    <button
                      type="button"
                      onClick={() => startConsultation(occupant)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] py-2 text-xs font-bold text-white shadow-[0_6px_16px_-4px_rgba(10,127,139,0.5)] transition hover:opacity-95"
                    >
                      <Stethoscope size={13} />
                      <span>Open Clinical Record</span>
                    </button>
                  ) : groups.waiting.length > 0 && has('queue.manage') ? (
                    <button
                      type="button"
                      onClick={() =>
                        statusMutation.mutate({ id: groups.waiting[0].id, status: 'in_consultation' })
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 py-2 text-xs font-bold text-teal-700 transition hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                    >
                      <span>Seat Next ({groups.waiting[0].patientName.split(' ')[0]})</span>
                    </button>
                  ) : (
                    <span className="block py-1 text-center text-[10.5px] font-semibold text-slate-400">
                      Standby
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Main Queue Triage Columns (Doccure Numbered Style) ───────── */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (data || []).length === 0 ? (
        <EmptyState
          title="Waiting Lounge is Clear"
          message={`No patients are currently waiting or undergoing treatment for ${formatDate(date)}.`}
          icon={UserCheck}
          action={
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => navigate('/appointments')}
            >
              Open Appointments
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Column 1: Waiting Lounge (Up Next in Reception) */}
          <section className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Waiting Lounge · Up Next
                  </h2>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {groups.waiting.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Patients present in reception awaiting chair triage</p>
              </div>
            </div>

            {groups.waiting.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No patients currently waiting in the lounge.
              </div>
            ) : (
              <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                {groups.waiting.map((r, idx) => (
                  <li key={r.id} className="py-3.5 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Doccure Numbered Queue Crest */}
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-teal-400 bg-white text-xs font-black text-teal-800 shadow-sm dark:border-teal-600 dark:bg-slate-800 dark:text-teal-300">
                          {idx + 1}
                        </span>

                        <PatientAvatar
                          patient={{ id: r.patientId, fullName: r.patientName, hasPhoto: r.hasPhoto }}
                          size={38}
                          className="rounded-xl shadow-xs"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                              {r.patientName}
                            </p>
                            <PatientTypeBadge isNew={r.isNewPatient} visitCount={r.visitCount} size="sm" />
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {r.patientNo}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Dr. {r.dentistName}</span>
                            <span>·</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {humanize(r.appointmentType)}
                            </span>
                            {r.mobile && (
                              <>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={(e) => openWhatsApp(e, r.mobile, r.patientName)}
                                  className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                >
                                  <MessageCircle size={12} className="text-emerald-500" />
                                  <span>{r.mobile}</span>
                                </button>
                              </>
                            )}
                          </div>

                          <p className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-slate-400">
                            <Clock size={11} className="text-slate-400" />
                            Slot: {formatTime(r.startTime)} – {formatTime(r.endTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <Badge status={r.status} />
                        <span className="text-[10px] font-bold text-slate-400">In Queue</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      {has('queue.manage') && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: r.id, status: 'in_consultation' })}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_-4px_rgba(10,127,139,0.5)] transition hover:opacity-95"
                        >
                          <Play size={12} className="fill-white" />
                          <span>Call into Chair</span>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Column 2: In Operatory Chair (Active Dental Treatment) */}
          <section className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    In Operatory Chair · Active Care
                  </h2>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-black text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                    {groups.consulting.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Patients currently undergoing treatment or doctor consultation</p>
              </div>
            </div>

            {groups.consulting.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                All chairs are currently sanitized and ready for new patients.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {groups.consulting.map((r) => (
                  <li key={r.id} className="py-3.5 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <PatientAvatar
                          patient={{ id: r.patientId, fullName: r.patientName, hasPhoto: r.hasPhoto }}
                          size={40}
                          className="rounded-xl shadow-xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                              {r.patientName}
                            </p>
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                              In Chair
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Dr. {r.dentistName}</span>
                            <span>·</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {humanize(r.appointmentType)}
                            </span>
                          </div>

                          <p className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-teal-600 dark:text-teal-400 font-semibold">
                            <Clock size={11} />
                            Slot: {formatTime(r.startTime)} – {formatTime(r.endTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <Badge status={r.status} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => startConsultation(r)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_-4px_rgba(10,127,139,0.5)] transition hover:opacity-95"
                      >
                        <Stethoscope size={13} />
                        <span>Open Clinical Record</span>
                      </button>

                      {has('queue.manage') && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: r.id, status: 'completed' })}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          <span>Discharge Chair</span>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
