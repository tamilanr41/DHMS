import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, ClipboardList, RefreshCw, CheckCircle2, Clock3,
  IndianRupee, Layers, Sparkles, Stethoscope, Search, X, LayoutGrid,
  List, ArrowRight, Eye, UserCheck, Armchair, ChevronRight, AlertCircle,
  Clock, FileText, CalendarDays
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useDentists } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatMoney, humanize, initials } from '../../utils/format.js';
import Button, { IconButton } from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const STATUS_OPTIONS = ['proposed', 'accepted', 'partially_completed', 'completed', 'cancelled'];

export default function TreatmentPlansPage() {
  const { user, has } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', order: 'desc' });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState(null);
  const [consultationId, setConsultationId] = useState(null);
  const [dentistId, setDentistId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dentists = useDentists();

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      if (params.get('patientId')) {
        api.get(`/patients/${params.get('patientId')}`).then((res) => setPatient(res.data)).catch(() => {});
      }
      setConsultationId(params.get('consultationId') || null);
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('patientId');
      next.delete('consultationId');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['treatment-plans', status],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      return (await api.get(`/treatment-plans?${qs}`)).data;
    }
  });

  const all = data || [];

  const summary = useMemo(() => {
    const active = all.filter((p) => !['completed', 'cancelled'].includes(p.status));
    const accepted = all.filter((p) => ['accepted', 'partially_completed'].includes(p.status));
    const completed = all.filter((p) => p.status === 'completed');
    const proposed = all.filter((p) => p.status === 'proposed');
    const pipeline = active.reduce((sum, p) => sum + Number(p.estimate || 0), 0);
    return {
      total: all.length,
      active: active.length,
      accepted: accepted.length,
      completed: completed.length,
      proposed: proposed.length,
      pipeline
    };
  }, [all]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (!q) return true;
      return (
        p.patientName?.toLowerCase().includes(q) ||
        p.planNo?.toLowerCase().includes(q) ||
        p.patientNo?.toLowerCase().includes(q) ||
        p.dentistName?.toLowerCase().includes(q)
      );
    });
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sort.key === 'createdAt') return (new Date(av) - new Date(bv)) * dir;
      if (['estimate', 'itemCount', 'completedCount'].includes(sort.key)) return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [all, search, sort]);

  const statusTabs = [
    { key: '', label: 'All Plans', count: summary.total },
    { key: 'proposed', label: 'Proposed', count: summary.proposed, isProposed: true },
    { key: 'accepted', label: 'Active in Care', count: summary.active, isAccepted: true },
    { key: 'completed', label: 'Completed', count: summary.completed, isCompleted: true }
  ];

  const createPlan = async () => {
    setError(null);
    if (!patient?.id) return setError('Please choose a patient');
    setSaving(true);
    try {
      const res = await api.post('/treatment-plans', {
        patientId: patient.id,
        dentistId: dentistId || undefined,
        consultationId: consultationId || undefined
      });
      toast.success('Treatment plan initiated');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      setOpen(false);
      navigate(`/treatment-plans/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'planNo',
      label: 'Plan #',
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">{r.planNo}</span>
          <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">{formatDate(r.createdAt)}</p>
        </div>
      )
    },
    {
      key: 'patientName',
      label: 'Patient Record',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
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
      key: 'completedCount',
      label: 'Treatment Progress',
      sortable: true,
      render: (r) => {
        const total = Number(r.itemCount) || 0;
        const done = Number(r.completedCount) || 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div className="w-[140px]">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <span>{done}/{total} done</span>
              <span className="tabular-nums font-black text-[#0a7f8b]">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      key: 'estimate',
      label: 'Plan Estimate',
      align: 'right',
      sortable: true,
      render: (r) => (
        <span className="tabular-nums font-black text-slate-900 dark:text-white text-xs">
          {formatMoney(r.estimate)}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => {
        if (r.status === 'completed') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800">
              <CheckCircle2 size={12} className="text-emerald-600" />
              Completed
            </span>
          );
        }
        if (['accepted', 'partially_completed'].includes(r.status)) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200/60 dark:bg-purple-950/40 dark:border-purple-800">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
              Active Care
            </span>
          );
        }
        if (r.status === 'proposed') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:border-amber-800">
              <Clock size={12} className="text-amber-600" />
              Proposed
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
          onClick={() => navigate(`/treatment-plans/${r.id}`)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 transition"
        >
          <span>View Plan</span>
          <ArrowRight size={13} />
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
                <h1 className="text-2xl font-black tracking-tight">Dental Treatment Plans &amp; Case Acceptance</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  Clinical Protocol Active
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                Multi-phased restorative procedure tracking, patient informed consent, clinical estimates, and completion pipelines.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/consultations')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] border border-white/25 shadow-sm"
            >
              <Stethoscope size={15} />
              Consultations Desk
            </button>
            {has('plans.manage') && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
              >
                <Plus size={16} className="text-[#0a7f8b]" />
                New Treatment Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards (Matches Waiting Queue Screenshot 1:1) ────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="TOTAL TREATMENT CASES"
          value={summary.total}
          subtitle="on roster"
          icon={ClipboardList}
          variant="teal"
        />
        <DoccureKpiCard
          title="ACTIVE IN TREATMENT"
          value={summary.active}
          subtitle="triage checked-in"
          icon={Clock3}
          variant="amber"
        />
        <DoccureKpiCard
          title="IN OPERATORY CHAIR"
          value={summary.accepted}
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
                          : tab.isProposed
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : tab.isAccepted
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
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
                placeholder="Search patient, plan #, patient ID or dentist..."
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
              <div className="rounded-2xl bg-teal-50 px-3.5 py-2 text-xs font-black text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                Pipeline Value: {formatMoney(summary.pipeline)}
              </div>

              <IconButton
                icon={RefreshCw}
                label="Refresh treatment plans"
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
                <p className="mt-3 text-xs font-bold text-slate-500">Loading treatment plans...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                  <ClipboardList size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">No treatment plans found</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {search || status ? 'No plans match your active search or filters.' : 'Propose your first multi-phased treatment plan.'}
                </p>
                {has('plans.manage') && (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-4 py-2 text-xs font-black text-white shadow-md hover:opacity-95 transition"
                  >
                    <Plus size={15} />
                    Create First Plan
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((r) => {
                  const totalItems = Number(r.itemCount) || 0;
                  const completedItems = Number(r.completedCount) || 0;
                  const pct = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
                  const isCompleted = r.status === 'completed';
                  const isAccepted = ['accepted', 'partially_completed'].includes(r.status);

                  return (
                    <article
                      key={r.id}
                      onClick={() => navigate(`/treatment-plans/${r.id}`)}
                      className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#14b8c8]/50 hover:shadow-[0_16px_36px_-12px_rgba(10,127,139,0.22)] dark:border-slate-800 dark:bg-slate-850 cursor-pointer"
                    >
                      <div>
                        {/* Top: Plan # & Status Badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100/80 pb-3 dark:border-slate-800">
                          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">
                            {r.planNo}
                          </span>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              Completed
                            </span>
                          ) : isAccepted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-black text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:border-purple-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                              Active Care
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800">
                              <Clock size={12} className="text-amber-600" />
                              Proposed
                            </span>
                          )}
                        </div>

                        {/* Patient Identity */}
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

                        {/* Dentist & Creation Date */}
                        <div className="mt-3.5 space-y-1.5 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Doctor:</span>
                            <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <Stethoscope size={12} className="text-[#0a7f8b]" />
                              {r.dentistName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Created:</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {formatDate(r.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Procedure Progress Bar */}
                        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-500">
                              {completedItems} of {totalItems} procedures done
                            </span>
                            <span className="font-black text-[#0a7f8b] tabular-nums">
                              {pct}%
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                pct === 100
                                  ? 'bg-emerald-500'
                                  : 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Estimate & Action Button */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Estimate</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white">
                            {formatMoney(r.estimate)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/treatment-plans/${r.id}`);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 transition"
                        >
                          <span>Plan Sheet</span>
                          <ArrowRight size={13} />
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
            onRowClick={(r) => navigate(`/treatment-plans/${r.id}`)}
            sort={sort}
            onSortChange={setSort}
            emptyTitle={search || status ? 'No matching treatment plans' : 'No treatment plans'}
            emptyMessage={
              search || status
                ? 'Adjust the search or status filter to find the plan you need.'
                : 'Create a treatment plan from a consultation or using the button above.'
            }
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-4 py-3">
                <span>{rows.length} of {summary.total} plan{summary.total === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1">
                  <Layers size={12} className="text-[#0a7f8b]" />
                  Multi-phased restorative dental care pipeline
                </span>
              </div>
            }
          />
        )}
      </div>

      {/* ── New Treatment Plan Modal ────────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Initialize Treatment Plan"
        subtitle="Create a structured multi-phase dental treatment plan and clinical estimate."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              icon={ClipboardList}
              loading={saving}
              onClick={createPlan}
              className="bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white"
            >
              Launch Plan Builder
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PatientPicker
            value={patient}
            onChange={setPatient}
            required
            label="Select Patient for Treatment Plan"
          />

          {user.role !== 'dentist' && (
            <Select
              label="Attending Treating Dentist"
              value={dentistId}
              onChange={(e) => setDentistId(e.target.value)}
            >
              <option value="">Select doctor (or use default)…</option>
              {(dentists.data || []).map((d) => (
                <option key={d.id} value={d.id}>Dr. {d.fullName}</option>
              ))}
            </Select>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800">
              {error}
            </div>
          )}

          <div className="rounded-2xl bg-teal-50/60 p-3 text-xs text-slate-600 dark:bg-teal-950/40 dark:text-slate-300 border border-teal-100 dark:border-teal-900/60 flex items-start gap-2.5">
            <Sparkles size={16} className="text-[#0a7f8b] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Once created, you can add procedures, tooth-specific restorative items, discounts, generate official estimate PDFs, and capture digital patient consent.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
