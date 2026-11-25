import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Printer, ReceiptText, Wallet, AlertCircle, CheckCircle2, FileText,
  TrendingUp, MessageCircle, IndianRupee, Search, LayoutGrid, List,
  Sparkles, ArrowRight, Clock3, CalendarDays, Check, RefreshCw
} from 'lucide-react';
import { api, openBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatMoney, monthStartISO, todayISO, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import { Select } from '../../components/ui/Input.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' }
];

export default function InvoicesPage() {
  const { has } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [range, setRange] = useState(() => ({ start: monthStartISO(), end: todayISO() }));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | outstanding | paid | draft
  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [sort, setSort] = useState({ key: 'invoiceDate', order: 'desc' });

  // Sync activeTab with status/outstandingOnly filters
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'all') {
      setStatus('');
      setOutstandingOnly(false);
    } else if (tab === 'outstanding') {
      setStatus('');
      setOutstandingOnly(true);
    } else if (tab === 'paid') {
      setStatus('paid');
      setOutstandingOnly(false);
    } else if (tab === 'draft') {
      setStatus('draft');
      setOutstandingOnly(false);
    }
  };

  const params = new URLSearchParams();
  params.set('startDate', range.start);
  params.set('endDate', range.end);
  if (search.trim()) params.set('q', search.trim());
  if (status) params.set('status', status);
  if (outstandingOnly) params.set('outstanding', 'true');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['invoices', range.start, range.end, search, status, outstandingOnly],
    queryFn: async () => (await api.get(`/invoices?${params.toString()}`)).data
  });

  const rows = data || [];
  const active = rows.filter((r) => r.status !== 'void');
  const invoiced = active.reduce((sum, r) => sum + Number(r.total), 0);
  const collected = active.reduce((sum, r) => sum + Number(r.amountPaid), 0);
  const outstanding = active.reduce((sum, r) => sum + Number(r.outstanding), 0);
  const paidCount = active.filter((r) => r.status === 'paid').length;
  const draftCount = rows.filter((r) => r.status === 'draft').length;
  const collectionRate = invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0;

  const sortedRows = useMemo(() => {
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sort.key === 'invoiceDate') return (new Date(av) - new Date(bv)) * dir;
      if (['total', 'amountPaid', 'outstanding', 'itemCount'].includes(sort.key)) return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort]);

  const openPdf = async (invoice) => {
    try {
      await openBlob(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNo}.pdf`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openBalanceWhatsApp = (e, r) => {
    e.stopPropagation();
    if (!r.mobile) {
      toast.error('No mobile number on file');
      return;
    }
    const clean = r.mobile.replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    const msg = encodeURIComponent(
      `Hello ${r.patientName}, this is ZhanX DentalCare. This is a gentle reminder regarding Invoice #${r.invoiceNo} with an outstanding balance of ${formatMoney(r.outstanding)}. Kindly contact our front desk or reply to clear the dues. Thank you!`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const columns = [
    {
      key: 'invoiceNo',
      label: 'Invoice',
      sortable: true,
      sortKey: 'invoiceNo',
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">{r.invoiceNo}</p>
          <p className="mt-0.5 text-[10.5px] text-slate-400 font-semibold">{formatDate(r.invoiceDate)}</p>
        </div>
      )
    },
    {
      key: 'patientName',
      label: 'Patient',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <PatientAvatar
            patient={{ id: r.patientId, fullName: r.patientName }}
            size={34}
            className="rounded-xl shadow-xs ring-1 ring-slate-100 dark:ring-slate-800"
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900 dark:text-white text-xs">{r.patientName}</p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono font-medium">
              <span>{r.patientNo}</span>
              {r.mobile && (
                <>
                  <span>·</span>
                  <span>{r.mobile}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'itemCount',
      label: 'Items',
      align: 'center',
      sortable: true,
      render: (r) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {r.itemCount ?? 0}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Billed Total',
      align: 'right',
      sortable: true,
      render: (r) => <span className="font-black tabular-nums text-slate-900 dark:text-white text-xs">{formatMoney(r.total)}</span>
    },
    {
      key: 'amountPaid',
      label: 'Paid',
      align: 'right',
      sortable: true,
      render: (r) => <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-xs">{formatMoney(r.amountPaid)}</span>
    },
    {
      key: 'outstanding',
      label: 'Balance Due',
      align: 'right',
      sortable: true,
      render: (r) => (
        <span className={`tabular-nums font-black text-xs ${Number(r.outstanding) > 0 && r.status !== 'void' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
          {formatMoney(r.outstanding)}
        </span>
      )
    },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {Number(r.outstanding) > 0 && r.mobile && r.status !== 'void' && (
            <button
              type="button"
              onClick={(e) => openBalanceWhatsApp(e, r)}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition shadow-2xs dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300"
              title="Send Balance Reminder on WhatsApp"
            >
              <MessageCircle size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openPdf(r); }}
            className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-1 text-xs font-bold text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 transition"
          >
            <Printer size={12} />
            PDF
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Doccure Dental Signature Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#08636d] p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-15 pointer-events-none">
          <img src={heroTooth} alt="" className="h-64 translate-x-12" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-0.5 text-xs font-black tracking-wide text-white backdrop-blur-sm">
              <ReceiptText size={14} className="stroke-[2.5]" />
              FINANCIAL OPERATIONS &amp; BILLING
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Dental Invoicing &amp; Revenue Ledger
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Generate patient treatment invoices, track procedure collections, dispatch automated WhatsApp balance reminders, and monitor clinical cashflow health.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/payments')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-black text-white hover:bg-white/25 backdrop-blur-sm transition border border-white/20 cursor-pointer shadow-xs"
            >
              <Wallet size={15} />
              Payment Records
            </button>
            {has('invoices.manage') && (
              <button
                type="button"
                onClick={() => navigate('/invoices/new')}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-[#0a7f8b] shadow-lg hover:bg-teal-50 hover:shadow-xl transition cursor-pointer"
              >
                <Plus size={16} className="stroke-[3]" />
                New Invoice
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards: Strictly Matches Waiting Queue Screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="TOTAL BILLED"
          value={formatMoney(invoiced)}
          subtitle={`${active.length} invoices`}
          icon={FileText}
          variant="teal"
        />
        <DoccureKpiCard
          title="COLLECTED REVENUE"
          value={formatMoney(collected)}
          subtitle={`${collectionRate}% rate`}
          icon={CheckCircle2}
          variant="emerald"
        />
        <DoccureKpiCard
          title="OUTSTANDING BALANCE"
          value={formatMoney(outstanding)}
          subtitle="pending dues"
          icon={AlertCircle}
          variant="amber"
        />
        <DoccureKpiCard
          title="FULLY SETTLED"
          value={paidCount}
          subtitle="zero balance"
          icon={TrendingUp}
          variant="purple"
          hasDot
        />
      </div>

      {/* Main Billing Workspace Panel */}
      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
        {/* Controls Toolbar: Search, Status filter, Date Range, View switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          {/* Quick Filter Status Tabs */}
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              All Invoices ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('outstanding')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'outstanding'
                  ? 'bg-amber-50 text-amber-700 shadow-xs dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Outstanding Dues
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('paid')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'paid'
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Fully Settled ({paidCount})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('draft')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'draft'
                  ? 'bg-slate-200/80 text-slate-800 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Drafts ({draftCount})
            </button>
          </div>

          {/* Right: View Mode Toggle & Refresh */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition shadow-2xs"
              title="Refresh ledger"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin text-[#0a7f8b]' : ''} />
            </button>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 dark:bg-slate-800 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  viewMode === 'cards'
                    ? 'bg-teal-50 text-[#0a7f8b] font-bold dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Cards view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  viewMode === 'table'
                    ? 'bg-teal-50 text-[#0a7f8b] font-bold dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Table view"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Row: Search & Date Range */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[260px] max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, patient name, or mobile..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:bg-white focus:outline-none dark:bg-slate-800/60 dark:border-slate-700 dark:text-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <DateRangeFilter start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-[140px] text-xs font-semibold rounded-2xl"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </div>

        {/* Body: Cards or Table */}
        {viewMode === 'cards' ? (
          <div>
            {isLoading ? (
              <div className="py-16 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-[#0a7f8b]" />
                <p className="mt-2 text-xs font-bold text-slate-400">Loading invoices...</p>
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                <ReceiptText size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <h3 className="mt-3 text-sm font-black text-slate-800 dark:text-slate-200">No invoices found</h3>
                <p className="mt-1 text-xs text-slate-400">Try adjusting your date range, search query, or status filter.</p>
                {has('invoices.manage') && (
                  <button
                    type="button"
                    onClick={() => navigate('/invoices/new')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-[#0a7f8b] px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-[#08636d] transition"
                  >
                    <Plus size={14} />
                    Create New Invoice
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedRows.map((r) => {
                  const hasDue = Number(r.outstanding) > 0 && r.status !== 'void';
                  return (
                    <article
                      key={r.id}
                      onClick={() => navigate(`/invoices/${r.id}`)}
                      className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-[#0a7f8b] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer dark:bg-slate-850 dark:border-slate-800"
                    >
                      <div>
                        {/* Top: Invoice No & Status Badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">
                            {r.invoiceNo}
                          </span>
                          <Badge status={r.status} />
                        </div>

                        {/* Patient Information */}
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
                              {r.patientNo} {r.mobile ? `· ${r.mobile}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Financial Ledger Pill */}
                        <div className="mt-3.5 space-y-1.5 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Invoice Date:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {formatDate(r.invoiceDate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Total Billed:</span>
                            <span className="font-black text-slate-900 dark:text-white tabular-nums">
                              {formatMoney(r.total)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Amount Paid:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatMoney(r.amountPaid)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5 dark:border-slate-700">
                            <span className="text-[11px] font-black uppercase text-slate-500">Balance Due:</span>
                            <span className={`font-black tabular-nums ${hasDue ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                              {formatMoney(r.outstanding)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: WhatsApp reminder & PDF button */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {hasDue && r.mobile && (
                            <button
                              type="button"
                              onClick={(e) => openBalanceWhatsApp(e, r)}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-100 transition shadow-2xs dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300"
                              title="Send Balance Reminder on WhatsApp"
                            >
                              <MessageCircle size={12} />
                              WhatsApp
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openPdf(r); }}
                            className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-1 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 transition shadow-2xs"
                          >
                            <Printer size={12} />
                            PDF
                          </button>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#0a7f8b] group-hover:translate-x-0.5 transition-transform">
                          View <ArrowRight size={12} />
                        </span>
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
            rows={sortedRows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            onRowClick={(r) => navigate(`/invoices/${r.id}`)}
            sort={sort}
            onSortChange={setSort}
            emptyTitle="No invoices in this range"
            emptyMessage="Adjust the filters or create a new invoice for a patient."
            emptyAction={has('invoices.manage') ? <Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate('/invoices/new')}>New invoice</Button> : null}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-4 py-3">
                <span>Showing {sortedRows.length} invoice{sortedRows.length === 1 ? '' : 's'}</span>
                <Button size="sm" variant="ghost" icon={ReceiptText} onClick={() => navigate('/payments')}>Go to payments</Button>
              </div>
            }
          />
        )}
      </div>

      {outstanding > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-amber-50/40 p-4 text-xs font-bold text-amber-900 shadow-xs dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
          <Wallet size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{formatMoney(outstanding)} is currently pending collection across the filtered invoices.</span>
        </div>
      )}
    </div>
  );
}
