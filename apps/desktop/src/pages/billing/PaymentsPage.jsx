import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ReceiptText, Ban, Wallet, Undo2, AlertTriangle, CreditCard, Banknote,
  QrCode, Search, LayoutGrid, List, RefreshCw, Printer, ArrowRight,
  Sparkles, CheckCircle2, Clock
} from 'lucide-react';
import { api, openBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useClinic } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney, formatPaymentMethod, monthStartISO, todayISO, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const FALLBACK_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

export default function PaymentsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const clinic = useClinic();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'refunds' && has('reports.financial') ? 'refunds' : 'payments';
  const [range, setRange] = useState(() => ({ start: monthStartISO(), end: todayISO() }));
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState(null);

  const methods = clinic.data?.defaultPaymentMethods?.length ? clinic.data.defaultPaymentMethods : FALLBACK_METHODS;

  const listParams = new URLSearchParams({ startDate: range.start, endDate: range.end });
  if (search.trim()) listParams.set('q', search.trim());
  if (method) listParams.set('method', method);

  const payments = useQuery({
    queryKey: ['payments', range.start, range.end, search, method],
    queryFn: async () => (await api.get(`/payments?${listParams.toString()}`)).data
  });

  const refunds = useQuery({
    queryKey: ['refunds', range.start, range.end],
    queryFn: async () => (await api.get(`/refunds?startDate=${range.start}&endDate=${range.end}`)).data,
    enabled: has('reports.financial')
  });

  const rows = payments.data || [];
  const completed = rows.filter((p) => p.status === 'completed');
  const collected = completed.reduce((sum, p) => sum + Number(p.amount), 0);
  const voided = rows.filter((p) => p.status === 'void');
  const refundRows = refunds.data || [];
  const refundedTotal = refundRows.reduce((sum, r) => sum + Number(r.amount), 0);

  const printReceipt = async (payment) => {
    try {
      await openBlob(`/payments/${payment.id}/receipt.pdf`, `${payment.paymentNo}.pdf`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submitVoid = async () => {
    setVoidError(null);
    if (voidReason.trim().length < 3) return setVoidError('Give a reason of at least 3 characters.');
    setVoidBusy(true);
    try {
      await api.post(`/payments/${voidTarget.id}/void`, { reason: voidReason.trim() });
      toast.success(`Payment ${voidTarget.paymentNo} voided`);
      setVoidTarget(null);
      setVoidReason('');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      setVoidError(err.message);
    } finally {
      setVoidBusy(false);
    }
  };

  const paymentColumns = [
    {
      key: 'paymentNo',
      label: 'Receipt #',
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">{r.paymentNo}</p>
          <p className="mt-0.5 text-[10.5px] text-slate-400 font-semibold">{formatDateTime(r.paymentDate)}</p>
        </div>
      )
    },
    {
      key: 'patientName',
      label: 'Patient',
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <PatientAvatar
            patient={{ id: r.patientId, fullName: r.patientName }}
            size={34}
            className="rounded-xl shadow-xs ring-1 ring-slate-100 dark:ring-slate-800"
          />
          <div className="min-w-0">
            <Link to={`/patients/${r.patientId}`} className="font-bold text-slate-900 hover:text-[#0a7f8b] truncate block text-xs dark:text-white transition-colors">
              {r.patientName}
            </Link>
            <p className="text-[10.5px] font-mono text-slate-400 font-medium">{r.patientNo}{r.mobile ? ` · ${r.mobile}` : ''}</p>
          </div>
        </div>
      )
    },
    {
      key: 'invoiceNo',
      label: 'Invoice',
      render: (r) => (
        <Link to={`/invoices/${r.invoiceId}`} className="font-mono text-xs font-bold text-[#0a7f8b] hover:underline">
          {r.invoiceNo}
        </Link>
      )
    },
    {
      key: 'method',
      label: 'Payment Mode',
      render: (r) => {
        const m = String(r.method || '').toLowerCase();
        const isUpi = m.includes('upi');
        const isCash = m.includes('cash');
        const isCard = m.includes('card');
        return (
          <div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-black ${
              isUpi ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300' :
              isCash ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300' :
              isCard ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300' :
              'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {formatPaymentMethod(r.method)}
            </span>
            {r.transactionRef && <p className="mt-0.5 text-[10px] font-mono text-slate-400">{r.transactionRef}</p>}
          </div>
        );
      }
    },
    {
      key: 'amount',
      label: 'Amount Collected',
      align: 'right',
      render: (r) => (
        <span className={`font-black tabular-nums text-xs ${r.status === 'void' ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {formatMoney(r.amount)}
        </span>
      )
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'recordedByName', label: 'Staff / Cashier', render: (r) => <span className="text-xs text-slate-500 font-medium">{r.recordedByName || '—'}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => printReceipt(r)}
            className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-1 text-xs font-bold text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 transition"
          >
            <ReceiptText size={12} />
            Receipt
          </button>
          {has('refunds.manage') && r.status === 'completed' && (
            <button
              type="button"
              onClick={() => { setVoidTarget(r); setVoidReason(''); setVoidError(null); }}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              title="Void payment"
            >
              <Ban size={13} />
            </button>
          )}
        </div>
      )
    }
  ];

  const refundColumns = [
    {
      key: 'refundNo',
      label: 'Refund Receipt',
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-black text-rose-600 dark:text-rose-400">{r.refundNo}</p>
          <p className="text-[10.5px] text-slate-400 font-semibold">{formatDateTime(r.refundedAt)}</p>
        </div>
      )
    },
    {
      key: 'patientName',
      label: 'Patient',
      render: (r) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-xs">{r.patientName}</p>
          <p className="text-[10.5px] font-mono text-slate-400 font-medium">{r.patientNo}</p>
        </div>
      )
    },
    { key: 'invoiceNo', label: 'Invoice', render: (r) => <Link to={`/invoices/${r.invoiceId}`} className="font-mono text-xs font-bold text-[#0a7f8b] hover:underline">{r.invoiceNo}</Link> },
    { key: 'paymentNo', label: 'Payment', render: (r) => <span className="font-mono text-xs text-slate-600">{r.paymentNo || 'Invoice-level'}</span> },
    { key: 'method', label: 'Method' },
    { key: 'reason', label: 'Reason', className: 'max-w-[260px] truncate text-xs text-slate-600' },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-black text-rose-600 tabular-nums text-xs">{formatMoney(r.amount)}</span> },
    { key: 'refundedByName', label: 'Issued by', render: (r) => <span className="text-xs text-slate-500 font-medium">{r.refundedByName || '—'}</span> }
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
              <Wallet size={14} className="stroke-[2.5]" />
              FINANCIAL TRANSACTIONS &amp; CASH REGISTER
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Payments &amp; Collections Ledger
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Track real-time patient receipts, settle invoices across Cash, UPI, and Card terminals, print official tax receipts, and audit refund transactions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} />
          </div>
        </div>
      </div>

      {/* KPI Cards: Strictly Matches Waiting Queue Screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="COLLECTED IN RANGE"
          value={formatMoney(collected)}
          subtitle={`${completed.length} receipts`}
          icon={Wallet}
          variant="emerald"
        />
        <DoccureKpiCard
          title="AVERAGE TICKET"
          value={formatMoney(completed.length ? collected / completed.length : 0)}
          subtitle="per transaction"
          icon={ReceiptText}
          variant="teal"
        />
        <DoccureKpiCard
          title="VOIDED TRANSACTIONS"
          value={voided.length}
          subtitle="cancelled"
          icon={Ban}
          variant="rose"
        />
        <DoccureKpiCard
          title="REFUNDS ISSUED"
          value={formatMoney(refundedTotal)}
          subtitle={`${refundRows.length} refunded`}
          icon={Undo2}
          variant="amber"
          hasDot
        />
      </div>

      {/* Main Panel */}
      <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
        {/* Top Controls: Tabs & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('tab');
                setParams(next, { replace: true });
              }}
              className={`rounded-xl px-4 py-1.5 text-xs font-black transition cursor-pointer ${
                tab === 'payments'
                  ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Collections ({rows.length})
            </button>
            {has('reports.financial') && (
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('tab', 'refunds');
                  setParams(next, { replace: true });
                }}
                className={`rounded-xl px-4 py-1.5 text-xs font-black transition cursor-pointer ${
                  tab === 'refunds'
                    ? 'bg-white text-rose-600 shadow-xs dark:bg-slate-900 dark:text-rose-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Refunds ({refunds.data?.length ?? 0})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => payments.refetch()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition shadow-2xs"
              title="Refresh ledger"
            >
              <RefreshCw size={14} className={payments.isFetching ? 'animate-spin text-[#0a7f8b]' : ''} />
            </button>

            {tab === 'payments' && (
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
            )}
          </div>
        </div>

        {/* Filter bar */}
        {tab === 'payments' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receipt #, invoice # or patient..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:bg-white focus:outline-none dark:bg-slate-800/60 dark:border-slate-700 dark:text-white transition"
              />
            </div>

            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-9 w-44 text-xs font-semibold rounded-2xl"
              aria-label="Filter by payment method"
            >
              <option value="">All Payment Modes</option>
              {methods.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        )}

        {/* Content Section */}
        {tab === 'payments' ? (
          viewMode === 'cards' ? (
            payments.isLoading ? (
              <div className="py-16 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-[#0a7f8b]" />
                <p className="mt-2 text-xs font-bold text-slate-400">Loading payment transactions...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                <Wallet size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <h3 className="mt-3 text-sm font-black text-slate-800 dark:text-slate-200">No payment receipts in this range</h3>
                <p className="mt-1 text-xs text-slate-400">Collect payment from any finalized patient invoice.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => {
                  const m = String(r.method || '').toLowerCase();
                  const isUpi = m.includes('upi');
                  const isCash = m.includes('cash');
                  const isCard = m.includes('card');

                  return (
                    <article
                      key={r.id}
                      className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-[#0a7f8b] hover:shadow-lg hover:-translate-y-0.5 transition-all dark:bg-slate-850 dark:border-slate-800"
                    >
                      <div>
                        {/* Top: Receipt # & Mode Badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">
                            {r.paymentNo}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-black ${
                            isUpi ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300' :
                            isCash ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            isCard ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {formatPaymentMethod(r.method)}
                          </span>
                        </div>

                        {/* Patient */}
                        <div className="mt-3.5 flex items-center gap-3">
                          <PatientAvatar
                            patient={{ id: r.patientId, fullName: r.patientName }}
                            size={44}
                            className="rounded-2xl ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <Link to={`/patients/${r.patientId}`} className="truncate text-sm font-black text-slate-900 group-hover:text-[#0a7f8b] dark:text-white transition-colors block">
                              {r.patientName}
                            </Link>
                            <p className="font-mono text-[11px] font-bold text-slate-400">
                              {r.patientNo} {r.mobile ? `· ${r.mobile}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Financial Card Details */}
                        <div className="mt-3.5 space-y-1.5 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Invoice:</span>
                            <Link to={`/invoices/${r.invoiceId}`} className="font-mono font-bold text-[#0a7f8b] hover:underline">
                              {r.invoiceNo}
                            </Link>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Time:</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {formatDateTime(r.paymentDate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5 dark:border-slate-700">
                            <span className="text-[11px] font-black uppercase text-slate-500">Collected:</span>
                            <span className={`text-sm font-black tabular-nums ${r.status === 'void' ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {formatMoney(r.amount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">
                          by {r.recordedByName || 'Staff'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {has('refunds.manage') && r.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => { setVoidTarget(r); setVoidReason(''); setVoidError(null); }}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Void payment"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => printReceipt(r)}
                            className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-2.5 py-1 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 transition shadow-2xs"
                          >
                            <ReceiptText size={12} />
                            Receipt PDF
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            <DataTable
              columns={paymentColumns}
              rows={rows}
              loading={payments.isLoading}
              error={payments.error}
              onRetry={payments.refetch}
              emptyTitle="No payments in this range"
              emptyMessage="Collect a payment from a finalized invoice."
            />
          )
        ) : (
          <DataTable
            columns={refundColumns}
            rows={refundRows}
            loading={refunds.isLoading}
            error={refunds.error}
            onRetry={refunds.refetch}
            emptyTitle="No refunds in this range"
            emptyMessage="Refunds are issued from an invoice page."
          />
        )}
      </div>

      <Modal
        open={Boolean(voidTarget)}
        onClose={() => !voidBusy && setVoidTarget(null)}
        title={voidTarget ? `Void payment ${voidTarget.paymentNo}` : 'Void payment'}
        subtitle={voidTarget ? `${formatMoney(voidTarget.amount)} · ${formatPaymentMethod(voidTarget.method)} · ${formatDate(voidTarget.paymentDate)}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidTarget(null)} disabled={voidBusy}>Cancel</Button>
            <Button variant="danger" icon={Ban} onClick={submitVoid} loading={voidBusy}>Void payment</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Voiding reverses this payment from the invoice balance. The payment remains in the ledger with its reason for audit.
        </p>
        <Textarea label="Reason" required rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why is this payment being voided?" />
        {voidError && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {voidError}
          </div>
        )}
      </Modal>
    </div>
  );
}
