import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Printer, ReceiptText, Wallet, Undo2, Lock, Trash2, Ban, ArrowLeft, AlertTriangle, Stethoscope
} from 'lucide-react';
import { api, openBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useClinic } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney, formatPaymentMethod, todayISO, initials } from '../../utils/format.js';
import { newIdempotencyKey } from '../../utils/idempotency.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea, FormRow } from '../../components/ui/Input.jsx';
import { PageLoader, ErrorState, EmptyState } from '../../components/ui/States.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import SmartInvoiceQrCard from '../../components/billing/SmartInvoiceQrCard.jsx';

const FALLBACK_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { has } = useAuth();
  const clinic = useClinic();

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState(null);
  const [confirmReplay, setConfirmReplay] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundForm, setRefundForm] = useState(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState(null);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState(null);
  const [paymentToVoid, setPaymentToVoid] = useState(null);

  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => (await api.get(`/invoices/${id}`)).data
  });

  const methods = clinic.data?.defaultPaymentMethods?.length ? clinic.data.defaultPaymentMethods : FALLBACK_METHODS;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['refunds'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const openPayment = () => {
    setPayError(null);
    setConfirmReplay(false);
    setPayForm({
      amount: String(invoice.outstanding),
      method: methods[0] || 'Cash',
      transactionRef: '',
      date: todayISO(),
      notes: '',
      idempotencyKey: newIdempotencyKey('pay')
    });
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!payForm) return;
    setPayError(null);
    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setPayError('Enter an amount greater than zero.');
    if (amount > Number(invoice.outstanding)) return setPayError(`Amount cannot exceed the outstanding balance of ${formatMoney(invoice.outstanding)}.`);

    setPayBusy(true);
    try {
      const res = await api.post('/payments', {
        invoiceId: id,
        amount,
        method: payForm.method,
        transactionRef: payForm.transactionRef || null,
        paymentDate: new Date(`${payForm.date}T12:00:00`).toISOString(),
        notes: payForm.notes || null,
        idempotencyKey: payForm.idempotencyKey
      });
      toast.success(`${formatMoney(res.data.amount)} collected · ${res.data.paymentNo}`);
      setPayOpen(false);
      invalidate();
    } catch (err) {
      if (err.status === 0) {
        const confirmed = await pollPayment(payForm.idempotencyKey);
        if (confirmed) {
          toast.success(`Payment ${confirmed.paymentNo} was recorded · ${formatMoney(confirmed.amount)}`);
          setPayOpen(false);
          invalidate();
          return;
        }
      }
      setPayError(err.message);
    } finally {
      setPayBusy(false);
    }
  };

  const pollPayment = async (key) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await sleep(700);
      try {
        const res = await api.get(`/payments/status/${encodeURIComponent(key)}`);
        if (res.data) return res.data;
      } catch {
        /* keep trying */
      }
    }
    return null;
  };

  const openRefund = () => {
    setRefundError(null);
    const completed = (invoice.payments || []).filter((p) => p.status === 'completed');
    setRefundForm({
      amount: String(invoice.amountPaid),
      method: methods[0] || 'Cash',
      reason: '',
      paymentId: completed[0]?.id || '',
      idempotencyKey: newIdempotencyKey('ref')
    });
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    if (!refundForm) return;
    setRefundError(null);
    const amount = Number(refundForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setRefundError('Enter a refund amount greater than zero.');
    if (amount > Number(invoice.amountPaid)) return setRefundError(`Refund cannot exceed the collected amount of ${formatMoney(invoice.amountPaid)}.`);
    if ((refundForm.reason || '').trim().length < 3) return setRefundError('A reason is required for the refund.');

    setRefundBusy(true);
    try {
      const res = await api.post('/refunds', {
        invoiceId: id,
        paymentId: refundForm.paymentId || null,
        amount,
        method: refundForm.method,
        reason: refundForm.reason.trim(),
        idempotencyKey: refundForm.idempotencyKey
      });
      toast.success(`Refund ${res.data.refundNo} recorded · ${formatMoney(res.data.amount)}`);
      setRefundOpen(false);
      invalidate();
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setRefundBusy(false);
    }
  };

  const finalize = async () => {
    setFinalizeBusy(true);
    try {
      await api.post(`/invoices/${id}/finalize`, {});
      toast.success('Invoice finalized. It can no longer be edited.');
      setFinalizeOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFinalizeBusy(false);
    }
  };

  const voidInvoice = async () => {
    setVoidError(null);
    if (voidReason.trim().length < 3) return setVoidError('Give a reason of at least 3 characters.');
    setVoidBusy(true);
    try {
      await api.post(`/invoices/${id}/void`, { reason: voidReason.trim() });
      toast.success('Invoice voided');
      setVoidOpen(false);
      setVoidReason('');
      invalidate();
    } catch (err) {
      setVoidError(err.message);
    } finally {
      setVoidBusy(false);
    }
  };

  const deleteDraft = async () => {
    setDeleteBusy(true);
    try {
      await api.del(`/invoices/${id}`);
      toast.success('Draft invoice deleted');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/invoices', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  };

  const voidPayment = async () => {
    if (!paymentToVoid) return;
    setVoidError(null);
    if (voidReason.trim().length < 3) return setVoidError('Give a reason of at least 3 characters.');
    setVoidBusy(true);
    try {
      await api.post(`/payments/${paymentToVoid.id}/void`, { reason: voidReason.trim() });
      toast.success(`Payment ${paymentToVoid.paymentNo} voided`);
      setPaymentToVoid(null);
      setVoidReason('');
      invalidate();
    } catch (err) {
      setVoidError(err.message);
    } finally {
      setVoidBusy(false);
    }
  };

  const print = async (path, fileName) => {
    try {
      await openBlob(path, fileName);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <PageLoader label="Loading invoice…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const refunded = (invoice.refunds || []).reduce((sum, r) => sum + Number(r.amount), 0);
  const paidPercent = Number(invoice.total) > 0 ? Math.min(100, Math.round((Number(invoice.amountPaid) / Number(invoice.total)) * 100)) : 0;
  const canCollect = has('payments.manage') && !['draft', 'void', 'paid'].includes(invoice.status) && Number(invoice.outstanding) > 0;
  const canRefund = has('refunds.manage') && !['draft', 'void'].includes(invoice.status) && Number(invoice.amountPaid) > 0;
  const canVoid = has('invoices.manage') && invoice.status !== 'void' && Number(invoice.amountPaid) === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {invoice.invoiceNo}
            <Badge status={invoice.status} />
          </span>
        }
        subtitle={`${invoice.patientName} · ${formatDate(invoice.invoiceDate)}`}
        breadcrumbs={[{ label: 'Invoices', to: '/invoices' }, { label: invoice.invoiceNo }]}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => print(`/invoices/${id}/pdf`, `${invoice.invoiceNo}.pdf`)}>Invoice PDF</Button>
            {Number(invoice.amountPaid) > 0 && (
              <Button variant="secondary" icon={ReceiptText} onClick={() => print(`/invoices/${id}/receipt.pdf`, `${invoice.invoiceNo}-receipt.pdf`)}>Receipt</Button>
            )}
            {canRefund && <Button variant="secondary" icon={Undo2} onClick={openRefund}>Refund</Button>}
            {canCollect && <Button variant="accent" icon={Wallet} onClick={openPayment}>Collect payment</Button>}
{has('payments.manage') && Number(invoice.creditAvailable) > 0 && Number(invoice.outstanding) > 0 && (
  <Button variant="secondary" onClick={async () => {
    const amt = window.prompt('Apply advance amount', invoice.outstanding);
    if (!amt) return;
    try {
      await api.post('/patient-credits/apply', { invoiceId: id, amount: Number(amt) });
      toast.success('Advance applied');
      invalidate();
    } catch (e) { toast.error(e.message); }
  }}>Apply advance</Button>
)}
{has('invoices.manage') && Number(invoice.outstanding) > 0 && (
  <Button variant="secondary" onClick={async () => {
    const amt = window.prompt('Write-off amount', invoice.outstanding);
    if (!amt) return;
    const reason = window.prompt('Reason for write-off');
    if (!reason) return;
    try {
      await api.post(`/invoices/${id}/adjustments`, { type: 'write_off', amount: Number(amt), reason });
      toast.success('Write-off recorded');
      invalidate();
    } catch (e) { toast.error(e.message); }
  }}>Write off</Button>
)}
{has('claims.manage') && !invoice.claim && !['draft','void'].includes(invoice.status) && (
  <Button variant="secondary" onClick={async () => {
    const provider = window.prompt('Insurance / TPA name', invoice.patient?.insuranceProvider || '');
    if (!provider) return;
    try {
      await api.post('/claims', { invoiceId: id, provider });
      toast.success('Claim created');
      invalidate();
    } catch (e) { toast.error(e.message); }
  }}>Insurance claim</Button>
)}
          </>
        }
      />

      {invoice.status === 'void' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
          <Ban size={15} className="mt-0.5 shrink-0" />
          <span><strong>This invoice is void.</strong> {invoice.voidReason ? `Reason: ${invoice.voidReason}` : 'It remains visible for audit only.'}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card
            title="Line items"
            subtitle={`${invoice.items.length} item${invoice.items.length === 1 ? '' : 's'} · ${invoice.invoiceNo}`}
            noBody
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="table-head">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">Description</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center">Tooth</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Qty</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Unit price</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Discount</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-t border-line/80">
                      <td className="table-cell px-4">
                        <p className="font-medium text-ink">{item.description}</p>
                      </td>
                      <td className="table-cell px-3 text-center">
                        {item.toothNumber ? (
                          <span className="inline-flex min-w-7 justify-center rounded border border-line bg-slate-50 px-1 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{item.toothNumber}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="table-cell px-3 text-right tabular-nums">{Number(item.quantity)}</td>
                      <td className="table-cell px-3 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                      <td className="table-cell px-3 text-right tabular-nums text-slate-500">{formatMoney(item.discount)}</td>
                      <td className="table-cell px-4 text-right font-semibold tabular-nums text-navy">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-slate-50/60">
                    <td colSpan={5} className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">Invoice total</td>
                    <td className="px-4 py-2.5 text-right text-[15px] font-semibold tabular-nums text-navy">{formatMoney(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card
            title="Payments"
            subtitle={`${(invoice.payments || []).length} payment${(invoice.payments || []).length === 1 ? '' : 's'} recorded`}
            noBody
          >
            {(invoice.payments || []).length === 0 ? (
              <EmptyState title="No payments yet" message="Collect a payment against this invoice to record it here." icon={Wallet} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="table-head">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2.5 text-left">Payment</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Date</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Method</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Reference</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right">Amount</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Status</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="table-cell px-4">
                          <p className="font-medium text-ink">{p.paymentNo}</p>
                          <p className="text-xs text-slate-500">{p.recordedByName || '—'}</p>
                        </td>
                        <td className="table-cell px-3">{formatDateTime(p.paymentDate)}</td>
                        <td className="table-cell px-3">{formatPaymentMethod(p.method)}</td>
                        <td className="table-cell px-3">{p.transactionRef || '—'}</td>
                        <td className="table-cell px-3 text-right font-medium">{formatMoney(p.amount)}</td>
                        <td className="table-cell px-3"><Badge status={p.status} /></td>
                        <td className="table-cell px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" icon={ReceiptText} onClick={() => print(`/payments/${p.id}/receipt.pdf`, `${p.paymentNo}.pdf`)}>Receipt</Button>
                            {has('refunds.manage') && p.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Ban}
                                onClick={() => { setPaymentToVoid(p); setVoidReason(''); setVoidError(null); }}
                              >
                                Void
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Refunds" subtitle={`${formatMoney(refunded)} refunded in total`} noBody>
            {(invoice.refunds || []).length === 0 ? (
              <EmptyState title="No refunds issued" message="Any refund issued against this invoice will appear here for audit." icon={Undo2} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="table-head">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2.5 text-left">Refund</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Date</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Method</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left">Reason</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.refunds.map((r) => (
                      <tr key={r.id}>
                        <td className="table-cell px-4">
                          <p className="font-medium text-ink">{r.refundNo}</p>
                          <p className="text-xs text-slate-500">{r.refundedByName || '—'}</p>
                        </td>
                        <td className="table-cell px-3">{formatDateTime(r.refundedAt)}</td>
                        <td className="table-cell px-3">{formatPaymentMethod(r.method)}</td>
                        <td className="table-cell px-3">{r.reason}</td>
                        <td className="table-cell px-4 text-right font-medium text-red-700">{formatMoney(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {(invoice.adjustments || []).length > 0 && (
            <Card title="Adjustments" noBody>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="table-head"><tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-left">#</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Type</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Reason</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {(invoice.adjustments || []).map((a) => (
                      <tr key={a.id}>
                        <td className="table-cell px-4">{a.adjustmentNo}</td>
                        <td className="table-cell px-3">{a.type.replace('_', ' ')}</td>
                        <td className="table-cell px-3">{a.reason}</td>
                        <td className="table-cell px-4 text-right font-medium">{formatMoney(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {invoice.claim && (
            <Card title="Insurance claim">
              <p className="text-sm text-slate-700">{invoice.claim.claimNo} · {invoice.claim.provider} · {formatMoney(invoice.claim.claimAmount)} · <Badge status={invoice.claim.status} /></p>
            </Card>
          )}
          {invoice.notes && (
            <Card title="Notes"><p className="whitespace-pre-line text-sm text-slate-700">{invoice.notes}</p></Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <Card title="Payment summary">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Balance due</p>
                <p className={`mt-1 text-[26px] font-semibold leading-none tracking-[-0.02em] ${Number(invoice.outstanding) > 0 ? 'text-navy' : 'text-emerald-700'}`}>
                  {formatMoney(invoice.outstanding)}
                </p>
              </div>
              <Badge status={invoice.status} />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[10.5px] text-slate-500">
                <span>Collected</span>
                <span className="tabular-nums">{paidPercent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${Number(invoice.outstanding) === 0 ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: `${paidPercent}%` }} />
              </div>
            </div>

            <dl className="mt-4 space-y-2 border-t border-line/70 pt-3 text-[11.5px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums text-ink">{formatMoney(invoice.subtotal)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums text-amber-700">− {formatMoney(invoice.discountTotal)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Tax ({Number(invoice.taxPercent).toFixed(2)}%)</dt><dd className="tabular-nums text-ink">{formatMoney(invoice.taxTotal)}</dd></div>
              <div className="flex justify-between gap-2 border-t border-line/70 pt-2"><dt className="font-medium text-slate-600">Invoice total</dt><dd className="font-semibold tabular-nums text-navy">{formatMoney(invoice.total)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Paid</dt><dd className="tabular-nums font-medium text-emerald-700">{formatMoney(invoice.amountPaid)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Refunded</dt><dd className="tabular-nums text-red-700">{formatMoney(refunded)}</dd></div>
              <div className="flex justify-between gap-2 border-t border-line/70 pt-2">
                <dt className="font-medium text-slate-600">Outstanding</dt>
                <dd className={`font-semibold tabular-nums ${Number(invoice.outstanding) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatMoney(invoice.outstanding)}</dd>
              </div>
            </dl>

            {canCollect && (
              <Button variant="accent" icon={Wallet} className="mt-3 w-full" onClick={openPayment}>Collect payment</Button>
            )}
          </Card>

          {/* Dynamic NPCI UPI QR & Google Review 5-Star Card */}
          <SmartInvoiceQrCard
            invoice={invoice}
            clinicName={clinic.data?.name || 'ZhanX Dental Care'}
            upiVpa={clinic.data?.upiVpa || 'zhanxdental@okaxis'}
            googleReviewUrl={clinic.data?.googleReviewUrl || 'https://g.page/r/zhanxdental/review'}
          />

          <Card title="Patient">
            <Link to={`/patients/${invoice.patient?.id}`} className="group flex items-center gap-3">
              <PatientAvatar patient={invoice.patient} size={40} className="rounded-xl shadow-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-navy group-hover:text-accent">{invoice.patient?.fullName}</span>
                <span className="block text-[11px] text-slate-500">{invoice.patient?.patientNo}{invoice.patient?.mobile ? ` · ${invoice.patient.mobile}` : ''}</span>
              </span>
            </Link>
            {invoice.consultationNo && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-line/70 pt-2.5 text-[11px] text-slate-500">
                <Stethoscope size={12} className="text-slate-400" /> Consultation <span className="font-mono text-[10.5px] text-accent-700">{invoice.consultationNo}</span>
              </p>
            )}
          </Card>

          <Card title="Record">
            <dl className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Created by</dt><dd className="text-right font-medium text-slate-700">{invoice.createdByName || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Created</dt><dd className="text-right font-medium text-slate-700">{formatDateTime(invoice.createdAt)}</dd></div>
              {invoice.finalizedAt && <div className="flex justify-between gap-2"><dt className="text-slate-500">Finalized</dt><dd className="text-right font-medium text-slate-700">{formatDateTime(invoice.finalizedAt)}</dd></div>}
              {invoice.voidedAt && <div className="flex justify-between gap-2"><dt className="text-slate-500">Voided</dt><dd className="text-right font-medium text-red-700">{formatDateTime(invoice.voidedAt)}</dd></div>}
            </dl>
            {invoice.voidReason && <p className="mt-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-[10.5px] text-red-700">Reason: {invoice.voidReason}</p>}
          </Card>

          <div className="flex flex-col gap-2">
            {has('invoices.manage') && invoice.status === 'draft' && (
              <>
                <Button icon={Lock} onClick={() => setFinalizeOpen(true)}>Finalize invoice</Button>
                <Button variant="secondary" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete draft</Button>
              </>
            )}
            {canVoid && invoice.status !== 'draft' && (
              <Button variant="danger" icon={Ban} onClick={() => { setVoidReason(''); setVoidError(null); setVoidOpen(true); }}>Void invoice</Button>
            )}
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/invoices')}>Back to invoices</Button>
          </div>
        </aside>
      </div>

      <Modal
        open={payOpen}
        onClose={() => !payBusy && setPayOpen(false)}
        title="Collect payment"
        subtitle={`${invoice.invoiceNo} · outstanding ${formatMoney(invoice.outstanding)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayOpen(false)} disabled={payBusy}>Cancel</Button>
            <Button variant="accent" icon={Wallet} onClick={submitPayment} loading={payBusy}>Record payment</Button>
          </>
        }
      >
        {payForm && (
          <div className="space-y-3">
            <FormRow cols={2}>
              <Input label="Amount" type="number" min="0.01" step="0.01" max={invoice.outstanding} required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              <Select label="Method" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </FormRow>
            <FormRow cols={2}>
              <Input label="Payment date" type="date" value={payForm.date} max={todayISO()} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
              <Input label="Reference" placeholder="UPI / card / cheque reference" value={payForm.transactionRef} onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })} />
            </FormRow>
            <Textarea label="Notes" rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            <p className="text-[11px] text-slate-500">Each payment carries a unique idempotency key, so a retry after a network drop will not double-charge the patient.</p>
            {payError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {payError}
                  {payError.includes('Cannot reach') && (
                    <button type="button" className="ml-1 underline" onClick={async () => {
                      setConfirmReplay(true);
                      const found = await pollPayment(payForm.idempotencyKey);
                      if (found) {
                        toast.success(`Payment ${found.paymentNo} was recorded`);
                        setPayOpen(false);
                        invalidate();
                      } else {
                        setConfirmReplay(false);
                        setPayError('No matching payment found on the server. You can retry safely.');
                      }
                    }}>
                      Check status
                    </button>
                  )}
                </span>
              </div>
            )}
            {confirmReplay && <p className="text-[11px] text-slate-500">Checking whether the earlier attempt reached the server…</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => !refundBusy && setRefundOpen(false)}
        title="Issue refund"
        subtitle={`Collected ${formatMoney(invoice.amountPaid)} · net paid amount`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefundOpen(false)} disabled={refundBusy}>Cancel</Button>
            <Button variant="danger" icon={Undo2} onClick={submitRefund} loading={refundBusy}>Record refund</Button>
          </>
        }
      >
        {refundForm && (
          <div className="space-y-3">
            <FormRow cols={2}>
              <Input label="Refund amount" type="number" min="0.01" step="0.01" max={invoice.amountPaid} required value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })} />
              <Select label="Refund method" value={refundForm.method} onChange={(e) => setRefundForm({ ...refundForm, method: e.target.value })}>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </FormRow>
            <Select label="Against payment (optional)" value={refundForm.paymentId} onChange={(e) => setRefundForm({ ...refundForm, paymentId: e.target.value })}>
              <option value="">General refund against invoice</option>
              {(invoice.payments || []).filter((p) => p.status === 'completed').map((p) => (
                <option key={p.id} value={p.id}>{p.paymentNo} · {formatMoney(p.amount)} · {formatPaymentMethod(p.method)}</option>
              ))}
            </Select>
            <Textarea label="Reason" required rows={3} value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} placeholder="Why is this refund being issued?" />
            <p className="text-[11px] text-slate-500">Refunds reduce the invoice's paid amount and are recorded permanently in the audit trail.</p>
            {refundError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {refundError}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={voidOpen || Boolean(paymentToVoid)}
        onClose={() => { if (!voidBusy) { setVoidOpen(false); setPaymentToVoid(null); } }}
        title={paymentToVoid ? `Void payment ${paymentToVoid.paymentNo}` : 'Void invoice'}
        subtitle={paymentToVoid ? `This reverses ${formatMoney(paymentToVoid.amount)} from the invoice balance.` : 'The invoice stays visible for audit but is cancelled.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setVoidOpen(false); setPaymentToVoid(null); }} disabled={voidBusy}>Cancel</Button>
            <Button variant="danger" icon={Ban} onClick={paymentToVoid ? voidPayment : voidInvoice} loading={voidBusy}>Confirm void</Button>
          </>
        }
      >
        <Textarea label="Reason" required rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason recorded in the audit trail" />
        {voidError && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {voidError}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        onConfirm={finalize}
        loading={finalizeBusy}
        title="Finalize this invoice?"
        message="Finalized invoices cannot be edited or deleted. Corrections must be made by voiding and issuing a new invoice."
        confirmLabel="Finalize"
        tone="primary"
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteDraft}
        loading={deleteBusy}
        title="Delete this draft?"
        message="Only draft invoices can be deleted. This action is audit-logged and cannot be undone."
        confirmLabel="Delete draft"
      />
    </div>
  );
}
