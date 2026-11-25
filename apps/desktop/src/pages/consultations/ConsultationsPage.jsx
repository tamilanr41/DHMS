import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Stethoscope, FileClock, CheckCircle2, CalendarClock, RefreshCw,
  FileText, Activity, Sparkles, LayoutGrid, List, CalendarDays, Clock,
  ArrowRight, Eye, Phone, UserCheck, Timer, ChevronRight, Armchair, Search,
  X, Filter, Play, Edit3, AlertCircle, Sparkle, HeartPulse
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useDentists } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, todayISO, humanize, initials } from '../../utils/format.js';
import Button, { IconButton } from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const STATUS_OPTIONS = ['draft', 'completed', 'amended'];

const QUICK_COMPLAINTS = [
  'Toothache / Sensitivity',
  'Cavity & Filling Check',
  'Bleeding Gums / Scaling',
  'Root Canal Follow-up',
  'Broken / Chipped Tooth',
  'Orthodontic / Braces Check',
  'Crown / Bridge Fitting',
  'Wisdom Tooth Pain'
];

export default function ConsultationsPage() {
  const { user, has } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ start: '', end: '' });
  const [sort, setSort] = useState({ key: 'visitAt', order: 'desc' });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState(null);
  const [dentistId, setDentistId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dentists = useDentists();

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      if (params.get('patientId')) {
        api.get(`/patients/${params.get('patientId')}`).then((res) => setPatient(res.data)).catch(() => {});
      }
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('patientId');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['consultations', range.start, range.end, status],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (range.start) qs.set('startDate', range.start);
      if (range.end) qs.set('endDate', range.end);
      if (status) qs.set('status', status);
      if (user.role === 'dentist') qs.set('dentistId', user.id);
      return (await api.get(`/consultations?${qs}`)).data;
    }
  });

  const all = data || [];
  const today = todayISO();

  const summary = useMemo(() => {
    const drafts = all.filter((c) => c.status === 'draft').length;
    const completed = all.filter((c) => c.status === 'completed').length;
    const amended = all.filter((c) => c.status === 'amended').length;
    const followUps = all.filter((c) => c.followUpDate && String(c.followUpDate).slice(0, 10) >= today).length;
    return { total: all.length, drafts, completed, amended, followUps };
  }, [all, today]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = all.filter((c) => {
      if (!q) return true;
      return (
        c.patientName?.toLowerCase().includes(q) ||
        c.consultationNo?.toLowerCase().includes(q) ||
        c.patientNo?.toLowerCase().includes(q) ||
        c.diagnosis?.toLowerCase().includes(q)
      );
    });
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sort.key === 'visitAt') return (new Date(av) - new Date(bv)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [all, search, sort]);

  const create = async () => {
    setError(null);
    if (!patient?.id) return setError('Please select a patient');
    if (user.role !== 'dentist' && !dentistId) return setError('Please select the treating dentist');
    setSaving(true);
    try {
      const res = await api.post('/consultations', {
        patientId: patient.id,
        dentistId: user.role === 'dentist' ? undefined : dentistId,
        chiefComplaint: chiefComplaint || null
      });
      toast.success('Consultation started successfully');
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setOpen(false);
      setPatient(null);
      setChiefComplaint('');
      navigate(`/consultations/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusTabs = [
    { key: '', label: 'All Consultations', count: summary.total },
    { key: 'draft', label: 'Drafts / In Chair', count: summary.drafts, isDraft: true },
    { key: 'completed', label: 'Completed Care', count: summary.completed, isCompleted: true },
    { key: 'amended', label: 'Amended Notes', count: summary.amended }
  ];

  const columns = [
    {
      key: 'consultationNo',
      label: 'Consultation',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">{r.consultationNo}</span>
          <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">{formatDate(r.visitAt)}</p>
        </div>
      )
    },
    {
      key: 'patientName',
      label: 'Patient',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <PatientAvatar
            patient={{ id: r.patientId, fullName: r.patientName }}
            size={36}
            className="rounded-xl shadow-xs shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-black text-slate-900 dark:text-white text-xs">{r.patientName}</p>
            <p className="text-[11px] font-mono text-slate-400 font-bold">{r.patientNo}</p>
          </div>
        </div>
      )
    },
    {
      key: 'visitAt',
      label: 'Date & Time',
      sortable: true,
      render: (r) => <span className="whitespace-nowrap text-xs font-bold text-slate-700 dark:text-slate-300">{formatDateTime(r.visitAt)}</span>
    },
    {
      key: 'dentistName',
      label: 'Dentist',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Stethoscope size={13} className="text-[#0a7f8b]" />
          {r.dentistName}
        </span>
      )
    },
    {
      key: 'diagnosis',
      label: 'Diagnosis & Findings',
      render: (r) => (
        <span className="line-clamp-1 block max-w-[280px] text-xs text-slate-700 dark:text-slate-300 font-medium" title={r.diagnosis || ''}>
          {r.diagnosis || <span className="text-slate-400 italic font-normal">Pending doctor's examination note</span>}
        </span>
      )
    },
    {
      key: 'followUpDate',
      label: 'Follow-up Due',
      render: (r) =>
        r.followUpDate ? (
          <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-bold ${
            String(r.followUpDate).slice(0, 10) < today
              ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/40 dark:text-teal-300'
          }`}>
            <CalendarClock size={12} /> {formatDate(r.followUpDate)}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => {
        if (r.status === 'draft') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:border-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              In Progress
            </span>
          );
        }
        if (r.status === 'completed') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800">
              <CheckCircle2 size={13} className="text-emerald-600" />
              Completed
            </span>
          );
        }
        return <Badge status={r.status} />;
      }
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => navigate(`/consultations/${r.id}`)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
            r.status === 'draft'
              ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-xs hover:opacity-95'
              : 'bg-teal-50 text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900'
          }`}
        >
          {r.status === 'draft' ? (
            <>
              <Play size={12} fill="currentColor" />
              Continue
            </>
          ) : (
            <>
              <Stethoscope size={13} />
              Workspace
            </>
          )}
        </button>
      )
    }
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* ── Doccure Dental Hero Banner ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a7f8b] via-[#0e95a3] to-[#14b8c8] p-6 text-white shadow-[0_20px_50px_-20px_rgba(10,127,139,0.35)]">
        <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-25">
          <img src={heroTooth} alt="" className="h-56 w-56 object-contain" />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 p-2 backdrop-blur-md shadow-inner">
              <img src={heroTooth} alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">Clinical Consultations &amp; Operatory Desk</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  Clinical Floor Active
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                Real-time chairside dental examinations, digital odontogram charting, clinical findings, e-prescriptions and procedural records.
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
              Operatory Floor
            </button>
            {has('consultations.manage') && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
              >
                <Plus size={16} className="text-[#0a7f8b]" />
                Start Consultation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards (Matches Waiting Queue Screenshot 1:1) ────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="TOTAL CONSULTATIONS"
          value={summary.total}
          subtitle="on roster"
          icon={Stethoscope}
          variant="teal"
        />
        <DoccureKpiCard
          title="DRAFTS IN PROGRESS"
          value={summary.drafts}
          subtitle="triage checked-in"
          icon={Clock}
          variant="amber"
        />
        <DoccureKpiCard
          title="IN OPERATORY CHAIR"
          value={summary.followUps}
          subtitle="active care"
          icon={CalendarClock}
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

      {/* ── Main Container: Status Tabs + Filters + Records ─────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        
        {/* Status Quick Filter Tabs */}
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Pill Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {statusTabs.map((tab) => {
                const isActive = status === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatus(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black transition-all ${
                      isActive
                        ? 'bg-[#0a7f8b] text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : tab.isDraft
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : tab.isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card Grid View"
                className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <List size={14} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Controls & Search Toolbar */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by patient name, consultation #, patient ID, diagnosis..."
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-10 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 transition focus:border-[#0a7f8b] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                start={range.start}
                end={range.end}
                onChange={(start, end) => setRange({ start, end })}
                className="hidden md:flex"
              />

              <IconButton
                icon={RefreshCw}
                label="Sync consultations"
                size="sm"
                variant="secondary"
                onClick={() => refetch()}
                disabled={isFetching}
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'cards' ? (
          <div className="p-6">
            {isLoading ? (
              <div className="py-20 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-[#0a7f8b]" />
                <p className="mt-3 text-xs font-bold text-slate-500">Loading consultation records...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                  <Stethoscope size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">No consultations found</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {search || status ? 'No records match your active search or filters.' : 'No clinical consultations recorded yet.'}
                </p>
                {has('consultations.manage') && (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-4 py-2 text-xs font-black text-white shadow-md hover:opacity-95 transition"
                  >
                    <Plus size={15} />
                    Start First Consultation
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((r) => {
                  const isDraft = r.status === 'draft';
                  const isCompleted = r.status === 'completed';

                  return (
                    <article
                      key={r.id}
                      onClick={() => navigate(`/consultations/${r.id}`)}
                      className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_-12px_rgba(10,127,139,0.22)] dark:bg-slate-850 cursor-pointer ${
                        isDraft
                          ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/25 to-white hover:border-amber-400 dark:border-amber-800/60 dark:from-amber-950/20'
                          : 'border-slate-100 hover:border-[#14b8c8]/50 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        {/* Top: Consultation Number & Status Badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100/80 pb-3 dark:border-slate-800">
                          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">
                            {r.consultationNo}
                          </span>
                          {isDraft ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Draft Session
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              Completed
                            </span>
                          ) : (
                            <Badge status={r.status} />
                          )}
                        </div>

                        {/* Patient Profile Card */}
                        <div className="mt-3.5 flex items-center gap-3">
                          <PatientAvatar
                            patient={{ id: r.patientId, fullName: r.patientName }}
                            size={44}
                            className="rounded-2xl ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-black text-slate-900 group-hover:text-[#0a7f8b] dark:text-white transition-colors">
                              {r.patientName}
                            </h4>
                            <p className="font-mono text-[11px] font-bold text-slate-400">
                              {r.patientNo}
                            </p>
                          </div>
                        </div>

                        {/* Doctor & Date Information */}
                        <div className="mt-3.5 space-y-1.5 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Dentist:</span>
                            <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <Stethoscope size={12} className="text-[#0a7f8b]" />
                              {r.dentistName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Visit Time:</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {formatDateTime(r.visitAt)}
                            </span>
                          </div>
                        </div>

                        {/* Clinical Diagnosis Box */}
                        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Clinical Diagnosis
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                            {r.diagnosis || (
                              <span className="italic text-slate-400 font-normal">
                                Pending chairside doctor findings...
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer: Follow-up & Action Button */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        {r.followUpDate ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-black text-[#0a7f8b] dark:bg-teal-950/40">
                            <CalendarClock size={12} />
                            {formatDate(r.followUpDate)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">No review scheduled</span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/consultations/${r.id}`);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                            isDraft
                              ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-sm hover:opacity-95'
                              : 'bg-teal-50 text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900'
                          }`}
                        >
                          {isDraft ? (
                            <>
                              <Play size={12} fill="currentColor" />
                              Continue
                            </>
                          ) : (
                            <>
                              <Stethoscope size={13} />
                              Workspace
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={queryError}
            onRetry={refetch}
            onRowClick={(r) => navigate(`/consultations/${r.id}`)}
            sort={sort}
            onSortChange={setSort}
            emptyTitle={search || status || range.start ? 'No matching consultations' : 'No consultations'}
            emptyMessage={
              search || status || range.start
                ? 'Adjust the search, status or date range to find the record you need.'
                : 'Start a consultation from a patient profile or the button above.'
            }
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-4 py-3">
                <span>{rows.length} of {summary.total} record{summary.total === 1 ? '' : 's'}</span>
                <span className="hidden sm:inline">Sorted by visit date (most recent first)</span>
              </div>
            }
          />
        )}
      </div>

      {/* ── Start Consultation Modal (Doccure Luxury Design + Quick Chips) ─── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start Clinical Consultation"
        subtitle="Initialize chairside consultation, dental odontogram charting and patient record."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button icon={Stethoscope} loading={saving} onClick={create} className="bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white">
              Launch Operatory Workspace
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PatientPicker value={patient} onChange={setPatient} required label="Select Patient for Consultation" />

          {user.role !== 'dentist' && (
            <Select label="Attending Dentist" required value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
              <option value="">Select treating dentist…</option>
              {(dentists.data || []).map((d) => <option key={d.id} value={d.id}>Dr. {d.fullName}</option>)}
            </Select>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Chief Dental Complaint
            </label>
            <Textarea
              rows={3}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Sharp pain on lower left molar on mastication, sensitivity to cold fluids..."
            />
            {/* Quick Complaint Preset Chips */}
            <div className="mt-2.5">
              <p className="text-[10.5px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Quick Select Symptoms:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COMPLAINTS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setChiefComplaint((prev) => (prev ? `${prev}, ${chip}` : chip))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#0a7f8b] hover:bg-teal-50 hover:text-[#0a7f8b] transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800">
              {error}
            </div>
          )}

          <div className="rounded-2xl bg-teal-50/60 p-3 text-xs text-slate-600 dark:bg-teal-950/40 dark:text-slate-300 border border-teal-100 dark:border-teal-900/60 flex items-start gap-2.5">
            <Sparkles size={16} className="text-[#0a7f8b] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Clicking <strong>Launch Operatory Workspace</strong> opens the chairside suite with interactive 32-tooth odontogram chart, treatment planning, and e-prescription generator.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
