import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays, CalendarPlus, Download, Eye, LayoutGrid, List, MessageCircle,
  Pencil, Phone, Search, Stethoscope, UserCheck, UserPlus, Users, Wallet,
  X, AlertTriangle, ShieldAlert, CheckCircle2, ArrowUpDown, Clock, Filter,
  ChevronRight, Sparkles, MapPin, Droplet, ArrowRight
} from 'lucide-react';
import { api, downloadBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { formatDate, formatMoney, formatTime, humanize, todayISO } from '../../utils/format.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import PatientTypeBadge from '../../components/PatientTypeBadge.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

function RowAction({ label, icon: Icon, onClick, tone = 'default' }) {
  const tones = {
    default: 'text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white',
    accent: 'text-[#0a7f8b] hover:bg-teal-50 hover:text-teal-800 dark:hover:bg-teal-950/40',
    success: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40'
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${tones[tone]}`}
    >
      <Icon size={15} />
    </button>
  );
}

export default function PatientListPage() {
  const { has } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') || '';
  const [search, setSearch] = useState(initialQ);
  const [debounced, setDebounced] = useState(initialQ);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [active, setActive] = useState('true');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [filterTag, setFilterTag] = useState('all'); // 'all' | 'today' | 'dues' | 'recent'
  const [sort, setSort] = useState({ key: 'createdAt', order: 'desc' });

  useEffect(() => {
    setSearch(initialQ);
    setDebounced(initialQ);
  }, [initialQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patients', debounced, page, pageSize, active, sort],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sort.key,
        order: sort.order
      });
      if (debounced) qs.set('q', debounced);
      if (active) qs.set('isActive', active);
      return api.get(`/patients?${qs}`);
    },
    keepPreviousData: true
  });

  const rawRows = data?.data || [];
  const meta = data?.meta;
  const today = todayISO();

  // Filter tag logic
  const rows = useMemo(() => {
    if (filterTag === 'today') {
      return rawRows.filter((r) => r.nextAppointment?.date === today);
    }
    if (filterTag === 'dues') {
      return rawRows.filter((r) => Number(r.outstanding || 0) > 0);
    }
    return rawRows;
  }, [rawRows, filterTag, today]);

  // Aggregate stats
  const totalCount = meta?.total || rawRows.length;
  const todayApptsCount = useMemo(() => rawRows.filter((r) => r.nextAppointment?.date === today).length, [rawRows, today]);
  const duesCount = useMemo(() => rawRows.filter((r) => Number(r.outstanding || 0) > 0).length, [rawRows]);
  const totalDuesAmount = useMemo(
    () => rawRows.reduce((acc, r) => acc + Number(r.outstanding || 0), 0),
    [rawRows]
  );

  const columns = [
    {
      key: 'name',
      label: 'Patient Identification',
      sortable: true,
      sortKey: 'name',
      render: (r) => (
        <div className="flex items-center gap-3">
          <PatientAvatar patient={r} size={40} className="rounded-xl shadow-xs ring-1 ring-slate-100 dark:ring-slate-850" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-black text-slate-800 dark:text-white hover:text-[#0a7f8b] transition-colors cursor-pointer" onClick={() => navigate(`/patients/${r.id}`)}>
                {r.fullName}
              </p>
              <PatientTypeBadge isNew={r.isNewPatient} visitCount={r.visitCount} size="sm" />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-semibold text-slate-700 dark:text-slate-300">{r.patientNo}</span>
              {r.bloodGroup && r.bloodGroup !== 'unknown' && (
                <span className="rounded-md bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 font-bold text-rose-700 dark:text-rose-300">
                  {r.bloodGroup}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'age',
      label: 'Age & Gender',
      render: (r) => (
        <div className="leading-tight">
          <p className="text-xs font-black text-slate-800 dark:text-white">{r.age != null ? `${r.age} yrs` : '—'}</p>
          <p className="text-[11px] text-slate-500 font-semibold">{r.gender ? humanize(r.gender) : 'Not specified'}</p>
        </div>
      )
    },
    {
      key: 'mobile',
      label: 'Contact Details',
      render: (r) => {
        const cleanMobile = (r.mobile || '').replace(/\D/g, '');
        const waLink = cleanMobile ? `https://wa.me/${cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile}` : null;

        return (
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums font-bold text-xs text-slate-800 dark:text-white">{r.mobile}</span>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Chat on WhatsApp"
                  className="rounded-lg p-0.5 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <MessageCircle size={13} />
                </a>
              )}
            </div>
            {r.city ? (
              <p className="max-w-[170px] truncate text-[11px] text-slate-500 font-medium">{r.city}{r.state ? `, ${r.state}` : ''}</p>
            ) : r.email ? (
              <p className="max-w-[170px] truncate text-[11px] text-slate-500 font-medium">{r.email}</p>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'lastVisit',
      label: 'Last Treatment',
      render: (r) =>
        r.lastVisit ? (
          <div className="leading-tight">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatDate(r.lastVisit)}</span>
            <span className="block text-[10.5px] text-slate-400 font-semibold">Completed Visit</span>
          </div>
        ) : (
          <span className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">
            First Visit Pending
          </span>
        )
    },
    {
      key: 'nextAppointment',
      label: 'Next Dental Visit',
      render: (r) => {
        if (!r.nextAppointment) return <span className="text-[11px] text-slate-400 font-medium">No appointments</span>;
        const isToday = r.nextAppointment.date === today;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isToday ? 'bg-teal-100 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}
            >
              <CalendarPlus size={15} />
            </span>
            <div className="leading-tight">
              <p className={`text-xs ${isToday ? 'font-black text-[#0a7f8b] dark:text-teal-300' : 'font-bold text-slate-800 dark:text-white'}`}>
                {isToday ? 'Today' : formatDate(r.nextAppointment.date)}
              </p>
              {r.nextAppointment.startTime && (
                <p className="tabular-nums text-[10.5px] font-semibold text-slate-400">
                  {formatTime(r.nextAppointment.startTime)}
                </p>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'outstanding',
      label: 'Dues / Balance',
      align: 'right',
      render: (r) => {
        const val = Number(r.outstanding || 0);
        return val > 0 ? (
          <div className="text-right leading-tight">
            <span className="rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-800 dark:text-amber-300">
              {formatMoney(val)}
            </span>
            <span className="mt-0.5 block text-[10px] text-amber-600 font-bold">Pending</span>
          </div>
        ) : (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Nil (Clear)
          </span>
        );
      }
    },
    {
      key: 'isActive',
      label: 'Status',
      align: 'center',
      render: (r) => (
        <Badge tone={r.isActive ? 'success' : 'neutral'} dot>
          {r.isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 120,
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <RowAction label="Open Patient Profile" icon={Eye} tone="accent" onClick={() => navigate(`/patients/${r.id}`)} />
          {has('appointments.manage') && (
            <RowAction
              label="Book Appointment"
              icon={CalendarPlus}
              tone="success"
              onClick={() => navigate(`/appointments?patientId=${r.id}&new=1`)}
            />
          )}
          {has('patients.edit') && (
            <RowAction label="Edit Patient" icon={Pencil} onClick={() => navigate(`/patients/${r.id}/edit`)} />
          )}
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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-2 backdrop-blur-md shadow-inner">
              <img src={heroTooth} alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">Patients &amp; Clinical Directory</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  Live Directory
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                Search, register and manage dental patient profiles, clinical visits, medical history and billing records.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => downloadBlob('/reports/patients?format=csv', 'dental-patients.csv')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] border border-white/25 shadow-sm"
            >
              <Download size={15} />
              Export CSV
            </button>
            {has('patients.create') && (
              <button
                type="button"
                onClick={() => navigate('/patients/new')}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
              >
                <UserPlus size={16} className="text-[#0a7f8b]" />
                Register Patient
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Patient Directory 4 KPI Strip (Matches Screenshot 1:1) ──────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DoccureKpiCard
          title="REGISTERED PATIENTS"
          value={totalCount}
          subtitle="on roster"
          icon={Users}
          variant="teal"
        />
        <DoccureKpiCard
          title="SCHEDULED TODAY"
          value={todayApptsCount}
          subtitle="triage checked-in"
          icon={CalendarDays}
          variant="amber"
        />
        <DoccureKpiCard
          title="IN OPERATORY CHAIR"
          value={rawRows.filter((r) => r.isActive).length}
          subtitle="active care"
          icon={Stethoscope}
          variant="purple"
          hasDot={true}
        />
        <DoccureKpiCard
          title="COMPLETED CARE"
          value={totalCount - duesCount}
          subtitle="treated today"
          icon={CheckCircle2}
          variant="emerald"
        />
      </div>

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Search, Filter Tabs & Layout Controls */}
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
                placeholder="Search patient name, mobile or ID…"
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filter Chips & View Mode Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
                {[
                  { id: 'all', label: 'All Patients' },
                  { id: 'today', label: `Today (${todayApptsCount})` },
                  { id: 'dues', label: `Dues (${duesCount})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTag(tab.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${filterTag === tab.id
                      ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Active / Inactive selector */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
                {[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                  { value: '', label: 'All' }
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setActive(opt.value);
                      setPage(1);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${active === opt.value
                      ? 'bg-slate-900 text-white shadow-xs dark:bg-teal-600'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* View Switcher (Grid vs Table) */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Card Grid View"
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${viewMode === 'table' ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section: Grid View vs Table View */}
        {viewMode === 'grid' ? (
          <div className="p-6">
            {isLoading ? (
              <div className="py-20 text-center text-xs font-bold text-slate-500">Loading patients…</div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] mx-auto mb-3">
                  <Users size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">No patients found</h3>
                <p className="mt-1 text-xs text-slate-400">Try adjusting your search criteria or register a new patient.</p>
                {has('patients.create') && (
                  <button
                    type="button"
                    onClick={() => navigate('/patients/new')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-[#0a7f8b] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#086771] transition"
                  >
                    <UserPlus size={15} />
                    Register Patient
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((r) => {
                  const cleanMobile = (r.mobile || '').replace(/\D/g, '');
                  const waLink = cleanMobile ? `https://wa.me/${cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile}` : null;
                  const isTodayAppt = r.nextAppointment?.date === today;
                  const dues = Number(r.outstanding || 0);

                  return (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/patients/${r.id}`)}
                      className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#14b8c8]/40 hover:shadow-[0_12px_30px_-10px_rgba(10,127,139,0.2)] dark:border-slate-800 dark:bg-slate-850 cursor-pointer"
                    >
                      <div>
                        {/* Top Identification Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PatientAvatar
                              patient={r}
                              size={46}
                              className="rounded-2xl ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs"
                            />
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black text-slate-800 dark:text-white group-hover:text-[#0a7f8b] transition-colors">
                                {r.fullName}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] font-bold text-slate-400">{r.patientNo}</span>
                                {r.bloodGroup && r.bloodGroup !== 'unknown' && (
                                  <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                    {r.bloodGroup}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <PatientTypeBadge isNew={r.isNewPatient} visitCount={r.visitCount} size="sm" />
                        </div>

                        {/* Demographics & Contact Strip */}
                        <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50/70 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px] text-slate-400 font-bold">Age &amp; Gender:</span>
                            <span className="font-bold">{r.age != null ? `${r.age} yrs` : '—'} · {r.gender ? humanize(r.gender) : '—'}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px] text-slate-400 font-bold">Mobile Phone:</span>
                            <div className="flex items-center gap-1">
                              <span className="font-bold tabular-nums">{r.mobile}</span>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="WhatsApp"
                                  className="text-emerald-600 hover:text-emerald-700"
                                >
                                  <MessageCircle size={13} />
                                </a>
                              )}
                            </div>
                          </div>
                          {r.city && (
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                              <span className="text-[11px] text-slate-400 font-bold">Location:</span>
                              <span className="truncate max-w-[140px] font-medium">{r.city}</span>
                            </div>
                          )}
                        </div>

                        {/* Next Appointment or Treatment Badge */}
                        <div className="mt-3">
                          {r.nextAppointment ? (
                            <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold ${isTodayAppt
                                ? 'bg-teal-50 text-[#0a7f8b] border border-teal-200/80 dark:bg-teal-950/40 dark:border-teal-800'
                                : 'bg-slate-50 text-slate-700 border border-slate-100 dark:bg-slate-800 dark:border-slate-700'
                              }`}>
                              <CalendarDays size={14} className={isTodayAppt ? 'text-[#0a7f8b]' : 'text-slate-400'} />
                              <div className="min-w-0 flex-1 truncate">
                                <span>{isTodayAppt ? 'Visit Today' : formatDate(r.nextAppointment.date)}</span>
                                {r.nextAppointment.startTime && (
                                  <span className="text-[10px] text-slate-400 ml-1">({formatTime(r.nextAppointment.startTime)})</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-50/60 px-3 py-2 text-[11px] font-semibold text-slate-400 dark:bg-slate-800/40">
                              <Clock size={13} />
                              <span>No upcoming appointment</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Bottom Footer: Dues & Quick Actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                        <div>
                          {dues > 0 ? (
                            <span className="rounded-xl bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300">
                              {formatMoney(dues)} due
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                              ✓ Nil Balance
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/patients/${r.id}`)}
                            title="View Profile"
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                          >
                            <Eye size={14} />
                          </button>
                          {has('appointments.manage') && (
                            <button
                              type="button"
                              onClick={() => navigate(`/appointments?patientId=${r.id}&new=1`)}
                              title="Book Visit"
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 transition"
                            >
                              <CalendarPlus size={14} />
                            </button>
                          )}
                          {has('patients.edit') && (
                            <button
                              type="button"
                              onClick={() => navigate(`/patients/${r.id}/edit`)}
                              title="Edit Patient"
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
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
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            onRowClick={(r) => navigate(`/patients/${r.id}`)}
            sortKey={sort.key}
            sortOrder={sort.order}
            onSort={(key) => {
              setSort((prev) => ({
                key,
                order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc'
              }));
            }}
          />
        )}

        {/* Pagination Strip */}
        {meta && meta.totalPages > 1 && (
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-5 py-4">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
