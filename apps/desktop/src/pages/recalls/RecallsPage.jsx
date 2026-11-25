import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BellRing, CalendarPlus, Phone, RefreshCw, Search, TriangleAlert, UserRoundCheck,
  CalendarClock, Users, MessageCircle, Sparkles, Stethoscope, LayoutGrid, List,
  CalendarDays, CheckCircle2, Clock, ArrowRight, Eye, AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useClinic } from '../../hooks/useClinic.js';
import { formatDate, humanize, initials } from '../../utils/format.js';
import Button, { IconButton } from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const WINDOWS = [
  { value: '0', label: 'Due now only' },
  { value: '30', label: 'Due in next 30 days' },
  { value: '90', label: 'Due in next 90 days' },
  { value: '180', label: 'Due in next 6 months' },
  { value: '365', label: 'Due in next 12 months' }
];

export default function RecallsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const clinic = useClinic();
  const [windowDays, setWindowDays] = useState('30');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'due' | 'overdue' | 'unscheduled'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  const recalls = useQuery({
    queryKey: ['recalls', windowDays],
    queryFn: async () => (await api.get(`/recalls?windowDays=${windowDays}`)).data,
    staleTime: 60_000
  });

  const rows = recalls.data || [];
  const recallMonths = clinic.data?.recallMonths || 6;

  const summary = useMemo(() => {
    const now = rows.filter((r) => Number(r.daysOverdue) >= 0);
    const overdue = rows.filter((r) => Number(r.daysOverdue) > 30);
    const noAppointment = rows.filter((r) => !r.hasUpcomingAppointment);
    return { total: rows.length, due: now.length, overdue: overdue.length, noAppointment: noAppointment.length };
  }, [rows]);

  const openRecallWhatsApp = async (e, r) => {
    e.stopPropagation();
    if (!r.mobile) {
      toast.error('No mobile number on record for this patient');
      return;
    }
    const clean = r.mobile.replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    const clinicName = clinic.data?.name || 'ZhanX DentalCare';
    const intervalText = recallMonths === 12 ? 'annual' : `${recallMonths}-month`;
    const msg = encodeURIComponent(
      `Hello ${r.fullName}, this is ${clinicName}. It is time for your routine ${intervalText} dental checkup & cleaning. Regular scaling and oral examination keep your teeth and gums healthy. Please reply to schedule your visit!`
    );

    try {
      await api.post('/recalls/log', {
        patientId: r.patientId,
        channel: 'whatsapp',
        notes: `WhatsApp recall outreach opened for ${intervalText} checkup (${r.patientNo})`
      });
      toast.success('Recall outreach recorded in communication log');
    } catch {}

    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const days = Number(r.daysOverdue);
      if (filterMode === 'due' && days < 0) return false;
      if (filterMode === 'overdue' && days <= 30) return false;
      if (filterMode === 'unscheduled' && r.hasUpcomingAppointment) return false;
      if (!q) return true;
      return (
        r.fullName?.toLowerCase().includes(q) ||
        r.patientNo?.toLowerCase().includes(q) ||
        r.mobile?.includes(q) ||
        r.lastDentist?.toLowerCase().includes(q)
      );
    });
  }, [rows, search, filterMode]);

  const columns = [
    {
      key: 'fullName',
      label: 'Patient',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <PatientAvatar
            patient={{ id: r.patientId, fullName: r.fullName }}
            size={40}
            className="rounded-2xl shadow-xs ring-1 ring-slate-100 dark:ring-slate-800"
          />
          <div className="min-w-0">
            <Link to={`/patients/${r.patientId}`} className="truncate font-black text-slate-800 dark:text-white hover:text-[#0a7f8b] hover:underline block text-xs">
              {r.fullName}
            </Link>
            <p className="text-[11px] text-slate-400 font-semibold">
              <span className="font-mono text-slate-500">{r.patientNo}</span> · {r.age != null ? `${r.age} yrs` : 'Age not set'} · {humanize(r.gender || '')}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'mobile',
      label: 'Contact Details',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
            <Phone size={12} className="text-slate-400" /> {r.mobile || '—'}
          </span>
          {r.mobile && (
            <button
              type="button"
              onClick={(e) => openRecallWhatsApp(e, r)}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 transition-colors"
              title="Send WhatsApp recall reminder"
            >
              <MessageCircle size={13} />
            </button>
          )}
        </div>
      )
    },
    {
      key: 'lastVisit',
      label: 'Last Treatment',
      sortable: true,
      render: (r) => (
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-white">{formatDate(r.lastVisit)}</p>
          <p className="text-[10.5px] text-slate-400 font-semibold">{r.visitCount} visit{r.visitCount === 1 ? '' : 's'} recorded</p>
        </div>
      )
    },
    {
      key: 'lastDentist',
      label: 'Seen By Doctor',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-800 dark:text-white">{r.lastDentist ? `Dr. ${r.lastDentist}` : '—'}</p>
          {r.lastDiagnosis && <p className="max-w-[190px] truncate text-[10.5px] text-slate-400 font-medium" title={r.lastDiagnosis}>{r.lastDiagnosis}</p>}
        </div>
      )
    },
    {
      key: 'dueDate',
      label: 'Recall Due Date',
      sortable: true,
      render: (r) => {
        const days = Number(r.daysOverdue);
        return (
          <div>
            <p className="text-xs font-black text-slate-800 dark:text-white">{formatDate(r.dueDate)}</p>
            {days > 30 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <TriangleAlert size={10} /> {days}d overdue
              </span>
            ) : days > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {days}d overdue
              </span>
            ) : days === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Due today
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                In {Math.abs(days)}d
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'appointment',
      label: 'Booking Status',
      render: (r) =>
        r.hasUpcomingAppointment ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:ring-emerald-800 dark:text-emerald-300">
            <UserRoundCheck size={12} /> Booked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <CalendarClock size={12} /> Not booked
          </span>
        )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => navigate(`/patients/${r.patientId}`)}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition"
            title="View Patient Record"
          >
            <Eye size={13} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/appointments?new=1&patientId=${r.patientId}`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-3 py-1.5 text-xs font-black text-white shadow-xs hover:opacity-95 transition"
          >
            <CalendarPlus size={13} />
            Book Slot
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Doccure Dental Hero Banner */}
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
                <h1 className="text-2xl font-black tracking-tight">Dental Prophylaxis &amp; Recall Engine</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  Active Protocol
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                Automated preventive care tracking, scaling recalls, and periodic oral evaluations ({recallMonths}-month clinic cycle).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => recalls.refetch()}
              disabled={recalls.isFetching}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] border border-white/25 shadow-sm"
            >
              <RefreshCw size={14} className={recalls.isFetching ? 'animate-spin' : ''} />
              Sync Engine
            </button>
            <button
              type="button"
              onClick={() => navigate('/appointments?new=1')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
            >
              <CalendarPlus size={16} className="text-[#0a7f8b]" />
              Book Recall Visit
            </button>
          </div>
        </div>
      </div>

      {/* ── Dental Recall 4 KPI Strip (Matches Screenshot 1:1) ───────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="RECALL ELIGIBLE"
          value={summary.total}
          subtitle="on roster"
          icon={CalendarDays}
          variant="teal"
        />
        <DoccureKpiCard
          title="DUE FOR CHECKUP"
          value={summary.due}
          subtitle="triage checked-in"
          icon={Clock}
          variant="amber"
        />
        <DoccureKpiCard
          title="30+ DAYS OVERDUE"
          value={summary.overdue}
          subtitle="active care"
          icon={TriangleAlert}
          variant="rose"
          hasDot={true}
        />
        <DoccureKpiCard
          title="COMPLETED REVIEWS"
          value={summary.noAppointment}
          subtitle="treated today"
          icon={CheckCircle2}
          variant="emerald"
        />
      </div>

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Search, Filter Bar & Controls */}
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-5">
          <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, phone, doctor or patient no…"
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Filter Pills, Window Dropdown & View Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
                {[
                  { id: 'all', label: `All (${rows.length})` },
                  { id: 'due', label: `Due (${summary.due})` },
                  { id: 'overdue', label: `Overdue (${summary.overdue})` },
                  { id: 'unscheduled', label: `Unscheduled (${summary.noAppointment})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                      filterMode === tab.id
                        ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Time Window Select */}
              <select
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>

              {/* View Mode Switcher (Cards vs Table) */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="Card Grid View"
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    viewMode === 'cards' ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    viewMode === 'table' ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'cards' ? (
          <div className="p-6">
            {recalls.isLoading ? (
              <div className="py-20 text-center text-xs font-bold text-slate-500">Loading recall engine…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] mx-auto mb-3">
                  <BellRing size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">No recalls match the selected criteria</h3>
                <p className="mt-1 text-xs text-slate-400">Patients will appear here automatically when their preventive checkup window arrives.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((r) => {
                  const days = Number(r.daysOverdue);
                  return (
                    <div
                      key={r.patientId}
                      className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#14b8c8]/40 hover:shadow-[0_12px_30px_-10px_rgba(10,127,139,0.2)] dark:border-slate-800 dark:bg-slate-850"
                    >
                      <div>
                        {/* Top Identification Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PatientAvatar
                              patient={{ id: r.patientId, fullName: r.fullName }}
                              size={44}
                              className="rounded-2xl ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs"
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/patients/${r.patientId}`}
                                className="truncate text-sm font-black text-slate-800 dark:text-white group-hover:text-[#0a7f8b] transition-colors block"
                              >
                                {r.fullName}
                              </Link>
                              <p className="font-mono text-[10px] font-bold text-slate-400 mt-0.5">
                                {r.patientNo} · {r.age != null ? `${r.age} yrs` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Overdue / Due Pill */}
                          {days > 30 ? (
                            <span className="rounded-xl bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              {days}d overdue
                            </span>
                          ) : days > 0 ? (
                            <span className="rounded-xl bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {days}d overdue
                            </span>
                          ) : days === 0 ? (
                            <span className="rounded-xl bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Due today
                            </span>
                          ) : (
                            <span className="rounded-xl bg-teal-100 px-2 py-0.5 text-[10px] font-black text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                              In {Math.abs(days)}d
                            </span>
                          )}
                        </div>

                        {/* Clinical Treatment Info */}
                        <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50/70 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px] text-slate-400 font-bold">Last Visit:</span>
                            <span className="font-bold">{formatDate(r.lastVisit)}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px] text-slate-400 font-bold">Seen By:</span>
                            <span className="font-bold truncate max-w-[140px]">{r.lastDentist ? `Dr. ${r.lastDentist}` : 'General'}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px] text-slate-400 font-bold">Recall Date:</span>
                            <span className="font-black text-[#0a7f8b] dark:text-teal-300">{formatDate(r.dueDate)}</span>
                          </div>
                        </div>

                        {/* Booking Status Pill */}
                        <div className="mt-3">
                          {r.hasUpcomingAppointment ? (
                            <div className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 size={13} className="text-emerald-500" />
                              <span>Appointment Booked</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                              <CalendarClock size={13} className="text-slate-400" />
                              <span>Not Booked Yet</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Bottom Actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                        {r.mobile ? (
                          <button
                            type="button"
                            onClick={(e) => openRecallWhatsApp(e, r)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={14} className="text-emerald-500" />
                            <span>WhatsApp</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">No mobile</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/patients/${r.patientId}`)}
                            title="View Profile"
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/appointments?new=1&patientId=${r.patientId}`)}
                            className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-3 py-1.5 text-xs font-black text-white shadow-xs hover:opacity-95 transition"
                          >
                            <CalendarPlus size={13} />
                            <span>Book</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey="patientId"
            loading={recalls.isLoading}
            error={recalls.error}
            onRetry={recalls.refetch}
            emptyTitle="No recalls in this timeframe"
            emptyMessage="Completed visits will automatically appear here once their recall window arrives."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-4 py-3">
                <span>Showing {filtered.length} of {rows.length} patient{rows.length === 1 ? '' : 's'}</span>
                <span>Routine recall interval: {recallMonths} months</span>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
