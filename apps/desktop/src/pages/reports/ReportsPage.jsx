import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Database,
  ChevronRight,
  Stethoscope,
  Wallet,
  Users,
  Package,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  Receipt,
  FileText,
  Clock,
  Sparkles,
  ArrowUpRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { api, downloadBlob, openBlob } from '../../services/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatMoney, addDaysISO, todayISO } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { PageLoader, ErrorState, EmptyState } from '../../components/ui/States.jsx';

const CATEGORIES = [
  { id: 'all', label: 'All Reports' },
  { id: 'financial', label: 'Financial & Revenue', icon: Wallet, tone: 'emerald' },
  { id: 'clinical', label: 'Clinical & Procedures', icon: Stethoscope, tone: 'violet' },
  { id: 'appointments', label: 'Appointments & Flow', icon: CalendarDays, tone: 'sky' },
  { id: 'patients', label: 'Patients & Growth', icon: Users, tone: 'blue' },
  { id: 'inventory', label: 'Inventory & Pharmacy', icon: Package, tone: 'amber' }
];

function categorizeReport(name = '') {
  const n = name.toLowerCase();
  if (
    n.includes('collection') ||
    n.includes('revenue') ||
    n.includes('payment') ||
    n.includes('invoice') ||
    n.includes('discount') ||
    n.includes('refund') ||
    n.includes('cash')
  ) {
    return 'financial';
  }
  if (
    n.includes('treatment') ||
    n.includes('procedure') ||
    n.includes('visit') ||
    n.includes('plan') ||
    n.includes('follow-up')
  ) {
    return 'clinical';
  }
  if (n.includes('appointment')) {
    return 'appointments';
  }
  if (n.includes('patient')) {
    return 'patients';
  }
  if (n.includes('stock') || n.includes('inventory')) {
    return 'inventory';
  }
  return 'financial';
}

function reportMeta(name = '') {
  const n = name.toLowerCase();
  if (n.includes('collections-daily')) {
    return { icon: Wallet, tone: 'emerald', desc: 'Daily settlement receipts by mode' };
  }
  if (n.includes('monthly-collection')) {
    return { icon: TrendingUp, tone: 'emerald', desc: 'Monthly cashflow and turnover' };
  }
  if (n.includes('treatment-revenue')) {
    return { icon: Receipt, tone: 'emerald', desc: 'Procedure revenue contribution' };
  }
  if (n.includes('outstanding')) {
    return { icon: AlertTriangle, tone: 'amber', desc: 'Unpaid patient balances and aging' };
  }
  if (n.includes('payment-methods')) {
    return { icon: Wallet, tone: 'emerald', desc: 'Cash, UPI, Card, NetBanking split' };
  }
  if (n.includes('discounts') || n.includes('refunds')) {
    return { icon: Receipt, tone: 'rose', desc: 'Concessions and refund vouchers' };
  }
  if (n.includes('completed-procedures') || n.includes('treatment-history')) {
    return { icon: Stethoscope, tone: 'violet', desc: 'Clinical treatments performed' };
  }
  if (n.includes('patient-visits') || n.includes('pending-plans')) {
    return { icon: FileText, tone: 'violet', desc: 'Doctor consultations & open plans' };
  }
  if (n.includes('follow-ups')) {
    return { icon: Clock, tone: 'violet', desc: 'Post-op clinical review schedule' };
  }
  if (n.includes('cancelled') || n.includes('no-show')) {
    return { icon: AlertTriangle, tone: 'rose', desc: 'Attrition and missed appointments' };
  }
  if (n.includes('dentist-appointments') || n.includes('appointments')) {
    return { icon: CalendarDays, tone: 'sky', desc: 'Scheduled patient visits & doctor workload' };
  }
  if (n.includes('patients')) {
    return { icon: Users, tone: 'blue', desc: 'Patient demographics & acquisition' };
  }
  if (n.includes('low-stock') || n.includes('expiring')) {
    return { icon: AlertTriangle, tone: 'amber', desc: 'Critical inventory & batch expiry alerts' };
  }
  if (n.includes('stock') || n.includes('inventory')) {
    return { icon: Package, tone: 'amber', desc: 'Material consumption and asset valuation' };
  }
  return { icon: BarChart3, tone: 'blue', desc: 'Analytical report' };
}

