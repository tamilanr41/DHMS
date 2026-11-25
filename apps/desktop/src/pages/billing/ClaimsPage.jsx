import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, CheckCircle2, Clock, AlertTriangle, FileText, IndianRupee } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatMoney, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'partially_approved', label: 'Partially approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'settled', label: 'Settled' }
];

export default function ClaimsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId: '', provider: '', policyNo: '', memberId: '', preAuthNo: '', claimAmount: '', notes: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['claims', status],
    queryFn: async () => (await api.get(`/claims${status ? `?status=${status}` : ''}`)).data
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices-for-claims'],
    queryFn: async () => (await api.get('/invoices?pageSize=300')).data
  });

  const createMut = useMutation({
    mutationFn: async (payload) => (await api.post('/claims', payload)).data,
    onSuccess: () => { toast.success('Claim created'); setOpen(false); qc.invalidateQueries({ queryKey: ['claims'] }); },
    onError: (e) => toast.error(e.message)
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status: next, approvedAmount, patientCopay }) =>
      (await api.post(`/claims/${id}/status`, { status: next, approvedAmount, patientCopay })).data,
    onSuccess: () => { toast.success('Claim updated'); qc.invalidateQueries({ queryKey: ['claims'] }); },
    onError: (e) => toast.error(e.message)
  });

  const rows = data || [];
  const selectableInvoices = (invoices || []).filter((i) => !i.claim && i.status !== 'draft' && i.status !== 'void');

  const summary = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter((r) => r.status === 'submitted').length;
    const approved = rows.filter((r) => ['approved', 'partially_approved'].includes(r.status));
    const approvedAmt = approved.reduce((sum, r) => sum + Number(r.approvedAmount || r.claimAmount || 0), 0);
    const settled = rows.filter((r) => r.status === 'settled').length;
    return { total, submitted, approvedCount: approved.length, approvedAmt, settled };
  }, [rows]);

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const columns = [
    {
      key: 'claimNo',
      label: 'Claim',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-mono text-[11.5px] font-bold text-navy">{r.claimNo}</p>
          <p className="text-[10.5px] text-slate-400 font-medium">{formatDate(r.createdAt)}</p>
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
            size={32}
            className="rounded-xl shadow-xs"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{r.patientName}</p>
            <p className="text-[10.5px] font-mono text-slate-400">{r.provider || 'Direct'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'invoiceNo',
      label: 'Invoice',
      render: (r) => <span className="font-mono text-xs font-semibold text-accent">{r.invoiceNo}</span>
    },
    {
      key: 'provider',
      label: 'TPA / Insurer',
      render: (r) => <span className="text-xs font-medium text-slate-700">{r.provider}</span>
    },
    {
      key: 'claimAmount',
      label: 'Claimed',
      render: (r) => <span className="tabular-nums font-semibold text-slate-700">{formatMoney(r.claimAmount)}</span>
    },
    {
      key: 'approvedAmount',
      label: 'Approved',
      render: (r) => <span className="tabular-nums font-bold text-emerald-700">{formatMoney(r.approvedAmount)}</span>
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.status === 'draft' && <Button size="sm" variant="secondary" onClick={() => statusMut.mutate({ id: r.id, status: 'submitted' })}>Submit</Button>}
          {r.status === 'submitted' && (
            <>
              <Button size="sm" variant="subtle" onClick={() => {
                const amt = window.prompt('Approved amount', r.claimAmount);
                if (amt) statusMut.mutate({ id: r.id, status: 'approved', approvedAmount: Number(amt) });
              }}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => statusMut.mutate({ id: r.id, status: 'rejected' })}>Reject</Button>
            </>
          )}
          {['approved', 'partially_approved'].includes(r.status) && (
            <Button size="sm" variant="primary" onClick={() => statusMut.mutate({ id: r.id, status: 'settled' })}>Settle</Button>
          )}
        </div>
      )
    }
  ];

  const submitCreate = () => {
    const inv = (invoices || []).find((i) => i.id === form.invoiceId);
    createMut.mutate({
      invoiceId: form.invoiceId,
      provider: form.provider || inv?.patient?.insuranceProvider || 'Insurance',
      policyNo: form.policyNo || null,
      memberId: form.memberId || null,
      preAuthNo: form.preAuthNo || null,
      claimAmount: form.claimAmount ? Number(form.claimAmount) : undefined,
      notes: form.notes || null
    });
  };

  return (
    <div className="space-y-4">
      {/* Doccure Dental Signature Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#08636d] p-6 text-white shadow-xl mb-6">
        <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-15 pointer-events-none">
          <img src={heroTooth} alt="" className="h-64 translate-x-12" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-0.5 text-xs font-black tracking-wide text-white backdrop-blur-sm">
              <ShieldCheck size={14} className="stroke-[2.5]" />
              INSURANCE, TPA &amp; REIMBURSEMENTS
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Dental Insurance &amp; Claims Tracker
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Manage pre-authorizations, track approved values, copay splits, and settlement reconciliation with TPAs and dental insurers.
            </p>
          </div>
          {has('claims.manage') && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-[#0a7f8b] shadow-lg hover:bg-teal-50 hover:shadow-xl transition cursor-pointer"
            >
              <Plus size={16} className="stroke-[3]" />
              New Claim
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3.5 text-xs font-bold text-sky-800 shadow-xs dark:bg-sky-950/40 dark:border-sky-900/60 dark:text-sky-300">
        <ShieldCheck size={16} className="shrink-0 text-sky-600 dark:text-sky-400" />
        <span>
          <strong>Manual Tracking Mode:</strong> Track pre-authorizations, policy IDs, insurer approved values, and patient copays internally. Electronic gateway submissions are handled directly with respective insurer/TPA portals.
        </span>
      </div>

      {/* KPI Cards: Strictly Matches Waiting Queue Screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <DoccureKpiCard
          title="TOTAL CLAIMS"
          value={summary.total}
          subtitle="cases lodged"
          icon={FileText}
          variant="teal"
        />
        <DoccureKpiCard
          title="PENDING REVIEW"
          value={summary.submitted}
          subtitle="awaiting TPA"
          icon={Clock}
          variant="amber"
        />
        <DoccureKpiCard
          title="APPROVED VALUE"
          value={formatMoney(summary.approvedAmt)}
          subtitle={`${summary.approvedCount} approved`}
          icon={CheckCircle2}
          variant="emerald"
        />
        <DoccureKpiCard
          title="SETTLED CLAIMS"
          value={summary.settled}
          subtitle="disbursed"
          icon={ShieldCheck}
          variant="purple"
          hasDot
        />
      </div>

      <div className="card-base overflow-hidden border border-line/80 shadow-soft">
        <div className="flex items-center gap-3 border-b border-line/80 bg-slate-50/50 px-4 py-3">
          <span className="text-xs font-semibold text-slate-500">Filter Status:</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-48 text-xs">
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No insurance claims" message="Create an insurance claim from a finalized patient invoice." />
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Insurance / TPA Claim" size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submitCreate} disabled={createMut.isPending || !form.invoiceId}>Submit Claim</Button></>}>
        <div className="space-y-3.5">
          <Select label="Invoice" required value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
            <option value="">Select finalized invoice…</option>
            {selectableInvoices.map((i) => (
              <option key={i.id} value={i.id}>{i.invoiceNo} · {i.patientName} · {formatMoney(i.total)}</option>
            ))}
          </Select>
          <Input label="Insurance Provider / TPA Name" required value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="e.g. Star Health, Medi Assist, ICICI Lombard" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Policy No." value={form.policyNo} onChange={(e) => setForm({ ...form, policyNo: e.target.value })} placeholder="POL-..." />
            <Input label="Member ID / UHID" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} placeholder="MEM-..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Pre-Auth Number" value={form.preAuthNo} onChange={(e) => setForm({ ...form, preAuthNo: e.target.value })} placeholder="AUTH-..." />
            <Input label="Claim Amount (₹)" type="number" value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} placeholder="Default = Invoice total" />
          </div>
          <Textarea label="Clinical Remarks" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Procedure authorization notes or diagnostic codes..." />
        </div>
      </Modal>
    </div>
  );
}
