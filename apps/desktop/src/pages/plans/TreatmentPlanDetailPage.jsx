import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download, Plus, Trash2, CheckCircle2, XCircle, ReceiptText, ArrowLeft, ClipboardList,
  CircleCheck, Circle, IndianRupee, ListChecks, UserRound, Phone
} from 'lucide-react';
import { api, openBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatMoney, humanize, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Card, StatCard } from '../../components/ui/Card.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { PageLoader, ErrorState, EmptyState } from '../../components/ui/States.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const ITEM_STATUSES = ['proposed', 'accepted', 'in_progress', 'completed', 'cancelled'];

export default function TreatmentPlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [cancelPlanOpen, setCancelPlanOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consents, setConsents] = useState([]);
  const [consentForm, setConsentForm] = useState({ consentType: 'treatment', title: 'Informed consent for proposed treatment', body: '', signerName: '', witnessName: '' });
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);

  const { data: plan, isLoading, error, refetch } = useQuery({
    queryKey: ['treatment-plan', id],
    queryFn: async () => (await api.get(`/treatment-plans/${id}`)).data
  });

  const consentsQuery = useQuery({
    queryKey: ['plan-consents', id],
    queryFn: async () => (await api.get(`/treatment-plans/${id}/consents`)).data
  });

  const catalogQuery = useQuery({
    queryKey: ['treatment-catalog'],
    queryFn: async () => (await api.get('/treatments')).data,
    enabled: addOpen
  });

  const [newItem, setNewItem] = useState({ treatmentId: '', toothNumber: '', quantity: 1, unitPrice: '', discount: 0, description: '' });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['treatment-plan', id] });

  const itemMutation = useMutation({
    mutationFn: ({ itemId, patch }) => api.patch(`/treatment-plans/items/${itemId}`, patch),
    onSuccess: () => {
      invalidate();
      toast.success('Treatment item updated');
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteItem = useMutation({
    mutationFn: (itemId) => api.del(`/treatment-plans/items/${itemId}`),
    onSuccess: () => {
      invalidate();
      toast.success('Item removed');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const addItem = useMutation({
    mutationFn: (payload) => api.post(`/treatment-plans/${id}/items`, payload),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setNewItem({ treatmentId: '', toothNumber: '', quantity: 1, unitPrice: '', discount: 0, description: '' });
      toast.success('Procedure added');
    },
    onError: (err) => toast.error(err.message)
  });

  const planStatus = useMutation({
    mutationFn: (status) => api.patch(`/treatment-plans/${id}`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Plan status updated');
      setCancelPlanOpen(false);
    },
    onError: (err) => toast.error(err.message)
  });

  const consentMutation = useMutation({
    mutationFn: (payload) => api.post(`/treatment-plans/${id}/consents`, payload),
    onSuccess: () => {
      toast.success('Consent recorded');
      setConsentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['plan-consents', id] });
    },
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (!consentOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f2742';
    hasSignatureRef.current = false;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const start = (e) => { drawingRef.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = (e) => { if (!drawingRef.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasSignatureRef.current = true; e.preventDefault(); };
    const end = () => { drawingRef.current = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [consentOpen]);

  const submitConsent = () => {
    if (!consentForm.signerName.trim() || !consentForm.body.trim()) { toast.error('Signer name and consent text are required'); return; }
    if (!hasSignatureRef.current) { toast.error('Please sign before saving'); return; }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    consentMutation.mutate({
      consentType: consentForm.consentType,
      title: consentForm.title,
      body: consentForm.body,
      signerName: consentForm.signerName,
      witnessName: consentForm.witnessName || null,
      signatureDataUrl: dataUrl
    });
  };

  if (isLoading) return <PageLoader label="Loading treatment plan…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const canManage = has('plans.manage');
  const activeItems = plan.items.filter((i) => i.status !== 'cancelled');
  const completed = activeItems.filter((i) => i.status === 'completed');
  const inProgress = activeItems.filter((i) => i.status === 'in_progress');
  const completedTotal = completed.reduce((s, i) => s + Number(i.total), 0);
  const remainingTotal = Math.max(0, Number(plan.estimate) - completedTotal);
  const progress = activeItems.length ? Math.round((completed.length / activeItems.length) * 100) : 0;
  const canEditItems = canManage && plan.status !== 'cancelled';
  const catalog = catalogQuery.data || [];

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* ── Doccure Dental Executive Plan Header ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a7f8b] via-[#0e95a3] to-[#14b8c8] p-6 text-white shadow-[0_20px_50px_-20px_rgba(10,127,139,0.35)]">
        <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-25">
          <img src={heroTooth} alt="" className="h-56 w-56 object-contain" />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PatientAvatar
              patient={plan.patient}
              size={54}
              className="rounded-2xl shadow-lg ring-2 ring-white/20 shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight">{plan.planNo}</h1>
                <Badge status={plan.status} />
                <span className="rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-mono font-bold text-teal-100 backdrop-blur-sm">
                  {plan.patient?.patientNo}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/90">
                <strong>{plan.patient?.fullName}</strong> · Treating Doctor: Dr. {plan.dentistName} · Created on {formatDate(plan.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/treatment-plans')}
              className="bg-white/15 text-white border-white/20 hover:bg-white/25"
            >
              Back
            </Button>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => openBlob(`/treatment-plans/${id}/pdf`, `${plan.planNo}-estimate.pdf`)}
              className="bg-white/15 text-white border-white/20 hover:bg-white/25"
            >
              Estimate PDF
            </Button>
            {canManage && plan.status === 'proposed' && (
              <Button
                icon={CheckCircle2}
                loading={planStatus.isPending}
                onClick={() => planStatus.mutate('accepted')}
                className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-md"
              >
                Accept Plan
              </Button>
            )}
            {canManage && has('invoices.manage') && plan.status !== 'cancelled' && (
              <Button
                icon={ReceiptText}
                onClick={() => navigate(`/invoices/new?patientId=${plan.patientId}&fromPlan=${plan.id}`)}
                className="bg-white text-[#0a7f8b] hover:bg-slate-50 shadow-md font-black"
              >
                Create Invoice
              </Button>
            )}
            {canEditItems && (
              <Button
                icon={Plus}
                onClick={() => setAddOpen(true)}
                className="bg-white text-[#0a7f8b] hover:bg-slate-50 shadow-md font-black"
              >
                Add Procedure
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards (Matches Waiting Queue Screenshot 1:1) ────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="TOTAL PROCEDURES"
          value={activeItems.length}
          subtitle="items planned"
          icon={ListChecks}
          variant="teal"
        />
        <DoccureKpiCard
          title="IN PROGRESS"
          value={inProgress.length}
          subtitle="active in chair"
          icon={Clock3}
          variant="amber"
        />
        <DoccureKpiCard
          title="COMPLETED CARE"
          value={completed.length}
          subtitle={`${progress}% finished`}
          icon={CheckCircle2}
          variant="emerald"
        />
        <DoccureKpiCard
          title="PLAN ESTIMATE"
          value={formatMoney(plan.estimate)}
          subtitle="total case value"
          icon={IndianRupee}
          variant="purple"
          hasDot={true}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_308px]">
        <div className="min-w-0 space-y-4">
          <Card
            title="Procedures"
            subtitle="Proposed treatment is tracked separately from completed treatment."
            noBody
            actions={canEditItems && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddOpen(true)}>Add procedure</Button>
            )}
          >
            <div className="border-b border-line/80 px-4 py-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-600">{completed.length} of {activeItems.length} completed</span>
                <span className="font-semibold tabular-nums text-navy">{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: `${progress}%` }} />
              </div>
            </div>

            {plan.items.length === 0 ? (
              <EmptyState
                title="No procedures yet"
                message="Add the first procedure to begin building this treatment plan."
                icon={ClipboardList}
                action={canEditItems ? <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddOpen(true)}>Add procedure</Button> : null}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="table-head">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Treatment</th>
                      <th className="px-4 py-2.5 text-center">Tooth</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">Completed</th>
                      {canManage && <th className="px-4 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((item) => (
                      <tr key={item.id} className={`border-t border-line/80 transition-colors hover:bg-slate-50/60 ${item.status === 'cancelled' ? 'opacity-60' : ''}`}>
                        <td className="table-cell">
                          <p className="font-medium text-ink">{item.treatmentName} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Phase {item.phase || 1}</span></p>
                          {item.description && <p className="mt-0.5 line-clamp-1 max-w-[320px] text-[11px] text-slate-500">{item.description}</p>}
                          {item.notes && <p className="mt-0.5 text-[10.5px] italic text-slate-400">{item.notes}</p>}
                        </td>
                        <td className="table-cell text-center">
                          {item.toothNumber ? (
                            <span className="inline-flex min-w-7 justify-center rounded border border-line bg-slate-50 px-1 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{item.toothNumber}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="table-cell text-right">
                          <p className="font-medium tabular-nums text-ink">{formatMoney(item.total)}</p>
                          <p className="text-[10px] tabular-nums text-slate-400">
                            {Number(item.quantity)} × {formatMoney(item.unitPrice)}
                            {Number(item.discount) > 0 ? ` − ${formatMoney(item.discount)}` : ''}
                          </p>
                        </td>
                        <td className="table-cell">
                          {canEditItems && ['proposed', 'accepted', 'in_progress'].includes(item.status) ? (
                            <select
                              value={item.status}
                              onChange={(e) => itemMutation.mutate({ itemId: item.id, patch: { status: e.target.value } })}
                              className="h-7 rounded-md border border-line bg-white px-1.5 text-[11px] font-medium text-slate-600 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                              aria-label={`Status for ${item.treatmentName}`}
                            >
                              {ITEM_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                            </select>
                          ) : (
                            <Badge status={item.status} />
                          )}
                        </td>
                        <td className="table-cell whitespace-nowrap text-[11px] text-slate-500">
                          {item.completedAt ? (
                            <span className="inline-flex items-center gap-1"><CircleCheck size={12} className="text-emerald-500" />{formatDate(item.completedAt)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400"><Circle size={12} />Not completed</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="table-cell text-right">
                            {['proposed', 'accepted'].includes(plan.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-700"
                                icon={Trash2}
                                aria-label={`Remove ${item.treatmentName}`}
                                onClick={() => setDeleteTarget(item)}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-slate-50/60">
                      <td colSpan={2} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">Plan estimate</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-navy">{formatMoney(plan.estimate)}</td>
                      <td colSpan={canManage ? 3 : 2} className="px-4 py-2.5 text-right text-[10.5px] text-slate-400">Cancelled items excluded</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {plan.notes && (
            <Card title="Plan notes">
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600">{plan.notes}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <Card title="Plan overview">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-700 ring-1 ring-accent-100">
                <ClipboardList size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[12px] font-semibold text-navy">{plan.planNo}</p>
                <Badge status={plan.status} className="mt-1" />
              </div>
            </div>
            <dl className="mt-3 space-y-2 border-t border-line/70 pt-3 text-[11.5px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Dentist</dt><dd className="font-medium text-ink">{plan.dentistName}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Created</dt><dd className="font-medium text-ink">{formatDate(plan.createdAt)}</dd></div>
              {plan.consultationNo && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Consultation</dt>
                  <dd className="font-mono text-[11px] font-medium text-accent-700">{plan.consultationNo}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Procedures</dt><dd className="font-medium text-ink">{activeItems.length}</dd></div>
            </dl>
          </Card>

          <Card title="Patient">
            <div className="flex items-center gap-3">
              <PatientAvatar patient={plan.patient} size={42} className="rounded-xl shadow-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-navy">{plan.patient?.fullName}</p>
                <p className="text-[10.5px] font-mono text-slate-500">{plan.patient?.patientNo}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-2 border-t border-line/70 pt-3 text-[11.5px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Age / Gender</dt><dd className="font-medium text-ink">{plan.patient?.age != null ? `${plan.patient.age} yrs` : '—'} · {plan.patient?.gender ? humanize(plan.patient.gender) : '—'}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-slate-500">Mobile</dt><dd className="inline-flex items-center gap-1 font-medium text-ink"><Phone size={11} className="text-slate-400" />{plan.patient?.mobile || '—'}</dd></div>
            </dl>
            <Link to={`/patients/${plan.patientId}`} className="link mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium">
              <UserRound size={12} /> Open patient profile
            </Link>
          </Card>

          <Card title="Financial summary">
            <dl className="space-y-2 text-[11.5px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Estimate</dt><dd className="font-semibold tabular-nums text-navy">{formatMoney(plan.estimate)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Completed value</dt><dd className="font-semibold tabular-nums text-emerald-700">{formatMoney(completedTotal)}</dd></div>
              <div className="flex justify-between gap-2 border-t border-line/70 pt-2"><dt className="text-slate-500">Remaining</dt><dd className="font-semibold tabular-nums text-ink">{formatMoney(remainingTotal)}</dd></div>
            </dl>
            {canManage && has('invoices.manage') && plan.status !== 'cancelled' && (
              <Button size="sm" variant="secondary" icon={ReceiptText} className="mt-3 w-full justify-start" onClick={() => navigate(`/invoices/new?patientId=${plan.patientId}&fromPlan=${plan.id}`)}>
                Create invoice from plan
              </Button>
            )}
          </Card>

          <Card title="Lifecycle">
            <p className="text-[11px] leading-relaxed text-slate-500">
              Procedures move from <strong className="font-medium text-slate-600">proposed</strong> to <strong className="font-medium text-slate-600">accepted</strong>, then <strong className="font-medium text-slate-600">in progress</strong> and <strong className="font-medium text-slate-600">completed</strong>. The plan is marked complete automatically when every procedure is completed.
            </p>
            {canManage && plan.status !== 'cancelled' && plan.status !== 'completed' && (
              <Button variant="ghost" className="mt-3 w-full justify-start text-red-700" icon={XCircle} onClick={() => setCancelPlanOpen(true)}>
                Cancel plan
              </Button>
            )}
          </Card>
        
          <Card title="Informed consents" actions={canManage && <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setConsentForm({ consentType: 'treatment', title: 'Informed consent for proposed treatment', body: plan.notes || 'I consent to the proposed dental treatment plan.', signerName: plan.patient?.fullName || '', witnessName: '' }); setConsentOpen(true); }}>Record consent</Button>}>
            {(consentsQuery.data || []).length === 0 ? (
              <EmptyState title="No consents recorded" description="Record patient consent with signature." icon={ClipboardList} />
            ) : (
              <ul className="space-y-2">
                {(consentsQuery.data || []).map((c) => (
                  <li key={c.id} className="rounded-lg border border-line/70 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-ink">{c.title}</p>
                      <Button size="sm" variant="ghost" icon={Download} onClick={() => openBlob('/treatment-plans/consents/' + c.id + '/pdf', 'consent.pdf')}>PDF</Button>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-slate-500">Signed by {c.signerName} · {new Date(c.signedAt).toLocaleString('en-IN')}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

      <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Record informed consent" size="lg"
        footer={<><Button variant="ghost" onClick={() => setConsentOpen(false)}>Cancel</Button><Button onClick={submitConsent} loading={consentMutation.isPending}>Save consent</Button></>}>
        <div className="space-y-3">
          <Select label="Consent type" value={consentForm.consentType} onChange={(e) => setConsentForm({ ...consentForm, consentType: e.target.value })}>
            <option value="treatment">Treatment</option>
            <option value="photo">Photo</option>
            <option value="sedation">Sedation</option>
            <option value="general">General</option>
          </Select>
          <Input label="Title" value={consentForm.title} onChange={(e) => setConsentForm({ ...consentForm, title: e.target.value })} />
          <Textarea label="Consent text" rows={6} value={consentForm.body} onChange={(e) => setConsentForm({ ...consentForm, body: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Signer name" value={consentForm.signerName} onChange={(e) => setConsentForm({ ...consentForm, signerName: e.target.value })} />
            <Input label="Witness" value={consentForm.witnessName} onChange={(e) => setConsentForm({ ...consentForm, witnessName: e.target.value })} />
          </div>
          <div>
            <label className="label-base">Signature</label>
            <canvas ref={canvasRef} width={480} height={160} className="w-full rounded-lg border border-line bg-white touch-none" />
            <Button size="sm" variant="ghost" onClick={() => { const c = canvasRef.current; const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,c.width,c.height); hasSignatureRef.current = false; }}>Clear</Button>
          </div>
        </div>
      </Modal>
</aside>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add procedure"
        subtitle="Add a procedure to this treatment plan. It will start as proposed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              loading={addItem.isPending}
              onClick={() => {
                if (!newItem.treatmentId) return toast.error('Select a treatment');
                const t = catalog.find((c) => c.id === newItem.treatmentId);
                addItem.mutate({
                  treatmentId: newItem.treatmentId,
                  treatmentName: t?.name,
                  toothNumber: newItem.toothNumber || null,
                  description: newItem.description || null,
                  quantity: Number(newItem.quantity || 1),
                  unitPrice: Number(newItem.unitPrice === '' ? t?.defaultPrice : newItem.unitPrice),
                  discount: Number(newItem.discount || 0)
                });
              }}
            >
              Add procedure
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label="Treatment"
            required
            wrapperClass="md:col-span-2"
            value={newItem.treatmentId}
            onChange={(e) => {
              const t = catalog.find((c) => c.id === e.target.value);
              setNewItem((v) => ({ ...v, treatmentId: e.target.value, unitPrice: t ? t.defaultPrice : '' }));
            }}
          >
            <option value="">Select treatment…</option>
            {catalog.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.defaultPrice)}</option>)}
          </Select>
          <Input label="Tooth number" value={newItem.toothNumber} onChange={(e) => setNewItem((v) => ({ ...v, toothNumber: e.target.value.replace(/\D/g, '').slice(0, 2) }))} placeholder="e.g. 36" hint="FDI notation" />
          <Input label="Quantity" type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem((v) => ({ ...v, quantity: e.target.value }))} />
          <Input label="Unit price" type="number" min="0" step="0.01" value={newItem.unitPrice} onChange={(e) => setNewItem((v) => ({ ...v, unitPrice: e.target.value }))} />
          <Input label="Discount" type="number" min="0" step="0.01" value={newItem.discount} onChange={(e) => setNewItem((v) => ({ ...v, discount: e.target.value }))} />
          <Input label="Description" wrapperClass="md:col-span-2" value={newItem.description} onChange={(e) => setNewItem((v) => ({ ...v, description: e.target.value }))} placeholder="Optional clinical description" />
          <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 md:col-span-2">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-slate-500">Procedure total</span>
              <strong className="text-[14px] font-semibold tabular-nums text-navy">
                {formatMoney(Math.max(0, Number(newItem.quantity || 0) * Number(newItem.unitPrice || 0) - Number(newItem.discount || 0)))}
              </strong>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove procedure"
        message={deleteTarget ? `Remove “${deleteTarget.treatmentName}” from this treatment plan? This cannot be undone.` : ''}
        confirmLabel="Remove procedure"
        loading={deleteItem.isPending}
        onConfirm={() => deleteTarget && deleteItem.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={cancelPlanOpen}
        onClose={() => setCancelPlanOpen(false)}
        title="Cancel treatment plan"
        message="The plan will be marked cancelled. Existing clinical and financial records remain available."
        confirmLabel="Cancel plan"
        loading={planStatus.isPending}
        onConfirm={() => planStatus.mutate('cancelled')}
      />
    </div>
  );
}