function renderCell(value, format) {
  if (value === null || value === undefined || value === '') return '—';
  if (format === 'money') return formatMoney(value);
  if (format === 'date') return formatDate(value);
  if (format === 'bool') return value ? 'Yes' : 'No';
  if (format === 'int' || format === 'number') return Number(value).toLocaleString('en-IN');
  return String(value);
}

export default function ReportsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState(() => ({ start: addDaysISO(todayISO(), -29), end: todayISO() }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tableFilter, setTableFilter] = useState('');

  const catalog = useQuery({
    queryKey: ['report-catalog'],
    queryFn: async () => (await api.get('/reports')).data,
    staleTime: 10 * 60_000
  });

  const reportName = params.get('report') || '';
  const selected = (catalog.data || []).find((r) => r.name === reportName);

  const report = useQuery({
    queryKey: ['report', reportName, range.start, range.end, page, pageSize],
    queryFn: async () => {
      const res = await api.get(
        `/reports/${reportName}?startDate=${range.start}&endDate=${range.end}&format=json&page=${page}&pageSize=${pageSize}`
      );
      return { ...res.data, meta: res.meta };
    },
    enabled: Boolean(reportName)
  });

  const pickReport = (name) => {
    setPage(1);
    setTableFilter('');
    const next = new URLSearchParams(params);
    next.set('report', name);
    setParams(next, { replace: true });
  };

  const exportReport = async (format) => {
    if (!reportName) return;
    const ext = format === 'xlsx' ? 'xlsx' : format;
    const fileName = `${reportName}-${range.start}-to-${range.end}.${ext}`;
    try {
      if (format === 'pdf') {
        await openBlob(`/reports/${reportName}?startDate=${range.start}&endDate=${range.end}&format=pdf`, fileName);
      } else {
        await downloadBlob(
          `/reports/${reportName}?startDate=${range.start}&endDate=${range.end}&format=${format}`,
          fileName
        );
      }
      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredCatalog = useMemo(() => {
    const list = catalog.data || [];
    return list.filter((r) => {
      const cat = categorizeReport(r.name);
      if (selectedCategory !== 'all' && cat !== selectedCategory) return false;
      if (!catalogSearch.trim()) return true;
      const q = catalogSearch.trim().toLowerCase();
      return r.title.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [catalog.data, selectedCategory, catalogSearch]);

  const rawRows = report.data?.rows || [];

  const displayedRows = useMemo(() => {
    if (!tableFilter.trim()) return rawRows;
    const q = tableFilter.trim().toLowerCase();
    return rawRows.filter((row) =>
      Object.values(row).some((val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q))
    );
  }, [rawRows, tableFilter]);

  const columns = useMemo(() => {
    return (report.data?.columns || []).map((c) => ({
      key: c.key,
      label: c.label,
      align: ['money', 'int', 'number'].includes(c.format) ? 'right' : 'left',
      render: (row) => {
        const text = renderCell(row[c.key], c.format);
        if (c.format === 'money' && Number(row[c.key]) < 0) {
          return <span className="font-semibold text-rose-700">{text}</span>;
        }
        if (c.format === 'money') {
          return <span className="font-semibold text-slate-800 tabular-nums">{text}</span>;
        }
        return text;
      }
    }));
  }, [report.data?.columns]);

  // Executive KPI stats for the loaded report
  const kpiStats = useMemo(() => {
    if (!report.data || !rawRows.length) return null;
    const cols = report.data.columns || [];
    const moneyCol = cols.find((c) => c.format === 'money');
    let totalSum = null;
    if (moneyCol) {
      totalSum = rawRows.reduce((acc, row) => acc + (Number(row[moneyCol.key]) || 0), 0);
    }
    return {
      rowCount: rawRows.length,
      moneyLabel: moneyCol ? moneyCol.label : null,
      totalSum
    };
  }, [report.data, rawRows]);

  const FEATURED_CARDS = [
    {
      name: 'collections-daily',
      title: 'Daily Collections & Receipts',
      desc: 'Itemized revenue by payment mode, cash split, and daily billing totals.',
      icon: Wallet,
      tone: 'emerald'
    },
    {
      name: 'completed-procedures',
      title: 'Completed Dental Procedures',
      desc: 'Clinical treatments performed, tooth surfaces restored, and doctor logs.',
      icon: Stethoscope,
      tone: 'violet'
    },
    {
      name: 'appointments',
      title: 'Appointment Volume & Flow',
      desc: 'Daily patient visits, schedule adherence, and operatory utilization.',
      icon: CalendarDays,
      tone: 'sky'
    },
    {
      name: 'outstanding-invoices',
      title: 'Outstanding Dues & Aging',
      desc: 'Unpaid patient balances, credit amounts, and collection priorities.',
      icon: AlertTriangle,
      tone: 'amber'
    },
    {
      name: 'low-stock',
      title: 'Low Stock & Reorder Alerts',
      desc: 'Critical dental supplies, anesthesia cartridges, and restorative materials.',
      icon: Package,
      tone: 'rose'
    },
    {
      name: 'patients',
      title: 'Patient Growth & Profiles',
      desc: 'New patient registrations, demographic split, and acquisition trends.',
      icon: Users,
      tone: 'blue'
    }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Clinical & Financial Intelligence"
        title="Reports & Practice Analytics"
        subtitle="22 audit-ready clinical, operatory, inventory and financial reports with live PostgreSQL streaming."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports' }]}
        actions={
          <DateRangeFilter
            start={range.start}
            end={range.end}
            onChange={(start, end) => {
              setRange({ start, end });
              setPage(1);
            }}
          />
        }
      />

      {/* Main Grid: Left Catalog Navigation (280px) + Right Analytics Canvas */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left Column: Report Catalog Card */}
        <div className="h-fit space-y-2.5 rounded-3xl border border-white/80 bg-white/85 p-4 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.12)] backdrop-blur-xl xl:sticky xl:top-3">
          <div className="flex items-center justify-between border-b border-teal-100/60 pb-2">
            <div>
              <h3 className="text-xs font-black text-slate-900">Report Catalog</h3>
              <p className="text-[10px] font-semibold text-[#0a7f8b]">22 Clinical &amp; Financial Reports</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200">
              <BarChart3 size={14} />
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search reports…"
              className="input-base h-8.5 rounded-2xl pl-8 text-[11.5px] border-teal-100/80 focus:border-teal-500"
              aria-label="Search reports"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-teal-100/60 pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Scrollable Report List */}
          <div className="max-h-[calc(100vh-220px)] space-y-0.5 overflow-y-auto pr-0.5">
            {catalog.isLoading ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">Loading catalog from database…</p>
            ) : filteredCatalog.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">No reports matching filter.</p>
            ) : (
              filteredCatalog.map((r) => {
                const meta = reportMeta(r.name);
                const Icon = meta.icon;
                const active = reportName === r.name;

                const toneClasses = {
                  emerald: active ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                  violet: active ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-700 ring-violet-200',
                  sky: active ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-700 ring-sky-200',
                  blue: active ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-700 ring-blue-200',
                  amber: active ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 ring-amber-200',
                  rose: active ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-700 ring-rose-200'
                }[meta.tone || 'blue'];

                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => pickReport(r.name)}
                    className={`group flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-all ${
                      active
                        ? 'bg-navy-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 transition-all ${toneClasses}`}
                    >
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[11.5px] leading-tight ${
                          active ? 'font-bold text-white' : 'font-semibold text-ink group-hover:text-navy'
                        }`}
                      >
                        {r.title}
                      </p>
                      <p className={`truncate text-[9.5px] ${active ? 'text-white/70' : 'text-slate-400'}`}>
                        {meta.desc}
                      </p>
                    </div>
                    {active && <ChevronRight size={13} className="shrink-0 text-cyan-300" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Database Footer Status */}
          <div className="flex items-center justify-between border-t border-line/70 pt-1.5 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1 font-medium">
              <Database size={11} className="text-emerald-500" /> PostgreSQL 16
            </span>
            <span className="rounded bg-emerald-50 px-1 py-0.2 font-mono text-[9.5px] font-bold text-emerald-700">
              REALTIME
            </span>
          </div>
        </div>

        {/* Right Column: Analytics Canvas */}
        <div className="min-w-0">
          {!reportName ? (
            /* Welcome / Featured Showcase - Doccure Glassmorphic Card */
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.12)] backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-900">
                      Select a Clinical or Financial Report
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Choose from the catalog on the left or select a featured report below.
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-[#0a7f8b] border border-teal-200/80 shadow-xs">
                    22 Available
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {FEATURED_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.name}
                        type="button"
                        onClick={() => pickReport(card.name)}
                        className="group flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 text-left shadow-xs transition-all duration-300 hover:border-teal-400 hover:shadow-[0_10px_25px_-10px_rgba(10,127,139,0.2)] hover:-translate-y-0.5"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a7f8b] to-[#14b8c8] text-white shadow-sm transition-transform group-hover:scale-105">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-[13px] font-bold text-slate-900 group-hover:text-[#0a7f8b]">
                            {card.title}
                          </h4>
                          <p className="line-clamp-2 text-[11px] text-slate-500 leading-snug mt-0.5">
                            {card.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Selected Report Canvas - Compact & High-Density Single Card */
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-xs">
              {/* Header Bar: Report Title + Actions on One Line */}
              <div className="flex flex-col gap-2 border-b border-line bg-slate-50/70 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white shadow-2xs">
                    <BarChart3 size={15} className="text-cyan-300" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-navy">
                        {selected?.title || reportName}
                      </h2>
                      <span className="rounded bg-navy-50 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-navy border border-navy-200">
                        {formatDate(range.start)} - {formatDate(range.end)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compact Export Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={RefreshCw}
                    onClick={() => report.refetch()}
                    loading={report.isFetching}
                    className="h-7.5 px-2.5 text-xs text-slate-600 hover:text-navy"
                  >
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={FileDown}
                    onClick={() => exportReport('csv')}
                    className="h-7.5 px-2.5 text-xs border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    icon={FileSpreadsheet}
                    onClick={() => exportReport('xlsx')}
                    className="h-7.5 px-2.5 text-xs border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                  >
                    Excel (.xlsx)
                  </Button>
                  <Button
                    size="sm"
                    icon={Printer}
                    onClick={() => exportReport('pdf')}
                    className="h-7.5 px-2.5 text-xs border-navy-900 bg-navy-900 text-white hover:bg-navy-800 shadow-2xs"
                  >
                    PDF
                  </Button>
                </div>
              </div>

              {/* Sub-toolbar: Quick Filter on Left + Inline KPI Stats on Right */}
              <div className="flex flex-col gap-2 border-b border-line/70 bg-white px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-xs">
                  <Filter size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    placeholder="Quick filter in results…"
                    className="input-base h-7.5 pl-7 text-[11.5px]"
                    aria-label="Filter results"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-slate-500">
                    Records: <strong className="font-bold text-navy">{displayedRows.length}</strong>
                    {displayedRows.length !== rawRows.length && (
                      <span className="text-slate-400"> (of {rawRows.length})</span>
                    )}
                  </span>

                  {kpiStats?.moneyLabel && kpiStats.totalSum !== null && (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
                      Total {kpiStats.moneyLabel}: <span className="font-mono font-bold">{formatMoney(kpiStats.totalSum)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Data Table */}
              {report.isLoading ? (
                <PageLoader label="Querying clinic database records…" />
              ) : report.error ? (
                <ErrorState error={report.error} onRetry={report.refetch} />
              ) : (
                <>
                  <DataTable
                    columns={columns}
                    rows={displayedRows}
                    emptyTitle="No records found in selected date range"
                    emptyMessage="Try selecting a wider date range or clear the search filter."
                  />

                  {report.data?.meta && (
                    <div className="border-t border-line px-4 py-2">
                      <Pagination
                        meta={report.data.meta}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                          setPageSize(size);
                          setPage(1);
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
