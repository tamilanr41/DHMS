import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  LayoutGrid,
  List,
  Play,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  MessageCircle,
  Phone,
  Stethoscope,
  Sparkles,
  Users,
  Timer,
  CalendarCheck2,
  Armchair,
  Eye,
  Sun,
  Moon,
  ArrowRight,
  SlidersHorizontal,
  Table as TableIcon
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { todayISO, addDaysISO, formatDate, formatTime, humanize, initials } from '../../utils/format.js';
import Button, { IconButton } from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import AppointmentFormModal from './AppointmentFormModal.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import PatientTypeBadge from '../../components/PatientTypeBadge.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';
import { showDoctorNotification, sendDoctorWhatsAppAlert } from '../../services/soundAndNotification.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ToothIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 2c-2.5 0-4.5 2-4.5 4.5 0 2.2 1.3 4.2 2 6 .8 2 1.5 5 2.5 7.5.5 1.2 1.8 2 3 2s2-.8 2.5-2c.6-1.5 1.1-3 1.5-4.5.4 1.5.9 3 1.5 4.5.5 1.2 1.3 2 2.5 2s2.5-.8 3-2c1-2.5 1.7-5.5 2.5-7.5.7-1.8 2-3.8 2-6C21.5 4 19.5 2 17 2c-2 0-3.5 1-5 2.5C10.5 3 9 2 7 2z" />
    </svg>
  );
}

const NEXT_ACTIONS = {
  scheduled: [
    { to: 'confirmed', label: 'Confirm' },
    { to: 'checked_in', label: 'Check in' },
    { to: 'no_show', label: 'No show' }
  ],
  confirmed: [
    { to: 'checked_in', label: 'Check in' },
    { to: 'no_show', label: 'No show' }
  ],
  checked_in: [{ to: 'waiting', label: 'Mark waiting' }, { to: 'in_consultation', label: 'Start chair' }],
  waiting: [{ to: 'in_consultation', label: 'Start chair' }],
  in_consultation: [{ to: 'completed', label: 'Complete care' }]
};

