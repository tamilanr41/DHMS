import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Trash2, Save, Lock, AlertTriangle, ArrowLeft, ReceiptText,
  Percent, FileText, CheckCircle2, Sparkles, UserCheck, ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useClinic } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatMoney, todayISO } from '../../utils/format.js';
import { fromPaise, linePaise, totalsPaise } from '../../utils/money.js';
import { PageLoader, ErrorState } from '../../components/ui/States.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const newLine = () => ({ treatmentId: '', description: '', toothNumber: '', quantity: '1', unitPrice: '', discount: '' });

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const clinic = useClinic();

  const [patient, setPatient] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [taxPercent, setTaxPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [taxTouched, setTaxTouched] = useState(false);

  const planId = params.get('fromPlan');
  const patientId = params.get('patientId');
  const canDiscount = ['dentist', 'admin'].includes(user.role);

  const treatments = useQuery({
    queryKey: ['treatments'],
    queryFn: async () => (await api.get('/treatments')).data,
    staleTime: 5 * 60_000
  });

  const plan = useQuery({
    queryKey: ['treatment-plan', planId],
    queryFn: async () => (await api.get(`/treatment-plans/${planId}`)).data,
    enabled: Boolean(planId)
  });

  useEffect(() => {
    if (clinic.data && !taxTouched) {
      setTaxPercent(String(clinic.data.taxEnabled ? Number(clinic.data.taxPercent) : 0));
    }
  }, [clinic.data, taxTouched]);

  useEffect(() => {
    if (!planId || !plan.data) return;
    setPatient(plan.data.patient);
    const prefilled = (plan.data.items || [])
      .filter((i) => i.status !== 'cancelled')
      .map((i) => ({
        treatmentId: i.treatmentId || '',
        description: i.treatmentName,
        toothNumber: i.toothNumber || '',
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount || 0)
      }));
    if (prefilled.length) setLines(prefilled);
  }, [planId, plan.data]);

  useEffect(() => {
    if (planId || !patientId) return;
    api.get(`/patients/${patientId}`)
      .then((res) => setPatient(res.data))
      .catch((err) => setError(err.message));
  }, [planId, patientId]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const t of treatments.data || []) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category).push(t);
    }
    return [...map.entries()];
  }, [treatments.data]);

  const parsedLines = lines.map((l) => ({
    ...l,
    quantityNum: Number(l.quantity || 0),
    unitPriceNum: Number(l.unitPrice || 0),
    discountNum: Number(l.discount || 0)
  }));
  const totals = totalsPaise(parsedLines, Number(taxPercent || 0));

  const setLine = (idx, patch) => setLines((list) => list.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx) => setLines((list) => (list.length === 1 ? [newLine()] : list.filter((_, i) => i !== idx)));

  const onTreatmentChange = (idx, value) => {
    const treatment = (treatments.data || []).find((t) => t.id === value);
    if (!treatment) {
      setLine(idx, { treatmentId: '', description: '' });
      return;
    }
    setLine(idx, {
      treatmentId: treatment.id,
      description: treatment.name,
      unitPrice: String(treatment.defaultPrice ?? ''),
      discount: canDiscount ? lines[idx].discount : ''
    });
  };

  const submit = async (finalize) => {
    setError(null);
    if (!patient?.id) return setError('Select a patient for this invoice.');
    const items = parsedLines.filter((l) => l.description.trim());
    if (!items.length) return setError('Add at least one line item with a description.');
    if (items.some((l) => !l.quantityNum || l.quantityNum <= 0)) return setError('Every line needs a quantity greater than zero.');
    if (items.some((l) => l.unitPriceNum < 0)) return setError('Unit price cannot be negative.');
    if (items.some((l) => l.discountNum > l.quantityNum * l.unitPriceNum)) return setError('A line discount cannot exceed its amount.');
    if (items.some((l) => l.discountNum > 0) && !canDiscount) return setError('Discounts require dentist or administrator authorization.');

    setSaving(true);
    try {
      const res = await api.post('/invoices', {
        patientId: patient.id,
        invoiceDate,
        notes: notes || null,
        taxPercent: Number(taxPercent || 0),
        finalize: Boolean(finalize),
        items: items.map((l) => ({
          treatmentId: l.treatmentId || null,
          description: l.description.trim(),
          toothNumber: l.toothNumber ? String(l.toothNumber).trim() : null,
          quantity: l.quantityNum,
          unitPrice: l.unitPriceNum,
          discount: l.discountNum || 0
        }))
      });
      toast.success(`Invoice ${res.data.invoiceNo} ${finalize ? 'finalized' : 'saved as draft'}`);
      navigate(`/invoices/${res.data.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (planId && plan.isLoading) return <PageLoader label="Loading treatment plan…" />;
  if (planId && plan.error) return <ErrorState error={plan.error} onRetry={plan.refetch} />;

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
              NEW PATIENT INVOICE
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {planId && plan.data ? `Invoice from Plan #${plan.data.planNo}` : 'Issue Dental Treatment Invoice'}
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              {planId && plan.data
                ? `Pre-filled from approved dental care plan for ${plan.data.patient?.fullName || 'patient'}. Review procedures, teeth codes, and finalize.`
                : 'Select patient, attach dental procedures, specify affected teeth, apply clinic tax or authorized discounts, and issue tax invoice.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-black text-white hover:bg-white/25 backdrop-blur-sm transition border border-white/20 cursor-pointer shadow-xs"
          >
            <ArrowLeft size={15} />
            Back to Invoices
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2 Columns: Patient, Line Items, Notes */}
        <div className="space-y-5 xl:col-span-2">
          {/* Card 1: Patient & Context */}
          <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <UserCheck size={14} className="text-[#0a7f8b]" />
                Patient &amp; Billing Profile
              </span>
              {patient && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-black text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  Patient Selected: {patient.fullName || patient.name}
                </span>
              )}
            </div>

            <div className="space-y-4">
              <PatientPicker
                value={patient}
                onChange={setPatient}
                required
                hint="Select existing patient from the clinic register or create a new profile."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    max={todayISO()}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Tax Percent (%)</span>
                    <span className="text-[10.5px] font-medium text-slate-400">
                      {clinic.data?.taxEnabled ? `Default: ${clinic.data.taxPercent}%` : 'Tax disabled'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxPercent}
                      onChange={(e) => { setTaxTouched(true); setTaxPercent(e.target.value); }}
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-semibold text-slate-800 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                    <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Dental Procedure Line Items */}
          <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ReceiptText size={16} className="text-[#0a7f8b]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Dental Procedures &amp; Fee Breakdown
                </h3>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-black text-[#0a7f8b] border border-teal-200/60 dark:bg-teal-950/60">
                  {parsedLines.length} item{parsedLines.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLines((l) => [...l, newLine()])}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 transition shadow-2xs cursor-pointer"
              >
                <Plus size={14} className="stroke-[2.5]" />
                Add Procedure
              </button>
            </div>

            <div className="space-y-3">
              {parsedLines.map((line, idx) => {
                const lineTotal = linePaise(line.quantityNum, line.unitPriceNum, line.discountNum);
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 hover:border-teal-300 transition-colors dark:bg-slate-850 dark:border-slate-800 space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12 items-start">
                      {/* Procedure Selector & Description */}
                      <div className="md:col-span-5 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Treatment / Service
                        </label>
                        <select
                          value={line.treatmentId}
                          onChange={(e) => onTreatmentChange(idx, e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        >
                          <option value="">Custom Dental Procedure…</option>
                          {grouped.map(([category, list]) => (
                            <optgroup key={category} label={category}>
                              {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <input
                          value={line.description}
                          onChange={(e) => setLine(idx, { description: e.target.value })}
                          placeholder="Description printed on final invoice"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          aria-label={`Description for line ${idx + 1}`}
                        />
                      </div>

                      {/* Tooth Number */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Tooth #
                        </label>
                        <input
                          value={line.toothNumber}
                          maxLength={3}
                          placeholder="e.g. 18 / 36"
                          onChange={(e) => setLine(idx, { toothNumber: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold font-mono text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white text-center"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-1 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => setLine(idx, { quantity: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white text-center"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Unit Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          placeholder="0.00"
                          onChange={(e) => setLine(idx, { unitPrice: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold tabular-nums text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right"
                        />
                      </div>

                      {/* Line Discount */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Disc. (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.discount}
                          disabled={!canDiscount}
                          title={!canDiscount ? 'Discounts require dentist or administrator authorization' : undefined}
                          onChange={(e) => setLine(idx, { discount: e.target.value })}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold tabular-nums text-amber-700 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-amber-400 text-right disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Bottom Row of Line: Line Total & Delete */}
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 dark:border-slate-700/60">
                      <div className="text-[11px] text-slate-400 font-medium">
                        {line.toothNumber ? `Tooth #${line.toothNumber} · ` : ''}
                        {line.quantityNum > 1 ? `${line.quantityNum} × ${formatMoney(line.unitPriceNum)}` : ''}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1.5">Net Line:</span>
                          <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                            {formatMoney(fromPaise(lineTotal))}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={lines.length === 1}
                          onClick={() => removeLine(idx)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 dark:hover:bg-rose-950/40"
                          aria-label={`Remove line ${idx + 1}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Totals are recalculating dynamically and verified on the server. {canDiscount ? 'Discounts are recorded per procedure line.' : 'Discounts require clinical administrator clearance.'}
            </p>
          </div>

          {/* Card 3: Notes & Instructions */}
          <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
            <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Invoice Remarks &amp; Payment Terms
            </h3>
            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tooth #36 RCT completed. Crown placement due in 7 days. UPI / Card payments accepted at reception."
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>

        {/* Right 1 Column: Financial Checkout & Summary */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-3xl border border-teal-100/90 bg-gradient-to-b from-white via-teal-50/20 to-teal-50/50 p-6 shadow-md backdrop-blur-xl dark:border-teal-900/50 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-teal-100 pb-3 dark:border-slate-800">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <ReceiptText size={15} className="text-[#0a7f8b]" />
                Financial Breakdown
              </span>
              <span className="rounded-full bg-teal-100/80 px-2 py-0.5 text-[10px] font-black text-[#0a7f8b] dark:bg-teal-950/80 dark:text-teal-300">
                Auto-Calc
              </span>
            </div>

            <dl className="space-y-2.5 text-xs font-semibold">
              <div className="flex justify-between">
                <dt className="text-slate-500">Gross Subtotal</dt>
                <dd className="tabular-nums text-slate-900 dark:text-white font-bold">{formatMoney(fromPaise(totals.subtotal))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Total Discounts</dt>
                <dd className="tabular-nums text-amber-600 dark:text-amber-400 font-bold">− {formatMoney(fromPaise(totals.discountTotal))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Clinic Tax ({Number(taxPercent || 0).toFixed(2)}%)</dt>
                <dd className="tabular-nums text-slate-900 dark:text-white font-bold">{formatMoney(fromPaise(totals.taxTotal))}</dd>
              </div>
            </dl>

            {/* Total Highlight Box */}
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#0a7f8b] to-[#08636d] p-4 text-white shadow-md shadow-teal-700/25">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-100">Net Invoice Total</span>
                <span className="text-2xl font-black tabular-nums tracking-tight">
                  {formatMoney(fromPaise(totals.total))}
                </span>
              </div>
            </div>

            {/* Lock / Safety Advisory Notice */}
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <Lock size={13} className="mt-0.5 shrink-0 text-[#0a7f8b]" />
              <span>Finalized invoices are locked and generate permanent receipt numbers. Drafts can be amended anytime.</span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => submit(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a7f8b] to-[#08636d] py-3 text-xs font-black text-white hover:opacity-95 shadow-md shadow-teal-700/25 transition disabled:opacity-50 cursor-pointer"
            >
              <Lock size={14} />
              {saving ? 'Processing...' : 'Save & Finalize Invoice'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => submit(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              Save as Draft
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => navigate(-1)}
              className="w-full rounded-2xl py-2.5 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