const PRIMARY_ACTION = {
  scheduled: { to: 'checked_in', label: 'Check in', icon: UserCheck, color: 'bg-[#0a7f8b] hover:bg-[#086771] text-white' },
  confirmed: { to: 'checked_in', label: 'Check in', icon: UserCheck, color: 'bg-[#0a7f8b] hover:bg-[#086771] text-white' },
  checked_in: { to: 'in_consultation', label: 'Start chair', icon: Play, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  waiting: { to: 'in_consultation', label: 'Start chair', icon: Play, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  in_consultation: { to: 'completed', label: 'Complete', icon: CheckCircle2, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' }
};

const STATUS_DOT = {
  scheduled: 'bg-sky-400',
  confirmed: 'bg-[#0a7f8b]',
  checked_in: 'bg-amber-500',
  waiting: 'bg-amber-400',
  in_consultation: 'bg-purple-500 animate-pulse',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  no_show: 'bg-red-500'
};

const STATUS_COLOR = {
  scheduled: '#38bdf8',
  confirmed: '#0a7f8b',
  checked_in: '#f59e0b',
  waiting: '#fbbf24',
  in_consultation: '#a855f7',
  completed: '#10b981',
  cancelled: '#f87171',
  no_show: '#ef4444'
};

const STATUS_OPTIONS = ['scheduled', 'confirmed', 'checked_in', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'];

const VIEWS = [
  { value: 'day', label: 'Day Timeline', icon: CalendarDays, title: 'Day timeline schedule' },
  { value: 'week', label: 'Week Board', icon: LayoutGrid, title: 'Week board' },
  { value: 'calendar', label: 'Calendar', icon: CalendarRange, title: 'Month calendar' },
  { value: 'list', label: 'List View', icon: List, title: 'List view' }
];

function parseISO(iso) {
  return new Date(`${iso}T00:00:00`);
}

function toISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function mondayOf(iso) {
  const d = parseISO(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toISO(d);
}

function monthStartOf(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function monthEndOf(iso) {
  const d = parseISO(monthStartOf(iso));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISO(d);
}

function addMonthsISO(iso, months) {
  const d = parseISO(monthStartOf(iso));
  d.setMonth(d.getMonth() + months);
  return toISO(d);
}

function formatLongDate(iso) {
  return parseISO(iso).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatWeekday(iso) {
  return parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short' });
}

function formatMonthLabel(iso) {
  return parseISO(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDayNumber(iso) {
  return parseISO(iso).getDate();
}

function calculateDurationMinutes(start, end) {
  if (!start || !end) return '30m';
  try {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? `${diff}m` : '30m';
  } catch {
    return '30m';
  }
}

export default function AppointmentsPage() {
  const { has } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState('day');
  const [dayLayout, setDayLayout] = useState('cards'); // 'cards' (Doccure timeline) or 'table'
  const [date, setDate] = useState(params.get('date') || todayISO());
  const [dentistId, setDentistId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [defaultPatient, setDefaultPatient] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const patientIdParam = params.get('patientId');
  const canManage = has('appointments.manage');

  const patientQuery = useQuery({
    queryKey: ['patient', patientIdParam],
    queryFn: async () => (await api.get(`/patients/${patientIdParam}`)).data,
    enabled: Boolean(patientIdParam)
  });

  useEffect(() => {
    if (params.get('new') === '1' && patientIdParam) {
      if (patientQuery.data) {
        setDefaultPatient(patientQuery.data);
        setFormOpen(true);
        const next = new URLSearchParams(params);
        next.delete('new');
        next.delete('patientId');
        setParams(next, { replace: true });
      }
    } else if (params.get('new') === '1') {
      setFormOpen(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientQuery.data, params]);

  useEffect(() => {
    if (params.get('date')) setDate(params.get('date'));
  }, [params]);

  const weekStart = useMemo(() => mondayOf(date), [date]);
  const weekEnd = useMemo(() => addDaysISO(weekStart, 6), [weekStart]);
  const monthStart = useMemo(() => monthStartOf(date), [date]);
  const monthEnd = useMemo(() => monthEndOf(date), [date]);
  const listEnd = useMemo(() => addDaysISO(date, 30), [date]);

  const queryRange = useMemo(() => {
    if (mode === 'day') return { startDate: date, endDate: date };
    if (mode === 'week') return { startDate: weekStart, endDate: weekEnd };
    if (mode === 'calendar') return { startDate: monthStart, endDate: monthEnd };
    return { startDate: date, endDate: listEnd };
  }, [mode, date, weekStart, weekEnd, monthStart, monthEnd, listEnd]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['appointments', mode, queryRange.startDate, queryRange.endDate, dentistId, status, search],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (mode === 'day') {
        qs.set('date', date);
      } else {
        qs.set('startDate', queryRange.startDate);
        qs.set('endDate', queryRange.endDate);
      }
      if (dentistId) qs.set('dentistId', dentistId);
      if (status) qs.set('status', status);
      if (search.trim()) qs.set('q', search.trim());
      return (await api.get(`/appointments?${qs}`)).data;
    }
  });

  const dentists = useQuery({
    queryKey: ['dentists'],
    queryFn: async () => (await api.get('/users/dentists')).data,
    staleTime: 5 * 60_000
  });

  const rows = data || [];

  const summary = useMemo(() => ({
    total: rows.length,
    waiting: rows.filter((r) => ['checked_in', 'waiting'].includes(r.status)).length,
    inProgress: rows.filter((r) => r.status === 'in_consultation').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    closed: rows.filter((r) => ['cancelled', 'no_show'].includes(r.status)).length
  }), [rows]);

  const morningRows = useMemo(() => {
    return rows.filter((r) => {
      const h = parseInt((r.startTime || '09:00').split(':')[0], 10);
      return h < 12;
    });
  }, [rows]);

  const afternoonRows = useMemo(() => {
    return rows.filter((r) => {
      const h = parseInt((r.startTime || '12:00').split(':')[0], 10);
      return h >= 12;
    });
  }, [rows]);

  const hasFilters = Boolean(dentistId || status || search.trim());

  const shift = (dir) => {
    if (mode === 'calendar') setDate(addMonthsISO(date, dir));
    else if (mode === 'week') setDate(addDaysISO(date, dir * 7));
    else if (mode === 'list') setDate(addDaysISO(date, dir * 30));
    else setDate(addDaysISO(date, dir));
  };

  const rangeLabel =
    mode === 'day'
      ? formatLongDate(date)
      : mode === 'week'
        ? `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
        : mode === 'calendar'
          ? formatMonthLabel(date)
          : `${formatDate(date)} – ${formatDate(listEnd)}`;

  const rangeMeta =
    mode === 'day'
      ? 'Daily operatory schedule'
      : mode === 'week'
        ? 'Monday to Sunday'
        : mode === 'calendar'
          ? `${monthStart.slice(0, 7)} · month view`
          : 'Next 31 days';

  const clearFilters = () => {
    setDentistId('');
    setStatus('');
    setSearch('');
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status: next, note }) => api.post(`/appointments/${id}/status`, { status: next, note }),
    onSuccess: () => {
      toast.success('Appointment status updated');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(err.message)
  });

  const runStatus = (appointment, next) => {
    // 1. Trigger doctor native sound chime & notification on status change
    if (['checked_in', 'waiting'].includes(next)) {
      showDoctorNotification({
        title: `🚨 Patient Arrived: ${appointment.patientName}`,
        body: `Patient checked in for ${formatTime(appointment.startTime)} with Dr. ${appointment.dentistName || 'Dentist'}. Currently in waiting lounge.`
      });
    } else if (next === 'in_consultation') {
      showDoctorNotification({
        title: `💺 In Chair: ${appointment.patientName}`,
        body: `Operatory consultation started for ${appointment.patientName}.`
      });
    }

    statusMutation.mutate({ id: appointment.id, status: next });
  };

  const notifyDoctorWhatsApp = (e, appointment, eventType = 'checked_in') => {
    e.stopPropagation();
    // Look up doctor phone or clinic doctor
    const targetDoctor = (dentists.data || []).find((d) => d.id === appointment.dentistId);
    const doctorPhone = targetDoctor?.phone || targetDoctor?.mobile || user?.phone;

    if (!doctorPhone) {
      toast.info('Please enter Doctor mobile number in Staff / Doctor master settings.');
      return;
    }

    sendDoctorWhatsAppAlert(doctorPhone, {
      doctorName: appointment.dentistName || targetDoctor?.fullName || user?.fullName,
      patientName: appointment.patientName,
      time: `${formatDate(appointment.appointmentDate)} at ${formatTime(appointment.startTime)}`,
      reason: appointment.reason,
      event: eventType
    });
  };

  const openWhatsApp = (e, mobile, patientName) => {
    e.stopPropagation();
    if (!mobile) {
      toast.error('No mobile number on file');
      return;
    }
    const clean = mobile.replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    const msg = encodeURIComponent(`Hello ${patientName}, this is ZhanX DentalCare regarding your appointment. Please let us know if you need any assistance!`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const patientCell = (r) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <PatientAvatar
        patient={{ id: r.patientId, fullName: r.patientName, hasPhoto: r.hasPhoto }}
        size={36}
        className="rounded-xl shadow-xs"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-slate-800 dark:text-white hover:text-[#0a7f8b] cursor-pointer" onClick={() => setDetailId(r.id)}>{r.patientName}</p>
          <PatientTypeBadge isNew={r.isNewPatient} visitCount={r.visitCount} size="sm" />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="font-mono text-slate-400">{r.patientNo}</span>
          {r.mobile && (
            <>
              <span>·</span>
              <button
                type="button"
                onClick={(e) => openWhatsApp(e, r.mobile, r.patientName)}
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                title="Send WhatsApp message"
              >
                <MessageCircle size={11} className="text-emerald-500" />
                {r.mobile}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const actionsCell = (r) => {
    const action = PRIMARY_ACTION[r.status];
    return (
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {/* Doctor Phone Alert Button */}
        <button
          type="button"
          onClick={(e) => notifyDoctorWhatsApp(e, r, r.status === 'scheduled' ? 'booked' : 'checked_in')}
          className="flex h-8 items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          title="Alert Doctor on WhatsApp"
        >
          <Phone size={12} className="text-emerald-600" />
          <span className="hidden sm:inline">Alert Dr</span>
        </button>

        {r.mobile && (
          <button
            type="button"
            onClick={(e) => openWhatsApp(e, r.mobile, r.patientName)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            title="Chat with Patient on WhatsApp"
          >
            <MessageCircle size={14} />
          </button>
        )}
        {canManage && action ? (
          <button
            type="button"
            onClick={() => runStatus(r, action.to)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${action.color}`}
          >
            <action.icon size={13} />
            {action.label}
          </button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setDetailId(r.id)}>View</Button>
        )}
      </div>
    );
  };

  const dayColumns = [
    {
      key: 'startTime',
      label: 'Time',
      width: 100,
      render: (r) => (
        <div className="rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-100/80 dark:border-teal-900/40 px-2 py-1 inline-block">
          <p className="font-black tabular-nums text-teal-800 dark:text-teal-200 text-xs">{formatTime(r.startTime)}</p>
          <p className="text-[10px] tabular-nums text-teal-600/80 dark:text-teal-400 font-medium">{calculateDurationMinutes(r.startTime, r.endTime)}</p>
        </div>
      )
    },
    { key: 'patientName', label: 'Patient', render: patientCell },
    {
      key: 'dentistName',
      label: 'Dentist & Operatory',
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-white text-xs">{r.dentistName}</p>
          <p className="text-[11px] text-slate-500">{humanize(r.appointmentType)}</p>
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Procedure / Reason',
      render: (r) => <span className="line-clamp-2 block max-w-[220px] text-[12px] leading-snug text-slate-600 dark:text-slate-300 font-medium">{r.reason || 'Routine checkup & consultation'}</span>
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', align: 'right', width: 140, render: actionsCell }
  ];

  const listColumns = [
    {
      key: 'appointmentDate',
      label: 'Date',
      width: 130,
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-white">{formatDate(r.appointmentDate)}</p>
          <p className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold">{formatWeekday(r.appointmentDate)}</p>
        </div>
      )
    },
    {
      key: 'startTime',
      label: 'Time',
      width: 96,
      render: (r) => (
        <div>
          <p className="font-bold tabular-nums text-slate-800 dark:text-white">{formatTime(r.startTime)}</p>
          <p className="text-[10.5px] tabular-nums text-slate-400">to {formatTime(r.endTime)}</p>
        </div>
      )
    },
    { key: 'patientName', label: 'Patient', render: patientCell },
    { key: 'dentistName', label: 'Dentist' },
    { key: 'appointmentType', label: 'Type', render: (r) => <span className="text-slate-600 font-medium">{humanize(r.appointmentType)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', align: 'right', width: 130, render: actionsCell }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Doccure Dental Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a7f8b] via-[#0e95a3] to-[#14b8c8] p-6 text-white shadow-[0_20px_50px_-20px_rgba(10,127,139,0.35)]">
        <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-25">
          <img src={heroTooth} alt="" className="h-56 w-56 object-contain" />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-2 backdrop-blur-md shadow-inner">
              <img src={heroTooth} alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">Appointments &amp; Operatory Schedule</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  Operatory Live
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                Daily clinical schedule, reception triage, chair occupancy, and instant WhatsApp communication.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/queue')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] border border-white/25 shadow-sm"
            >
              <Armchair size={15} />
              Waiting Lounge ({summary.waiting})
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => { setDefaultPatient(null); setFormOpen(true); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
              >
                <Plus size={16} className="text-[#0a7f8b]" />
                Book Appointment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Reception Command 4 KPI Strip (Matches Screenshot 1:1) ───────────────── */}
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
          icon={Clock3}
          variant="amber"
        />
        <DoccureKpiCard
          title="IN OPERATORY CHAIR"
          value={summary.inProgress}
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

      {/* Control & Date Navigation Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date Picker & Shift */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
              <IconButton icon={ChevronLeft} label={`Previous ${mode}`} size="sm" variant="ghost" onClick={() => shift(-1)} />
              <button
                type="button"
                onClick={() => setDate(todayISO())}
                className="rounded-xl px-3 py-1 text-xs font-black text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                Today
              </button>
              <IconButton icon={ChevronRight} label={`Next ${mode}`} size="sm" variant="ghost" onClick={() => shift(1)} />
            </div>

            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-9 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Appointment date"
            />

            <div className="ml-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">{rangeLabel}</span>
                {isFetching && <Spinner size={13} />}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{rangeMeta} · {rows.length} visits</span>
            </div>
          </div>

          {/* View Modes Tabs & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'day' && (
              <div className="flex rounded-2xl border border-teal-100 bg-teal-50/50 p-1 dark:border-teal-900/40 dark:bg-teal-950/20 mr-2">
                <button
                  type="button"
                  title="Timeline Cards"
                  onClick={() => setDayLayout('cards')}
                  className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-all ${
                    dayLayout === 'cards' ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-[#0a7f8b] hover:bg-teal-100/60'
                  }`}
                >
                  <CalendarDays size={13} />
                  Cards
                </button>
                <button
                  type="button"
                  title="Table View"
                  onClick={() => setDayLayout('table')}
                  className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-all ${
                    dayLayout === 'table' ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-[#0a7f8b] hover:bg-teal-100/60'
                  }`}
                >
                  <TableIcon size={13} />
                  Table
                </button>
              </div>
            )}

            <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800" role="tablist">
              {VIEWS.map(({ value, label, icon: Icon, title }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  title={title}
                  onClick={() => setMode(value)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition-all ${
                    mode === value ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <IconButton icon={RefreshCw} label="Refresh appointments" size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching} />
          </div>
        </div>

        {/* Filters Strip */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="relative min-w-0 w-full sm:w-auto sm:min-w-[200px] max-w-[280px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, mobile, reason..."
              className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <select
            value={dentistId}
            onChange={(e) => setDentistId(e.target.value)}
            className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">All Dentists</option>
            {(dentists.data || []).map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-black text-[#0a7f8b] hover:underline"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto hidden xl:flex items-center gap-3 text-xs text-slate-500 font-semibold">
            <SummaryItem dot="bg-slate-400" label="Total" value={summary.total} />
            <SummaryItem dot="bg-amber-500" label="Waiting" value={summary.waiting} />
            <SummaryItem dot="bg-purple-500" label="In Chair" value={summary.inProgress} />
            <SummaryItem dot="bg-emerald-500" label="Done" value={summary.completed} />
          </div>
        </div>
      </div>

      {/* Main Content Areas */}
      {mode === 'day' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
          {/* Left Column (8 cols): Today's Appointments Timeline / Table */}
          <div className="xl:col-span-8">
            {dayLayout === 'cards' ? (
              <DoccureDayCards
                rows={rows}
                morningRows={morningRows}
                afternoonRows={afternoonRows}
                loading={isLoading}
                error={error}
                date={date}
                onRetry={refetch}
                onOpenDetails={(id) => setDetailId(id)}
                onRunStatus={runStatus}
                onWhatsApp={openWhatsApp}
                canManage={canManage}
                onNew={() => { setDefaultPatient(null); setFormOpen(true); }}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
              />
            ) : (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <DataTable
                  columns={dayColumns}
                  rows={rows}
                  loading={isLoading}
                  error={error}
                  onRetry={refetch}
                  onRowClick={(r) => setDetailId(r.id)}
                  emptyTitle={hasFilters ? 'No matching appointments' : 'No appointments scheduled'}
                  emptyMessage={
                    hasFilters
                      ? 'No appointments match the current filters. Clear the filters or select another date.'
                      : `Nothing is booked for ${formatLongDate(date)}. Create a new appointment to get started.`
                  }
                  emptyAction={
                    hasFilters
                      ? <Button size="sm" variant="secondary" onClick={clearFilters} className="mt-2">Clear filters</Button>
                      : canManage ? <Button size="sm" icon={Plus} onClick={() => { setDefaultPatient(null); setFormOpen(true); }} className="mt-2">New appointment</Button> : null
                  }
                  footer={
                    rows.length > 0 && (
                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-4 py-2">
                        <span>{rows.length} appointment{rows.length === 1 ? '' : 's'} on this day</span>
                        <span>{summary.completed} completed · {summary.waiting} waiting in lounge</span>
                      </div>
                    )
                  }
                />
              </div>
            )}
          </div>

          {/* Right Column (4 cols): Today's Patient Queue & Clinic Health Score (Matches Screenshot 1) */}
          <div className="space-y-6 xl:col-span-4">
            <TodayPatientQueueWidget
              rows={rows}
              summary={summary}
              onOpenDetails={(id) => setDetailId(id)}
              onOpenWaitingRoom={() => navigate('/queue')}
              onRunStatus={runStatus}
              canManage={canManage}
            />
            <ClinicHealthScoreWidget summary={summary} />
          </div>
        </div>
      )}

      {mode === 'week' && (
        <WeekBoard
          weekStart={weekStart}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onOpenDay={(d) => { setDate(d); setMode('day'); }}
          onOpenAppointment={(r) => setDetailId(r.id)}
          onNew={(d) => { setDate(d); setDefaultPatient(null); setFormOpen(true); }}
          canCreate={canManage}
        />
      )}

      {mode === 'calendar' && (
        <MonthCalendar
          date={date}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          onOpenDay={(d) => { setDate(d); setMode('day'); }}
          onOpenAppointment={(r) => setDetailId(r.id)}
          canCreate={canManage}
        />
      )}

      {mode === 'list' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <DataTable
            columns={listColumns}
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            onRowClick={(r) => setDetailId(r.id)}
            emptyTitle={hasFilters ? 'No matching appointments' : 'No upcoming appointments'}
            emptyMessage={
              hasFilters
                ? 'No appointments in this period match the current filters.'
                : `There are no appointments scheduled between ${formatDate(date)} and ${formatDate(listEnd)}.`
            }
            emptyAction={canManage ? <Button size="sm" icon={Plus} onClick={() => { setDefaultPatient(null); setFormOpen(true); }} className="mt-2">New appointment</Button> : null}
            footer={
              rows.length > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-4 py-2">
                  <span>{rows.length} appointment{rows.length === 1 ? '' : 's'} · {formatDate(date)} to {formatDate(listEnd)}</span>
                  <span>Upcoming schedule list</span>
                </div>
              )
            }
          />
        </div>
      )}

      {/* Modals & Drawers */}
      <AppointmentFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setDefaultPatient(null); }}
        defaultDate={date}
        defaultPatient={defaultPatient}
      />
      {reschedule && (
        <AppointmentFormModal open={Boolean(reschedule)} onClose={() => setReschedule(null)} appointment={reschedule} defaultDate={date} />
      )}

      <AppointmentDetail
        id={detailId}
        onClose={() => setDetailId(null)}
        onReschedule={(a) => { setDetailId(null); setReschedule(a); }}
        onStatus={(id, next) => statusMutation.mutate({ id, status: next })}
        canManage={canManage}
        statusPending={statusMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel appointment"
        message={cancelTarget ? `Cancel ${cancelTarget.appointmentNo} for ${cancelTarget.patientName}? The appointment remains in history marked as cancelled.` : ''}
        confirmLabel="Cancel appointment"
        loading={statusMutation.isPending}
        onConfirm={() => {
          statusMutation.mutate({ id: cancelTarget.id, status: 'cancelled', note: 'Cancelled from appointments screen' }, {
            onSuccess: () => setCancelTarget(null)
          });
        }}
      />
    </div>
  );
}

function SummaryItem({ dot, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}:</span>
      <span className="font-black tabular-nums text-slate-800 dark:text-white">{value}</span>
    </span>
  );
}

/* ── Today's Patient Queue Widget (Matching Screenshot 1) ───────────────── */
function TodayPatientQueueWidget({ rows, summary, onOpenDetails, onOpenWaitingRoom, onRunStatus, canManage }) {
  const inChair = rows.find((r) => r.status === 'in_consultation');
  const waitingPatients = rows.filter((r) => ['checked_in', 'waiting'].includes(r.status));
  const upcomingScheduled = rows.filter((r) => ['scheduled', 'confirmed'].includes(r.status));
  const upNextList = [...waitingPatients, ...upcomingScheduled].slice(0, 4);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Today's Patient Queue</h3>
          <p className="text-[11px] font-bold text-slate-400">
            {summary.waiting + summary.inProgress} patients in clinic
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* NOW SERVING - CHAIR 1 (Dark Teal Card) */}
      <div className="mt-4">
        {inChair ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a7f8b] via-[#0d8f9d] to-[#14b8c8] p-4 text-white shadow-md">
            <div className="flex items-center justify-between text-[10.5px] font-black tracking-wider uppercase text-teal-100">
              <span>NOW SERVING · CHAIR 1</span>
              <span className="flex items-center gap-1 font-mono text-xs">
                <Timer size={12} className="text-teal-200" />
                18:42 elapsed
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <PatientAvatar
                patient={{ id: inChair.patientId, fullName: inChair.patientName, hasPhoto: inChair.hasPhoto }}
                size={40}
                className="rounded-xl ring-2 ring-white/30"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{inChair.patientName}</p>
                <p className="truncate text-xs text-teal-100 font-medium">
                  {inChair.reason || humanize(inChair.appointmentType)}
                </p>
              </div>
            </div>

            {/* Glowing Progress Bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-3/4 rounded-full bg-emerald-300 shadow-sm transition-all duration-500" />
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/15">
              <span className="text-[10px] text-teal-100 font-bold">Attending: Dr. {inChair.dentistName}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onRunStatus(inChair, 'completed')}
                  className="rounded-xl bg-white px-2.5 py-1 text-[11px] font-black text-[#0a7f8b] shadow-xs hover:bg-slate-100 transition"
                >
                  Complete Care
                </button>
              )}
            </div>
          </div>
        ) : waitingPatients.length > 0 ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a7f8b] via-[#0d8f9d] to-[#14b8c8] p-4 text-white shadow-md">
            <div className="flex items-center justify-between text-[10.5px] font-black tracking-wider uppercase text-teal-100">
              <span>NOW SERVING · CHAIR 1</span>
              <span className="rounded-full bg-emerald-400/25 px-2 py-0.5 text-[10px] text-emerald-100 font-bold">Ready</span>
            </div>
            <div className="mt-2.5">
              <p className="text-sm font-black text-white">Chair Sanitized &amp; Ready</p>
              <p className="text-xs text-teal-100">{waitingPatients.length} patient(s) waiting in lounge.</p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => onRunStatus(waitingPatients[0], 'in_consultation')}
                className="mt-3 w-full rounded-xl bg-white py-1.5 text-xs font-black text-[#0a7f8b] shadow-xs hover:bg-slate-100 transition text-center"
              >
                Seat Next ({waitingPatients[0].patientName.split(' ')[0]})
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center dark:border-slate-800 dark:bg-slate-850">
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">Chair 1 · Operatory Standby</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Sanitized and prepped for next incoming appointment.</p>
          </div>
        )}
      </div>

      {/* UP NEXT LIST (Screenshot 1 Numbered Triage) */}
      <div className="mt-5">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
          UP NEXT IN LOUNGE
        </h4>

        {upNextList.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400 font-medium">No queue items pending</p>
        ) : (
          <div className="space-y-2.5">
            {upNextList.map((item, idx) => {
              const isWaiting = ['checked_in', 'waiting'].includes(item.status);
              return (
                <div
                  key={item.id}
                  onClick={() => onOpenDetails(item.id)}
                  className="flex items-center justify-between gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 transition hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-850 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#0a7f8b] shadow-2xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-teal-300">
                      {idx + 1}
                    </span>
                    <PatientAvatar
                      patient={{ id: item.patientId, fullName: item.patientName, hasPhoto: item.hasPhoto }}
                      size={28}
                      className="rounded-lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-800 dark:text-white">
                        {item.patientName}
                      </p>
                      <p className="truncate text-[10px] text-slate-400 font-medium">
                        {item.reason || humanize(item.appointmentType)}
                        {isWaiting ? ' · Waiting' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-black ${
                      isWaiting
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300'
                    }`}>
                      {isWaiting ? 'In 5m' : formatTime(item.startTime)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Open Waiting Room Button */}
      <button
        type="button"
        onClick={onOpenWaitingRoom}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-black text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-[#0a7f8b] transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750"
      >
        <span>Open waiting room</span>
        <ArrowRight size={14} className="text-[#0a7f8b]" />
      </button>
    </div>
  );
}

/* ── Clinic Health Score Widget (Matching Screenshot 1) ─────────────────── */
function ClinicHealthScoreWidget({ summary }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">Clinic Health Score</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-500" />
          Excellent
        </span>
      </div>

      {/* Semicircular Gauge (85 out of 100) */}
      <div className="my-4 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg className="h-32 w-48 overflow-visible" viewBox="0 0 160 90">
            {/* Background Arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Animated Teal Arc (85%) */}
            <path
              d="M 20 80 A 60 60 0 0 1 140 80"
              fill="none"
              stroke="url(#healthScoreGradient)"
              strokeWidth="12"
              strokeDasharray="188.5"
              strokeDashoffset="28.27"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="healthScoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8c8" />
                <stop offset="100%" stopColor="#0a7f8b" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute bottom-2 text-center">
            <span className="text-3xl font-black text-slate-900 dark:text-white">85</span>
            <p className="text-[10px] font-bold text-slate-400">out of 100</p>
          </div>
        </div>
      </div>

      {/* 3-Pill Bottom Strip */}
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
  );
}

/* Doccure Dental Day View - Interactive Timeline Cards */
function DoccureDayCards({
  rows,
  morningRows,
  afternoonRows,
  loading,
  error,
  date,
  onRetry,
  onOpenDetails,
  onRunStatus,
  onWhatsApp,
  canManage,
  onNew,
  hasFilters,
  onClearFilters
}) {
  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={32} />
          <p className="text-xs font-bold text-slate-500">Loading daily appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-[#0a7f8b] mb-4">
          <CalendarDays size={28} />
        </div>
        <h3 className="text-base font-black text-slate-800 dark:text-white">
          {hasFilters ? 'No matching appointments found' : `No appointments for ${formatLongDate(date)}`}
        </h3>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          {hasFilters
            ? 'Try adjusting your filters or search terms to find what you are looking for.'
            : 'The operatory schedule is open for this day. You can book an appointment anytime.'}
        </p>
        <div className="mt-5">
          {hasFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
            >
              Clear filters
            </button>
          ) : canManage ? (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#0a7f8b] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#086771] transition"
            >
              <Plus size={15} />
              Book Appointment
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Morning Section */}
      {morningRows.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40">
                <Sun size={15} />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Morning Session</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {morningRows.length} visit{morningRows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-3">
            {morningRows.map((appt) => (
              <AppointmentCardRow
                key={appt.id}
                appt={appt}
                onOpenDetails={onOpenDetails}
                onRunStatus={onRunStatus}
                onWhatsApp={onWhatsApp}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      )}

      {/* Afternoon Section */}
      {afternoonRows.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40">
                <Moon size={15} />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Afternoon &amp; Evening Session</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {afternoonRows.length} visit{afternoonRows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-3">
            {afternoonRows.map((appt) => (
              <AppointmentCardRow
                key={appt.id}
                appt={appt}
                onOpenDetails={onOpenDetails}
                onRunStatus={onRunStatus}
                onWhatsApp={onWhatsApp}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Single Appointment Card Row styled after Screenshot 1 */
function AppointmentCardRow({ appt, onOpenDetails, onRunStatus, onWhatsApp, canManage }) {
  const duration = calculateDurationMinutes(appt.startTime, appt.endTime);
  const primary = PRIMARY_ACTION[appt.status];

  return (
    <div
      onClick={() => onOpenDetails(appt.id)}
      className="group relative flex flex-col gap-3 rounded-2xl border border-slate-100/90 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#14b8c8]/40 hover:shadow-[0_8px_20px_-8px_rgba(10,127,139,0.18)] dark:border-slate-800/80 dark:bg-slate-850 dark:hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
    >
      {/* Left: Time pill */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-teal-50/80 border border-teal-100/80 text-[#0a7f8b] dark:bg-teal-950/30 dark:border-teal-900/40">
          <span className="text-xs font-black tabular-nums">{formatTime(appt.startTime)}</span>
          <span className="text-[10px] font-bold text-teal-600/80 dark:text-teal-400">{duration}</span>
        </div>

        {/* Patient Info */}
        <div className="flex items-center gap-3 min-w-0">
          <PatientAvatar
            patient={{ id: appt.patientId, fullName: appt.patientName, hasPhoto: appt.hasPhoto }}
            size={42}
            className="rounded-2xl shadow-xs ring-1 ring-slate-100 dark:ring-slate-800"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-black text-slate-800 dark:text-white group-hover:text-[#0a7f8b] transition-colors">
                {appt.patientName}
              </span>
              <PatientTypeBadge isNew={appt.isNewPatient} visitCount={appt.visitCount} size="sm" />
            </div>
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {appt.reason || 'General Dental Examination'}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-slate-400 font-medium">
              <span className="font-mono">{appt.patientNo}</span>
              {appt.mobile && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={(e) => onWhatsApp(e, appt.mobile, appt.patientName)}
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                    title="Send WhatsApp message"
                  >
                    <MessageCircle size={11} className="text-emerald-500" />
                    {appt.mobile}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center / Right: Dentist & Operatory */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-2 text-left sm:text-right">
          <div className="hidden md:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{appt.dentistName}</p>
            <p className="text-[10px] text-slate-400">{humanize(appt.appointmentType)}</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Stethoscope size={15} />
          </span>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/70 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[appt.status] || 'bg-slate-400'}`} />
            {humanize(appt.status)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {appt.mobile && (
            <button
              type="button"
              onClick={(e) => onWhatsApp(e, appt.mobile, appt.patientName)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40"
              title="Chat on WhatsApp"
            >
              <MessageCircle size={14} />
            </button>
          )}

          {canManage && primary ? (
            <button
              type="button"
              onClick={() => onRunStatus(appt, primary.to)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs ${primary.color}`}
            >
              <primary.icon size={13} />
              {primary.label}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenDetails(appt.id)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            title="View Details"
          >
            <Eye size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function WeekBoard({ weekStart, rows, loading, error, onRetry, onOpenDay, onOpenAppointment, onNew, canCreate }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const today = todayISO();
  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [d, []]));
    rows.forEach((r) => {
      if (map.has(r.appointmentDate)) map.get(r.appointmentDate).push(r);
    });
    return map;
  }, [rows, weekStart]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
          <Spinner size={24} />
          <span>Loading weekly schedule…</span>
        </div>
      </div>
    );
  }
  if (error) return <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><ErrorState error={error} onRetry={onRetry} /></div>;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
      {days.map((d, idx) => {
        const list = byDay.get(d) || [];
        const active = d === today;
        return (
          <section key={d} className={`flex min-h-[300px] flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition-all dark:bg-slate-900 ${active ? 'border-[#0a7f8b] ring-2 ring-[#0a7f8b]/20' : 'border-slate-200/80 dark:border-slate-800'}`}>
            <header className={`flex items-center justify-between border-b px-3 py-2.5 ${active ? 'border-[#0a7f8b]/30 bg-teal-50/60 dark:bg-teal-950/30' : 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'}`}>
              <button type="button" onClick={() => onOpenDay(d)} className="group flex min-w-0 items-center gap-2 text-left">
                <span className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-black leading-none ${active ? 'bg-[#0a7f8b] text-white shadow-xs' : 'bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'}`}>
                  <span className="text-[8px] font-bold uppercase tracking-wide opacity-75">{formatWeekday(d).slice(0, 2)}</span>
                  <span className="text-[13px]">{formatDayNumber(d)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-slate-800 dark:text-white group-hover:text-[#0a7f8b]">{active ? 'Today' : DAY_NAMES[idx]}</span>
                  <span className="block truncate text-[10px] text-slate-400 font-semibold">{parseISO(d).toLocaleDateString('en-IN', { month: 'short' })}</span>
                </span>
              </button>
              <div className="flex items-center gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${list.length ? 'bg-[#0a7f8b]/10 text-[#0a7f8b]' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{list.length}</span>
                {canCreate && (
                  <button type="button" aria-label={`Add appointment on ${formatDate(d)}`} className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-[#0a7f8b] dark:hover:bg-slate-800" onClick={() => onNew(d)}>
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </header>
            <div className="flex-1 space-y-1.5 p-2">
              {list.length === 0 ? (
                canCreate ? (
                  <button type="button" onClick={() => onNew(d)} className="flex h-full min-h-[80px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-xs font-semibold text-slate-400 transition-colors hover:border-[#0a7f8b]/50 hover:bg-teal-50/30 hover:text-[#0a7f8b] dark:border-slate-800">
                    <Plus size={15} className="mb-1" />
                    Book visit
                  </button>
                ) : <p className="px-2 py-4 text-xs text-slate-400 text-center font-medium">No visits</p>
              ) : (
                list.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpenAppointment(r)}
                    className="w-full rounded-xl border border-slate-100 bg-white py-1.5 pl-2.5 pr-2 text-left transition-all hover:-translate-y-px hover:border-[#0a7f8b]/40 hover:shadow-xs dark:border-slate-800 dark:bg-slate-850"
                    style={{ borderLeft: `3px solid ${STATUS_COLOR[r.status] || '#94a3b8'}` }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black tabular-nums text-slate-700 dark:text-slate-300">{formatTime(r.startTime)}</span>
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[r.status] || 'bg-slate-400'}`} />
                    </div>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800 dark:text-white">{r.patientName}</p>
                    <p className="truncate text-[10px] text-slate-400 font-medium">{humanize(r.appointmentType)}</p>
                  </button>
                ))
              )}
              {list.length > 8 && (
                <button type="button" onClick={() => onOpenDay(d)} className="w-full rounded-xl px-2 py-1 text-left text-xs font-black text-[#0a7f8b] hover:bg-teal-50 dark:hover:bg-teal-950/40">
                  +{list.length - 8} more visits
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthCalendar({ date, rows, loading, error, onRetry, onOpenDay, onOpenAppointment, canCreate }) {
  const today = todayISO();
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(date || today);
  const monthStart = monthStartOf(date);
  const gridStart = mondayOf(monthStart);
  const leading = (parseISO(monthStart).getDay() + 6) % 7;
  const totalDays = parseISO(monthEndOf(date)).getDate();
  const cellCount = Math.ceil((leading + totalDays) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, i) => addDaysISO(gridStart, i));

  // Sync selectedCalendarDate if month changes
  useEffect(() => {
    if (selectedCalendarDate.slice(0, 7) !== date.slice(0, 7)) {
      setSelectedCalendarDate(date);
    }
  }, [date, selectedCalendarDate]);

  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [d, []]));
    rows.forEach((r) => {
      if (map.has(r.appointmentDate)) map.get(r.appointmentDate).push(r);
    });
    return map;
  }, [rows, date]);

  // Selected Day appointments
  const selectedDayAppointments = useMemo(() => {
    return (byDay.get(selectedCalendarDate) || []).slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [byDay, selectedCalendarDate]);

  // Upcoming appointments from today forward in this month
  const upcomingMonthAppointments = useMemo(() => {
    return rows
      .filter((r) => r.appointmentDate >= today && !['completed', 'cancelled', 'no_show'].includes(r.status))
      .slice()
      .sort((a, b) => `${a.appointmentDate} ${a.startTime}`.localeCompare(`${b.appointmentDate} ${b.startTime}`));
  }, [rows, today]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
          <Spinner size={24} />
          <span>Loading monthly calendar schedule…</span>
        </div>
      </div>
    );
  }
  if (error) return <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><ErrorState error={error} onRetry={onRetry} /></div>;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
      {/* ── Left Column: Interactive Month Grid (8 or 9 cols) ── */}
      <div className="xl:col-span-8 2xl:col-span-9 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Month Header Banner with Quick Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/70 via-white to-cyan-50/50 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a7f8b] to-[#14b8c8] text-white shadow-md">
              <CalendarRange size={20} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {formatMonthLabel(date)} Calendar
              </h2>
              <p className="text-xs text-slate-400">
                {rows.length} total scheduled visits · Click any day to preview schedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60">
              {upcomingMonthAppointments.length} Upcoming in Month
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={() => onOpenDay(selectedCalendarDate)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0a7f8b] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#086771] transition"
              >
                <Plus size={14} />
                <span>Book Slot</span>
              </button>
            )}
          </div>
        </div>

        {/* 7 Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7">
          {days.map((d, idx) => {
            const list = byDay.get(d) || [];
            const outside = d.slice(0, 7) !== monthStart.slice(0, 7);
            const isToday = d === today;
            const isSelected = d === selectedCalendarDate;
            const hasAppointments = list.length > 0;

            return (
              <div
                key={d}
                onClick={() => setSelectedCalendarDate(d)}
                className={`min-h-[115px] border-b border-r border-slate-100 p-2 transition-all cursor-pointer dark:border-slate-800 ${
                  outside
                    ? 'bg-slate-50/40 opacity-60 dark:bg-slate-950/30'
                    : isSelected
                    ? 'bg-teal-50/60 dark:bg-teal-950/30 ring-2 ring-inset ring-[#0a7f8b]/60'
                    : 'bg-white hover:bg-slate-50/70 dark:bg-slate-900 dark:hover:bg-slate-850'
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                {/* Cell Header: Day Number and Count Badge */}
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={`flex h-7 min-w-7 items-center justify-center rounded-xl px-1.5 text-xs font-black transition-colors ${
                      isToday
                        ? 'bg-[#0a7f8b] text-white shadow-xs'
                        : isSelected
                        ? 'bg-teal-700 text-white shadow-xs'
                        : outside
                        ? 'text-slate-400'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {formatDayNumber(d)}
                  </span>

                  <div className="flex items-center gap-1">
                    {hasAppointments && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-teal-100 text-[10px] font-black text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                        {list.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Appointment Chips in Cell */}
                <div className="space-y-1">
                  {list.slice(0, 2).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAppointment(r);
                      }}
                      className="group flex w-full items-center gap-1 truncate rounded-lg border border-slate-100 bg-white/90 px-1.5 py-1 text-left text-[10.5px] font-semibold transition-all hover:border-[#0a7f8b] hover:shadow-xs dark:border-slate-800 dark:bg-slate-850"
                      style={{ borderLeft: `3px solid ${STATUS_COLOR[r.status] || '#94a3b8'}` }}
                      title={`${r.patientName} (${formatTime(r.startTime)}) - ${humanize(r.status)}`}
                    >
                      <span className="shrink-0 font-mono font-bold text-slate-500 dark:text-slate-400 text-[10px]">
                        {formatTime(r.startTime)}
                      </span>
                      <span className="truncate font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#0a7f8b]">
                        {r.patientName}
                      </span>
                    </button>
                  ))}
                  {list.length > 2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCalendarDate(d);
                      }}
                      className="block w-full px-1 text-left text-[10px] font-black text-[#0a7f8b] hover:underline"
                    >
                      +{list.length - 2} more visits
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Month Summary & Status Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-800/40">
          <span>{rows.length} total scheduled visits in {formatMonthLabel(date)}</span>
          <div className="flex flex-wrap items-center gap-3">
            {['scheduled', 'confirmed', 'checked_in', 'in_consultation', 'completed'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                {humanize(s)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Column: Selected Day Agenda & Upcoming Visits (4 or 3 cols) ── */}
      <div className="xl:col-span-4 2xl:col-span-3 space-y-5">
        {/* Selected Day Agenda Box */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Selected Day Schedule
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {formatLongDate(selectedCalendarDate)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onOpenDay(selectedCalendarDate)}
              className="rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition"
              title="Open Day Timeline View"
            >
              Day View →
            </button>
          </div>

          <div className="mt-4">
            {selectedDayAppointments.length === 0 ? (
              <div className="py-8 text-center">
                <CalendarDays size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  No appointments on this date
                </p>
                <p className="text-[11px] text-slate-400">Click below to book a patient slot.</p>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => onOpenDay(selectedCalendarDate)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition"
                  >
                    <Plus size={14} />
                    <span>Book on this date</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                {selectedDayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    onClick={() => onOpenAppointment(apt)}
                    className="flex items-center justify-between pt-2.5 cursor-pointer rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-black text-teal-700 dark:text-teal-400 shrink-0">
                        {formatTime(apt.startTime)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
                          {apt.patientName}
                        </p>
                        <p className="truncate text-[10.5px] text-slate-400">
                          {apt.reason || 'General Consultation'} · Dr. {apt.dentistName || 'Sathish'}
                        </p>
                      </div>
                    </div>
                    <Badge status={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments this Month */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Upcoming Queue
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Upcoming this Month ({upcomingMonthAppointments.length})
              </h3>
            </div>
            <Clock3 size={16} className="text-slate-400" />
          </div>

          <div className="mt-3 space-y-2.5 max-h-[320px] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
            {upcomingMonthAppointments.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No future appointments scheduled for the rest of this month.
              </p>
            ) : (
              upcomingMonthAppointments.slice(0, 10).map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => onOpenAppointment(apt)}
                  className="flex items-center justify-between pt-2 cursor-pointer rounded-xl p-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="rounded-lg bg-teal-50 px-2 py-1 text-center shrink-0 dark:bg-teal-950/50">
                      <span className="block text-[9px] font-bold uppercase text-teal-700 dark:text-teal-300">
                        {formatWeekday(apt.appointmentDate)}
                      </span>
                      <span className="block text-xs font-black text-teal-800 dark:text-teal-200">
                        {formatDayNumber(apt.appointmentDate)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
                        {apt.patientName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatTime(apt.startTime)} · {apt.reason || 'Visit'}
                      </p>
                    </div>
                  </div>
                  <Badge status={apt.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentDetail({ id, onClose, onReschedule, onStatus, canManage, statusPending }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => (await api.get(`/appointments/${id}`)).data,
    enabled: Boolean(id)
  });

  const closed = data && ['completed', 'cancelled', 'no_show'].includes(data.status);

  return (
    <Modal
      open={Boolean(id)}
      onClose={onClose}
      title={data ? data.appointmentNo : 'Appointment Details'}
      subtitle={data ? `${data.patientName} · ${formatDate(data.appointmentDate)} at ${formatTime(data.startTime)}` : ''}
      size="md"
    >
      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={data.status} />
            <span className="text-xs text-slate-500 font-semibold">{humanize(data.appointmentType)} · {humanize(data.bookingSource)}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <PatientAvatar
                patient={{ id: data.patientId, fullName: data.patientName, hasPhoto: data.hasPhoto }}
                size={44}
                className="rounded-2xl shadow-xs"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Patient</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-black text-slate-900 dark:text-white truncate">{data.patientName}</p>
                  <PatientTypeBadge isNew={data.isNewPatient} visitCount={data.visitCount} size="sm" />
                </div>
                <p className="text-xs text-slate-500">{data.patientNo} · {data.mobile}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Schedule Time</p>
              <p className="mt-1 flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                <Clock3 size={14} className="text-[#0a7f8b]" />
                {formatTime(data.startTime)} – {formatTime(data.endTime)}
              </p>
              <p className="text-xs text-slate-500">{formatLongDate(data.appointmentDate)}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Attending Dentist</p>
              <p className="mt-1 font-bold text-slate-800 dark:text-white">{data.dentistName}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Booking Channel</p>
              <p className="mt-1 font-bold text-slate-800 dark:text-white">{humanize(data.bookingSource)}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Procedure / Reason for visit</p>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-200 font-medium">{data.reason || 'Routine checkup & consultation.'}</p>
              {data.notes && <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800">{data.notes}</p>}
            </div>
          </div>

          {data.history?.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400"><History size={13} /> Status History</p>
              <ol className="space-y-2 border-l border-slate-200 pl-3 dark:border-slate-700">
                {data.history.map((h) => (
                  <li key={h.id} className="relative text-xs">
                    <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-[#0a7f8b]" />
                    <span className="font-bold text-slate-800 dark:text-white">{humanize(h.to_status)}</span>
                    <span className="text-slate-500"> · {new Date(h.changed_at).toLocaleString('en-IN')}{h.changed_by_name ? ` · ${h.changed_by_name}` : ''}</span>
                    {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {canManage && !closed && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {(NEXT_ACTIONS[data.status] || []).map((a) => (
                <button
                  key={a.to}
                  disabled={statusPending}
                  onClick={() => onStatus(data.id, a.to)}
                  className="rounded-xl bg-[#0a7f8b] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#086771] transition"
                >
                  {a.label}
                </button>
              ))}
              {['scheduled', 'confirmed', 'checked_in', 'waiting'].includes(data.status) && (
                <Button size="sm" variant="secondary" onClick={() => onReschedule(data)}>Reschedule</Button>
              )}
              {['scheduled', 'confirmed', 'checked_in', 'waiting', 'in_consultation'].includes(data.status) && (
                <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:text-red-700" icon={UserX} onClick={() => setConfirmCancel(true)}>Cancel visit</Button>
              )}
            </div>
          )}
          {closed && (
            <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800">
              This appointment is closed and can no longer be modified.
            </p>
          )}
        </div>
      )}
      <ReminderModal open={reminderOpen} appointmentId={id} onClose={() => setReminderOpen(false)} />
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel appointment"
        message={data ? `Cancel ${data.appointmentNo} for ${data.patientName}? The appointment stays in history marked as cancelled.` : ''}
        confirmLabel="Cancel appointment"
        loading={statusPending}
        onConfirm={() => { onStatus(data.id, 'cancelled'); setConfirmCancel(false); }}
      />
    </Modal>
  );
}

function ReminderModal({ open, appointmentId, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['reminder-context', appointmentId],
    queryFn: async () => (await api.get('/reminders/appointment/' + appointmentId)).data,
    enabled: open && Boolean(appointmentId)
  });
  const [templateId, setTemplateId] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (data && data.templates && data.templates.length) {
      const t = data.templates.find((x) => x.channel === channel) || data.templates[0];
      if (t) { setTemplateId(t.id); setMessage(t.preview); setChannel(t.channel); }
    }
  }, [data]);

  const onTemplateChange = (tid) => {
    setTemplateId(tid);
    const t = (data && data.templates || []).find((x) => x.id === tid);
    if (t) { setMessage(t.preview); setChannel(t.channel); }
  };

  const send = async () => {
    if (!message.trim()) return;
    const mobile = (data && data.appointment && data.appointment.mobile) || '';
    const email = (data && data.appointment && data.appointment.email) || '';

    if (channel === 'whatsapp' || channel === 'sms') {
      if (!mobile) {
        toast.error('No mobile number on record for this patient');
        return;
      }
    } else if (channel === 'email') {
      if (!email) {
        toast.error('No email address on record for this patient');
        return;
      }
    }

    setSending(true);
    try {
      await api.post('/reminders/send', {
        appointmentId,
        templateId: templateId || null,
        channel,
        messageBody: message,
        status: 'opened'
      });
      toast.success('Reminder recorded and composer opened');
      qc.invalidateQueries({ queryKey: ['reminder-context', appointmentId] });
      const encoded = encodeURIComponent(message);

      if (channel === 'whatsapp') {
        const clean = mobile.replace(/\D/g, '');
        const waNum = clean.length === 10 ? `91${clean}` : clean;
        window.open(`https://wa.me/${waNum}?text=${encoded}`, '_blank');
      } else if (channel === 'sms') {
        window.open(`sms:${mobile}?body=${encoded}`);
      } else if (channel === 'email') {
        const clinicName = (data && data.appointment && data.appointment.clinicName) || 'Dental Care';
        const subject = encodeURIComponent(`Appointment Reminder · ${clinicName}`);
        window.open(`mailto:${email}?subject=${subject}&body=${encoded}`);
      }
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send appointment reminder"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={sending}>
            Open Composer &amp; Record
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label="Template" value={templateId} onChange={(e) => onTemplateChange(e.target.value)}>
          {(data && data.templates || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.channel})
            </option>
          ))}
        </Select>
        <Select label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </Select>
        <Textarea label="Message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="text-[11px] text-slate-500">
          Records the reminder outreach and opens WhatsApp, SMS, or Email composer with message pre-filled.
        </p>
        {data && data.history && data.history.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase text-slate-500">Recent outreach history</p>
            <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
              {data.history.slice(0, 3).map((h) => (
                <li key={h.id}>
                  <span className="font-medium capitalize">{h.channel}</span> ·{' '}
                  <span className="text-slate-500">{h.status === 'opened' ? 'Opened in app' : h.status}</span> ·{' '}
                  {new Date(h.sentAt).toLocaleString('en-IN')} · {h.sentByName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
