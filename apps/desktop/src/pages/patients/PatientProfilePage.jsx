import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Mail, MapPin, CalendarPlus, Stethoscope, ReceiptText, Pencil, AlertTriangle, ShieldCheck,
  FileText, Upload, Download, Trash2, Plus, HeartPulse, Wallet, Grid3X3, ClipboardList, Pill, ChevronRight,
  IdCard, Briefcase, Droplet, UserRound, Copy, Check, MessageCircle, CalendarDays, Activity,
  Clock, Landmark, FolderOpen, Image as ImageIcon, ShieldAlert, Sparkles, AlertCircle
} from 'lucide-react';
import { api, openBlob, downloadBlob, ApiError } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney, formatTime, humanize } from '../../utils/format.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Card, StatCard } from '../../components/ui/Card.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import { EmptyState, PageLoader, ErrorState, Spinner } from '../../components/ui/States.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Odontogram from '../../components/Odontogram.jsx';

const TABS = [
  { value: 'overview', label: 'Overview', icon: Activity },
  { value: 'medical', label: 'Medical History', icon: HeartPulse },
  { value: 'chart', label: 'Dental Chart', icon: Grid3X3 },
  { value: 'appointments', label: 'Appointments', icon: CalendarDays },
  { value: 'consultations', label: 'Consultations', icon: Stethoscope },
  { value: 'plans', label: 'Treatment Plans', icon: ClipboardList },
  { value: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { value: 'invoices', label: 'Invoices', icon: ReceiptText },
  { value: 'payments', label: 'Payments', icon: Wallet },
  { value: 'ledger', label: 'Ledger & Advance', icon: Landmark },
  { value: 'communications', label: 'Communication', icon: MessageCircle },
  { value: 'photos', label: 'Clinical Photos', icon: ImageIcon },
  { value: 'documents', label: 'Documents & ID', icon: FolderOpen }
];

const EMPTY_MEDICAL = {
  conditions: '', allergies: '', medications: '', surgicalHistory: '', dentalHistory: '',
  previousTreatments: '', clinicianNotes: '', consentConfirmed: false
};

const TIMELINE_DOT = {
  appointment: 'bg-accent',
  consultation: 'bg-emerald-500',
  invoice: 'bg-amber-500',
  payment: 'bg-teal-500'
};

export default function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { has } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const [copiedId, setCopiedId] = useState(false);

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data
  });

  if (patientQuery.isLoading) return <PageLoader label="Loading patient record…" />;
  if (patientQuery.error) return <ErrorState error={patientQuery.error} onRetry={patientQuery.refetch} />;

  const p = patientQuery.data;

  const copyPatientNo = () => {
    if (p.patientNo) {
      navigator.clipboard.writeText(p.patientNo);
      setCopiedId(true);
      toast.success(`Patient ID ${p.patientNo} copied`);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const cleanMobile = (p.mobile || '').replace(/\D/g, '');
  const waLink = cleanMobile ? `https://wa.me/${cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile}` : null;

  const alerts = [
    p.allergies && { kind: 'Allergy', value: p.allergies },
    p.conditions && { kind: 'Medical Alert', value: p.conditions }
  ].filter(Boolean);

  return (
    <div className="animate-fade-in space-y-5 pb-12">
      {/* Executive Dental Patient Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-r from-[#075964] via-[#0a7f8b] to-[#14b8c8] p-6 sm:p-7 text-white shadow-[0_20px_50px_-20px_rgba(10,127,139,0.5)] backdrop-blur-xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl"
        />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          {/* Left Avatar & Identity */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0">
              <PatientAvatar
                patient={p}
                size={80}
                className="!rounded-2xl shadow-lg ring-2 ring-white/30"
                ring={false}
              />
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-navy-900 ${
                  p.isActive ? 'bg-emerald-400' : 'bg-slate-400'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight text-white">{p.fullName}</h1>
                <Badge tone={p.isActive ? 'success' : 'neutral'} dot>
                  {p.isActive ? 'Active Care' : 'Inactive'}
                </Badge>
              </div>

              {/* Patient ID and quick info row */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-300">
                <button
                  type="button"
                  onClick={copyPatientNo}
                  title="Click to copy Patient ID"
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11.5px] font-bold text-accent-200 transition hover:bg-white/20"
                >
                  <span>{p.patientNo}</span>
                  {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>

                <span>·</span>
                <span>{p.age != null ? `${p.age} yrs` : 'Age N/A'}</span>
                <span>·</span>
                <span>{p.gender ? humanize(p.gender) : 'Gender N/A'}</span>

                {p.bloodGroup && p.bloodGroup !== 'unknown' && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 rounded bg-rose-500/80 px-1.5 py-0.2 font-bold text-white shadow-sm">
                      <Droplet size={11} /> {p.bloodGroup}
                    </span>
                  </>
                )}

                {p.occupation && (
                  <>
                    <span>·</span>
                    <span className="truncate">{p.occupation}</span>
                  </>
                )}
              </div>

              {/* Contact row with WhatsApp */}
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] text-slate-300">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Phone size={13} className="text-accent-300" />
                  {p.mobile}
                </span>

                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/30"
                  >
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                )}

                {p.email && (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Mail size={13} className="text-slate-400" />
                    {p.email}
                  </span>
                )}

                {p.city && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <MapPin size={13} className="text-slate-400" />
                    {p.city}{p.state ? `, ${p.state}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 lg:self-center">
            {has('appointments.manage') && (
              <Button
                variant="secondary"
                icon={CalendarPlus}
                onClick={() => navigate(`/appointments?new=1&patientId=${id}`)}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Appointment
              </Button>
            )}
            {has('consultations.manage') && (
              <Button
                variant="secondary"
                icon={Stethoscope}
                onClick={() => navigate(`/consultations?new=1&patientId=${id}`)}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Consultation
              </Button>
            )}
            {has('invoices.manage') && (
              <Button
                icon={ReceiptText}
                onClick={() => navigate(`/invoices/new?patientId=${id}`)}
                className="bg-accent hover:bg-accent-600 text-white"
              >
                Create Invoice
              </Button>
            )}
            {has('patients.edit') && (
              <Button
                variant="ghost"
                icon={Pencil}
                onClick={() => navigate(`/patients/${id}/edit`)}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Hero Clinical KPI Metric Rail */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent-300">
              <Stethoscope size={16} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Visits</p>
              <p className="text-sm font-bold text-white">{p.visitCount ?? 0} Recorded</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent-300">
              <CalendarDays size={16} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Treatment</p>
              <p className="text-sm font-bold text-white">{p.lastVisit ? formatDate(p.lastVisit) : 'First Visit'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                Number(p.outstanding) > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              <Wallet size={16} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance Status</p>
              <p
                className={`text-sm font-bold ${
                  Number(p.outstanding) > 0 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {Number(p.outstanding) > 0 ? `${formatMoney(p.outstanding)} Due` : 'Nil (Cleared)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent-300">
              <ShieldCheck size={16} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Insurance & ID</p>
              <p className="text-sm font-bold text-white truncate max-w-[150px]">
                {p.insuranceProvider || (p.idProofType ? `${humanize(p.idProofType)} on file` : 'Direct billing')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Clinical Alert Strip */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-[13px] font-bold text-rose-950">Critical Dental & Medical Alerts</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {alerts.map((a) => (
                  <span
                    key={a.kind}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-rose-800 shadow-sm ring-1 ring-rose-300"
                  >
                    <strong>{a.kind}:</strong> {a.value}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {has('patients.medical.view') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setParams({ tab: 'medical' })}
              className="border-rose-300 text-rose-800 hover:bg-rose-100"
            >
              Update Medical History →
            </Button>
          )}
        </div>
      )}

      {/* Horizontal Scrollable Tabs */}
      <div className="border-b border-line bg-white px-2 rounded-2xl shadow-sm">
        <div className="flex space-x-1 overflow-x-auto py-2 no-scrollbar">
          {TABS.map((t) => {
            const active = tab === t.value;
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setParams({ tab: t.value }, { replace: true })}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-all ${
                  active
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900'
                }`}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Views */}
      <div className="min-h-[420px]">
        {tab === 'overview' && <OverviewTab patient={p} onOpenTab={(t) => setParams({ tab: t })} />}
        {tab === 'medical' && <MedicalTab patient={p} />}
        {tab === 'chart' && <Odontogram patientId={id} canEdit={has('chart.edit')} />}
        {tab === 'appointments' && <AppointmentsTab patientId={id} />}
        {tab === 'consultations' && <ConsultationsTab patientId={id} />}
        {tab === 'plans' && <PlansTab patientId={id} />}
        {tab === 'prescriptions' && <PrescriptionsTab patientId={id} />}
        {tab === 'invoices' && <InvoicesTab patientId={id} />}
        {tab === 'payments' && <PaymentsTab patientId={id} />}
        {tab === 'ledger' && <LedgerTab patientId={id} />}
        {tab === 'communications' && <CommunicationsTab patientId={id} />}
        {tab === 'photos' && <PhotosTab patientId={id} />}
        {tab === 'documents' && <DocumentsTab patientId={id} />}
      </div>
    </div>
  );
}

function OverviewTab({ patient, onOpenTab }) {
  const { has } = useAuth();
  const timeline = useQuery({
    queryKey: ['patient-timeline', patient.id],
    queryFn: async () => (await api.get(`/patients/${patient.id}/timeline`)).data
  });

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {/* Main Column */}
      <div className="space-y-5 xl:col-span-2">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Visits</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                <Stethoscope size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-navy-900">{patient.visitCount ?? 0}</p>
            <p className="text-[11px] text-slate-500">
              {patient.lastVisit ? `Last visit: ${formatDate(patient.lastVisit)}` : 'First visit pending'}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding</span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  Number(patient.outstanding) > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Wallet size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-navy-900">{formatMoney(patient.outstanding)}</p>
            <p className="text-[11px] text-slate-500">
              {Number(patient.outstanding) > 0 ? 'Pending invoice payment' : 'All accounts settled'}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Patient Since</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <HeartPulse size={16} />
              </span>
            </div>
            <p className="mt-2 text-lg font-bold text-navy-900">{formatDate(patient.createdAt)}</p>
            <p className="text-[11px] text-slate-500 truncate">
              {patient.referredBy ? `Referred by: ${patient.referredBy}` : 'Direct registration'}
            </p>
          </div>
        </div>

        {/* Contact & Residential Details */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="border-b border-line bg-slate-50/70 px-5 py-3.5">
            <h3 className="text-sm font-bold text-navy-900">Contact & Residential Details</h3>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <Phone size={16} className="mt-0.5 text-accent" />
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Primary Mobile</dt>
                  <dd className="mt-0.5 text-[13px] font-bold text-navy-900">
                    {patient.mobile}
                    {patient.alternateMobile && (
                      <span className="ml-1 text-slate-500 font-normal"> / {patient.alternateMobile}</span>
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail size={16} className="mt-0.5 text-accent" />
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email Address</dt>
                  <dd className="mt-0.5 text-[13px] text-slate-700">{patient.email || '—'}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5 sm:col-span-2">
                <MapPin size={16} className="mt-0.5 text-accent" />
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Address</dt>
                  <dd className="mt-0.5 text-[13px] text-slate-700">
                    {patient.address || '—'}
                    {[patient.city, patient.state, patient.pincode].filter(Boolean).length
                      ? ` · ${[patient.city, patient.state, patient.pincode].filter(Boolean).join(', ')}`
                      : ''}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5 sm:col-span-2 border-t border-slate-100 pt-3">
                <ShieldCheck size={16} className="mt-0.5 text-emerald-600" />
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Emergency Contact</dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-navy-900">
                    {patient.emergencyContactName || 'None recorded'}
                    {patient.emergencyContactRelation && (
                      <span className="text-slate-500 font-normal"> ({patient.emergencyContactRelation})</span>
                    )}
                    {patient.emergencyContactPhone && (
                      <span className="ml-2 font-mono text-accent">· {patient.emergencyContactPhone}</span>
                    )}
                  </dd>
                </div>
              </div>
            </dl>

            {patient.notes && (
              <div className="mt-4 rounded-xl border border-line bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                <span className="font-bold text-navy-900">Front Desk Note:</span> {patient.notes}
              </div>
            )}
          </div>
        </div>

        {/* Identity & Legal Verification Card */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="border-b border-line bg-slate-50/70 px-5 py-3.5">
            <h3 className="text-sm font-bold text-navy-900">Identity & Statutory Verification</h3>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Government ID Proof</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-navy-900">
                  {patient.idProofType ? (
                    <span className="flex items-center gap-1.5">
                      <span>{humanize(patient.idProofType)}</span>
                      {patient.idProofNumber && (
                        <span className="font-mono text-xs text-slate-600">({patient.idProofNumber})</span>
                      )}
                    </span>
                  ) : 'Not on file'}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dental Insurance</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-navy-900">
                  {patient.insuranceProvider
                    ? `${patient.insuranceProvider} ${patient.insurancePolicyNo ? `· ${patient.insurancePolicyNo}` : ''}`
                    : 'Direct payment / No insurance'}
                </dd>
              </div>
            </dl>

            <div
              className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-[12px] font-medium ${
                patient.dataConsent
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <ShieldCheck size={16} />
              <span>
                {patient.dataConsent
                  ? `Patient digital consent confirmed${
                      patient.dataConsentAt ? ` on ${formatDate(patient.dataConsentAt)}` : ''
                    }. Stored securely.`
                  : 'Data storage & dental treatment consent not yet verified.'}
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Activity Timeline */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="border-b border-line bg-slate-50/70 px-5 py-3.5">
            <h3 className="text-sm font-bold text-navy-900">Recent Dental Clinical Timeline</h3>
          </div>
          <div className="p-5">
            {timeline.isLoading ? (
              <div className="py-6 text-center"><Spinner /></div>
            ) : (timeline.data || []).length === 0 ? (
              <EmptyState title="No clinical activity recorded" message="Visits, consultations and procedures will appear here." />
            ) : (
              <ol className="space-y-3.5 border-l-2 border-line pl-4">
                {(timeline.data || []).slice(0, 8).map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="relative">
                    <span
                      className={`absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        TIMELINE_DOT[item.kind] || 'bg-slate-400'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-navy-900">{item.title}</p>
                      <Badge status={item.status} />
                    </div>
                    <p className="text-[11.5px] text-slate-500">
                      {formatDate(item.occurred_on)}
                      {item.subtitle ? ` · ${item.subtitle}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Quick Clinical Launchpad */}
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Dental Quick Launchpad</h3>
          <div className="space-y-1.5">
            {[
              { label: 'Interactive Dental Chart', tab: 'chart', icon: Grid3X3, perm: 'chart.view', color: 'text-accent' },
              { label: 'Medical History & Allergies', tab: 'medical', icon: HeartPulse, perm: 'patients.medical.view', color: 'text-rose-600' },
              { label: 'Consultation Records', tab: 'consultations', icon: Stethoscope, perm: 'consultations.view', color: 'text-emerald-600' },
              { label: 'Active Treatment Plans', tab: 'plans', icon: ClipboardList, perm: 'plans.view', color: 'text-amber-600' },
              { label: 'Dental Prescriptions', tab: 'prescriptions', icon: Pill, perm: 'prescriptions.view', color: 'text-indigo-600' },
              { label: 'Invoices & Billing', tab: 'invoices', icon: ReceiptText, perm: 'invoices.view', color: 'text-slate-700' },
              { label: 'Ledger & Advance Payments', tab: 'ledger', icon: Landmark, perm: 'payments.view', color: 'text-teal-600' },
              { label: 'Clinical Photos & X-Rays', tab: 'photos', icon: ImageIcon, perm: 'patients.view', color: 'text-sky-600' }
            ]
              .filter((x) => has(x.perm))
              .map((x) => (
                <button
                  key={x.tab}
                  type="button"
                  onClick={() => onOpenTab(x.tab)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line/80 px-3 py-2.5 text-left text-[13px] font-semibold text-navy-900 transition hover:border-accent hover:bg-accent-50/50"
                >
                  <x.icon size={17} className={x.color} />
                  <span className="flex-1">{x.label}</span>
                  <ChevronRight size={14} className="text-slate-300 transition group-hover:text-accent" />
                </button>
              ))}
          </div>
        </div>

        {/* Administrative Details */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Record Details</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
              <dt className="text-slate-500">Patient Number</dt>
              <dd className="font-mono font-bold text-navy-900">{patient.patientNo}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
              <dt className="text-slate-500">Date of Birth</dt>
              <dd className="font-semibold text-slate-800">{formatDate(patient.dob)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
              <dt className="text-slate-500">Registration Date</dt>
              <dd className="font-semibold text-slate-800">{formatDate(patient.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Referred By</dt>
              <dd className="font-semibold text-slate-800">{patient.referredBy || 'Direct'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function MedicalTab({ patient }) {
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_MEDICAL);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['medical-history', patient.id],
    queryFn: async () => (await api.get(`/patients/${patient.id}/medical-history`)).data
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/patients/${patient.id}/medical-history`, payload),
    onSuccess: () => {
      toast.success('Medical history recorded');
      queryClient.invalidateQueries({ queryKey: ['medical-history', patient.id] });
      setOpen(false);
      setForm(EMPTY_MEDICAL);
    },
    onError: (err) => toast.error(err.message)
  });

  const startEdit = () => {
    const c = data?.current || {};
    setForm({
      conditions: c.conditions || '',
      allergies: c.allergies || '',
      medications: c.medications || '',
      surgicalHistory: c.surgicalHistory || '',
      dentalHistory: c.dentalHistory || '',
      previousTreatments: c.previousTreatments || '',
      clinicianNotes: c.clinicianNotes || '',
      consentConfirmed: false
    });
    setOpen(true);
  };

  const fields = [
    ['conditions', 'Existing Medical Conditions'],
    ['allergies', 'Known Drug / Environmental Allergies'],
    ['medications', 'Current Regular Medications'],
    ['surgicalHistory', 'Relevant Surgical History'],
    ['dentalHistory', 'Relevant Past Dental History'],
    ['previousTreatments', 'Previous Dental Treatments (RCT, Extractions)'],
    ['clinicianNotes', 'Clinician Safety & Precaution Notes']
  ];

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const current = data?.current;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line bg-slate-50/70 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Current Medical History & Allergies</h3>
              <p className="text-[11px] text-slate-500">
                {current
                  ? `Recorded ${formatDateTime(current.createdAt)}${
                      current.recordedBy ? ` by ${current.recordedBy}` : ''
                    }`
                  : 'No medical history recorded yet.'}
              </p>
            </div>
            {has('patients.medical.edit') && (
              <Button size="sm" icon={Pencil} onClick={startEdit}>
                {current ? 'Update Version' : 'Record History'}
              </Button>
            )}
          </div>

          <div className="p-5">
            {!current ? (
              <EmptyState
                title="No medical history recorded"
                message="Record allergies, chronic conditions and medications before dental procedures."
              />
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fields.map(([key, label]) => (
                  <div key={key} className={key === 'clinicianNotes' ? 'sm:col-span-2' : ''}>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
                    <dd
                      className={`mt-1 text-sm ${
                        key === 'allergies' && current[key]
                          ? 'font-bold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200'
                          : 'font-medium text-navy-900'
                      }`}
                    >
                      {current[key] || '—'}
                    </dd>
                  </div>
                ))}
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <div
                    className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${
                      current.consentConfirmed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    <ShieldCheck size={16} />
                    {current.consentConfirmed
                      ? `Patient consent confirmed on ${formatDateTime(current.consentConfirmedAt)}`
                      : 'Consent not yet confirmed for this version'}
                  </div>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* Version History */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Audit Version History</h3>
        <ol className="space-y-2">
          {(data?.history || []).map((h) => (
            <li
              key={h.id}
              className={`rounded-xl border p-3 text-xs ${
                h.is_current ? 'border-accent-200 bg-accent-50/50' : 'border-line'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-navy-900">{formatDateTime(h.created_at)}</span>
                {h.is_current && <Badge tone="accent">Current</Badge>}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">By {h.recorded_by_name || 'Staff'}</p>
            </li>
          ))}
          {(data?.history || []).length === 0 && (
            <p className="text-xs text-slate-400">No previous versions.</p>
          )}
        </ol>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record Clinical Medical History"
        subtitle="Saves a new timestamped medical history version. Previous records remain in the audit history."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={mutation.isPending}
              onClick={() => {
                if (!form.consentConfirmed) {
                  toast.error('Confirm patient consent before saving');
                  return;
                }
                mutation.mutate(form);
              }}
            >
              Save Version
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fields.map(([key, label]) => (
            <Textarea
              key={key}
              label={label}
              rows={2}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-line bg-slate-50 p-3">
          <Checkbox
            label="I confirm the patient was asked and consented to recording this medical history."
            checked={form.consentConfirmed}
            onChange={(e) => setForm((f) => ({ ...f, consentConfirmed: e.target.checked }))}
          />
        </div>
      </Modal>
    </div>
  );
}

function AppointmentsTab({ patientId }) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-appointments', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/appointments`)).data
  });

  return (
    <Card title="Appointment History" noBody>
      <SimpleTable
        loading={isLoading}
        error={error}
        retry={refetch}
        rows={data}
        empty="No appointments recorded for this patient."
        columns={[
          { key: 'appointment_no', label: 'Appt No' },
          { key: 'appointment_date', label: 'Date', render: (r) => formatDate(r.appointment_date) },
          { key: 'time', label: 'Slot', render: (r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}` },
          { key: 'dentist_name', label: 'Dentist' },
          { key: 'reason', label: 'Reason / Type', render: (r) => r.reason || humanize(r.appointment_type) },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
        ]}
        onRowClick={(r) => navigate(`/appointments?date=${r.appointment_date}`)}
      />
    </Card>
  );
}

function ConsultationsTab({ patientId }) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-consultations', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/consultations`)).data
  });

  return (
    <Card title="Clinical Consultations & Diagnoses" noBody>
      <SimpleTable
        loading={isLoading}
        error={error}
        retry={refetch}
        rows={data}
        empty="No consultations recorded."
        columns={[
          { key: 'consultation_no', label: 'Consultation No' },
          { key: 'visit_at', label: 'Visit Date', render: (r) => formatDateTime(r.visit_at) },
          { key: 'dentist_name', label: 'Consulting Dentist' },
          {
            key: 'diagnosis',
            label: 'Clinical Findings & Diagnosis',
            render: (r) => <span className="line-clamp-1 block max-w-[340px] font-medium">{r.diagnosis || '—'}</span>
          },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
        ]}
        onRowClick={(r) => navigate(`/consultations/${r.id}`)}
      />
    </Card>
  );
}

function PlansTab({ patientId }) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-plans', patientId],
    queryFn: async () => (await api.get(`/treatment-plans?patientId=${patientId}`)).data
  });

  return (
    <Card title="Dental Treatment Plans" noBody>
      <SimpleTable
        loading={isLoading}
        error={error}
        retry={refetch}
        rows={data}
        empty="No treatment plans found."
        columns={[
          { key: 'planNo', label: 'Plan ID' },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
          { key: 'dentistName', label: 'Treating Dentist' },
          { key: 'itemCount', label: 'Procedures', align: 'center' },
          { key: 'estimate', label: 'Estimated Total', align: 'right', render: (r) => formatMoney(r.estimate) },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
        ]}
        onRowClick={(r) => navigate(`/treatment-plans/${r.id}`)}
      />
    </Card>
  );
}

function PrescriptionsTab({ patientId }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/prescriptions`)).data
  });

  return (
    <Card title="Prescriptions Issued" noBody>
      <SimpleTable
        loading={isLoading}
        error={error}
        retry={refetch}
        rows={data}
        empty="No prescriptions issued."
        columns={[
          { key: 'prescription_no', label: 'Prescription ID' },
          { key: 'prescription_date', label: 'Date', render: (r) => formatDate(r.prescription_date) },
          { key: 'dentist_name', label: 'Prescribing Dentist' },
          { key: 'item_count', label: 'Medicines', align: 'center' },
          {
            key: 'actions',
            label: '',
            align: 'right',
            render: (r) => (
              <Button
                size="sm"
                variant="ghost"
                icon={Download}
                onClick={(e) => {
                  e.stopPropagation();
                  openBlob(`/prescriptions/${r.id}/pdf`, `${r.prescription_no}.pdf`);
                }}
              >
                Download PDF
              </Button>
            )
          }
        ]}
      />
    </Card>
  );
}

function InvoicesTab({ patientId }) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-invoices', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/invoices`)).data
  });

  return (
    <Card title="Treatment Invoices" noBody>
      <SimpleTable
        loading={isLoading}
        error={error}
        retry={refetch}
        rows={data}
        empty="No invoices raised."
        columns={[
          { key: 'invoice_no', label: 'Invoice No' },
          { key: 'invoice_date', label: 'Date', render: (r) => formatDate(r.invoice_date) },
          { key: 'total', label: 'Gross Total', align: 'right', render: (r) => formatMoney(r.total) },
          { key: 'amount_paid', label: 'Amount Paid', align: 'right', render: (r) => formatMoney(r.amount_paid) },
          {
            key: 'outstanding_balance',
            label: 'Balance Due',
            align: 'right',
            render: (r) => (
              <span className={Number(r.outstanding_balance) > 0 ? 'font-bold text-amber-700' : 'text-emerald-700'}>
                {formatMoney(r.outstanding_balance)}
              </span>
            )
          },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
        ]}
        onRowClick={(r) => navigate(`/invoices/${r.id}`)}
      />
    </Card>
  );
}

function PaymentsTab({ patientId }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-payments', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/payments`)).data
  });

  return (
    <Card title="Payment Receipts" noBody>
      <SimpleTable
        loading={isLoading}
        error={error}
        retry={refetch}
        rows={data}
        empty="No payments recorded."
        columns={[
          { key: 'payment_no', label: 'Receipt No' },
          { key: 'payment_date', label: 'Date & Time', render: (r) => formatDateTime(r.payment_date) },
          { key: 'invoice_no', label: 'For Invoice' },
          { key: 'method', label: 'Payment Mode', render: (r) => humanize(r.method) },
          { key: 'amount', label: 'Amount Received', align: 'right', render: (r) => formatMoney(r.amount) },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          {
            key: 'actions',
            label: '',
            align: 'right',
            render: (r) => (
              <Button
                size="sm"
                variant="ghost"
                icon={Download}
                onClick={() => openBlob(`/payments/${r.id}/receipt.pdf`, `${r.payment_no}-receipt.pdf`)}
              >
                Receipt PDF
              </Button>
            )
          }
        ]}
      />
    </Card>
  );
}

function DocumentsTab({ patientId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [category, setCategory] = useState('xray');
  const [notes, setNotes] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/documents`)).data
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new ApiError(400, { error: { message: 'Choose a file to upload' } });
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      if (notes) fd.append('notes', notes);
      return api.upload(`/patients/${patientId}/documents`, fd);
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      if (fileRef.current) fileRef.current.value = '';
      setNotes('');
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (docId) => api.del(`/patients/${patientId}/documents/${docId}`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
      <Card title="Patient Documents, X-Rays & Reports" noBody>
        <SimpleTable
          loading={isLoading}
          error={error}
          retry={refetch}
          rows={data}
          empty="No documents uploaded."
          columns={[
            {
              key: 'file_name',
              label: 'Document',
              render: (r) => (
                <span className="flex items-center gap-2 font-medium">
                  <FileText size={16} className="text-accent" />
                  {r.file_name}
                </span>
              )
            },
            { key: 'category', label: 'Category', render: (r) => humanize(r.category) },
            { key: 'size_bytes', label: 'File Size', render: (r) => `${(Number(r.size_bytes) / 1024).toFixed(0)} KB` },
            { key: 'created_at', label: 'Upload Date', render: (r) => `${formatDate(r.created_at)}` },
            {
              key: 'actions',
              label: '',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Download}
                    onClick={() => downloadBlob(`/patients/${patientId}/documents/${r.id}/download`, r.file_name)}
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    icon={Trash2}
                    onClick={() => {
                      if (window.confirm(`Delete ${r.file_name}? This cannot be undone.`)) deleteMutation.mutate(r.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )
            }
          ]}
        />
      </Card>

      <Card title="Upload Document / X-Ray" subtitle="PDFs, scans and digital radiographs up to 15 MB">
        <div className="space-y-3.5">
          <Input label="Select File" type="file" ref={fileRef} accept="image/*,application/pdf" />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="xray">Dental X-Ray (IOPA / OPG)</option>
            <option value="photo">Clinical Photograph</option>
            <option value="report">Pathology / Blood Report</option>
            <option value="consent">Signed Consent Form</option>
            <option value="id_proof">Government ID Proof</option>
            <option value="other">Other Document</option>
          </Select>
          <Textarea label="Clinical Remarks / Tooth Number" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button className="w-full" icon={Upload} loading={uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
            Upload File
          </Button>
        </div>
      </Card>
    </div>
  );
}

function LedgerTab({ patientId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', method: 'cash', transactionRef: '', notes: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-ledger', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/ledger`)).data
  });

  const advanceMut = useMutation({
    mutationFn: async () => api.post('/patient-credits', {
      patientId, amount: Number(form.amount), method: form.method,
      transactionRef: form.transactionRef || null, notes: form.notes || null,
      idempotencyKey: `adv-${patientId}-${Date.now()}`
    }),
    onSuccess: () => {
      toast.success('Advance payment recorded');
      setAdvanceOpen(false);
      qc.invalidateQueries({ queryKey: ['patient-ledger', patientId] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data || {};
  const s = d.summary || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatMoney(s.totalInvoiced)} tone="navy" />
        <StatCard label="Total Paid" value={formatMoney(s.totalPaid)} tone="success" />
        <StatCard label="Outstanding Balance" value={formatMoney(s.totalOutstanding)} tone={Number(s.totalOutstanding) > 0 ? 'danger' : 'success'} />
        <StatCard label="Advance Available" value={formatMoney(s.totalCreditsAvailable)} tone="aqua" />
      </div>

      <Card
        title="Advance Credit Balances"
        actions={
          <Button size="sm" onClick={() => setAdvanceOpen(true)}><Plus size={14} /> Receive Advance</Button>
        }
        noBody
      >
        <SimpleTable
          rows={d.credits || []}
          empty="No advance credits on file."
          columns={[
            { key: 'credit_no', label: 'Receipt No' },
            { key: 'received_at', label: 'Date', render: (r) => formatDateTime(r.received_at) },
            { key: 'method', label: 'Mode', render: (r) => humanize(r.method) },
            { key: 'amount', label: 'Total Amount', align: 'right', render: (r) => formatMoney(r.amount) },
            { key: 'used_amount', label: 'Consumed', align: 'right', render: (r) => formatMoney(r.used_amount) },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
          ]}
        />
      </Card>

      <Card
        title="Account Financial Statement"
        actions={
          <Button size="sm" variant="ghost" icon={Download} onClick={() => openBlob(`/patients/${patientId}/statement.pdf`, 'statement.pdf')}>
            Download PDF
          </Button>
        }
        noBody
      >
        <SimpleTable
          rows={d.entries || []}
          empty="No ledger transactions recorded."
          columns={[
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'kind', label: 'Transaction Type', render: (r) => humanize(r.kind) },
            { key: 'reference', label: 'Reference / Invoice' },
            { key: 'debit', label: 'Debit (Charges)', align: 'right', render: (r) => r.debit ? formatMoney(r.debit) : '—' },
            { key: 'credit', label: 'Credit (Payments)', align: 'right', render: (r) => r.credit ? formatMoney(r.credit) : '—' },
            { key: 'balance', label: 'Running Balance', align: 'right', render: (r) => formatMoney(r.balance) }
          ]}
        />
      </Card>

      <Modal
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        title="Receive Advance Payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={() => advanceMut.mutate()} disabled={advanceMut.isPending || !form.amount}>
              Record Advance
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Input label="Advance Amount (₹)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select label="Payment Mode" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="upi">UPI / GPay / PhonePe</option>
            <option value="card">Credit / Debit Card</option>
            <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
            <option value="cheque">Cheque</option>
          </Select>
          <Input label="Transaction Reference / Cheque No" value={form.transactionRef} onChange={(e) => setForm({ ...form, transactionRef: e.target.value })} />
          <Textarea label="Notes / Reason for Advance" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function CommunicationsTab({ patientId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ channel: 'phone', direction: 'outbound', purpose: 'general', outcome: 'connected', notes: '', followUpDate: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-comms', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/communications`)).data
  });

  const mut = useMutation({
    mutationFn: async () => api.post(`/patients/${patientId}/communications`, {
      channel: form.channel, direction: form.direction, purpose: form.purpose,
      outcome: form.outcome, notes: form.notes || null,
      followUpDate: form.followUpDate || null
    }),
    onSuccess: () => {
      toast.success('Communication logged');
      qc.invalidateQueries({ queryKey: ['patient-comms', patientId] });
      setForm({ channel: 'phone', direction: 'outbound', purpose: 'general', outcome: 'connected', notes: '', followUpDate: '' });
    },
    onError: (e) => toast.error(e.message)
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
      <Card title="Patient Communication Log" noBody>
        <SimpleTable
          rows={data || []}
          empty="No communications logged."
          columns={[
            { key: 'created_at', label: 'Date & Time', render: (r) => formatDateTime(r.created_at) },
            { key: 'channel', label: 'Channel', render: (r) => humanize(r.channel) },
            { key: 'direction', label: 'Direction', render: (r) => humanize(r.direction) },
            { key: 'purpose', label: 'Purpose', render: (r) => humanize(r.purpose) },
            { key: 'outcome', label: 'Outcome', render: (r) => humanize(r.outcome) },
            { key: 'notes', label: 'Notes', render: (r) => <span className="line-clamp-1">{r.notes || '—'}</span> },
            { key: 'follow_up_date', label: 'Follow-up Date', render: (r) => r.follow_up_date ? formatDate(r.follow_up_date) : '—' }
          ]}
        />
      </Card>

      <Card title="Log Communication" subtitle="Track calls, WhatsApp messages & follow-ups">
        <div className="space-y-3.5">
          <Select label="Communication Channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option value="phone">Phone Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="in_person">In Clinic / Front Desk</option>
          </Select>
          <Select label="Direction" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="outbound">Outbound (Clinic called Patient)</option>
            <option value="inbound">Inbound (Patient called Clinic)</option>
          </Select>
          <Select label="Purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
            <option value="appointment">Appointment Booking</option>
            <option value="reminder">Visit Reminder</option>
            <option value="follow_up">Post-Procedure Follow-up</option>
            <option value="recall">6-Month Dental Recall</option>
            <option value="payment">Payment & Balance Follow-up</option>
            <option value="general">General Inquiry</option>
          </Select>
          <Select label="Outcome" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
            <option value="connected">Connected & Confirmed</option>
            <option value="no_answer">No Answer / Ringing</option>
            <option value="busy">Busy / Call Later</option>
            <option value="callback_requested">Callback Requested</option>
            <option value="message_sent">Message Delivered</option>
          </Select>
          <Input label="Scheduled Follow-up Date" type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
          <Textarea label="Conversation Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>
            Log Communication
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PhotoImage({ patientId, photoId }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    api.blob('/patients/' + patientId + '/photos/' + photoId + '/file').then((b) => {
      if (alive) setUrl(URL.createObjectURL(b));
    }).catch(() => {});
    return () => { alive = false; };
  }, [patientId, photoId]);

  if (!url) return <div className="h-44 w-full animate-pulse bg-slate-100" />;
  return <img src={url} alt="Clinical photograph" className="h-44 w-full object-cover" />;
}

function PhotosTab({ patientId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [photoType, setPhotoType] = useState('intraoral');
  const [toothNumber, setToothNumber] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-photos', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/photos`)).data
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a photo to upload');
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('photoType', photoType);
      if (toothNumber) fd.append('toothNumber', toothNumber);
      if (takenAt) fd.append('takenAt', takenAt);
      if (notes) fd.append('notes', notes);
      return api.upload(`/patients/${patientId}/photos`, fd);
    },
    onSuccess: () => {
      toast.success('Clinical photograph uploaded');
      qc.invalidateQueries({ queryKey: ['patient-photos', patientId] });
      if (fileRef.current) fileRef.current.value = '';
      setNotes('');
      setToothNumber('');
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMut = useMutation({
    mutationFn: (photoId) => api.del(`/patients/${patientId}/photos/${photoId}`),
    onSuccess: () => {
      toast.success('Photo deleted');
      qc.invalidateQueries({ queryKey: ['patient-photos', patientId] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="space-y-5">
      <Card title="Upload Clinical Photo or Radiograph">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
          <div>
            <label className="label-base">Image File</label>
            <input ref={fileRef} type="file" accept="image/*" className="input-base" />
          </div>
          <Select label="Clinical Type" value={photoType} onChange={(e) => setPhotoType(e.target.value)}>
            <option value="intraoral">Intraoral Photo</option>
            <option value="before">Before Treatment</option>
            <option value="after">After Treatment</option>
            <option value="progress">In-Progress</option>
            <option value="xray">Dental Radiograph (X-Ray)</option>
          </Select>
          <Input label="Tooth Number (FDI)" placeholder="e.g. 16, 21, 46" value={toothNumber} onChange={(e) => setToothNumber(e.target.value)} />
          <Input label="Date Taken" type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
        </div>
        <div className="mt-3.5 flex items-end gap-3">
          <div className="flex-1">
            <Textarea label="Clinical Notes / Findings" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending} icon={Upload}>
            Upload Image
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(data || []).map((ph) => (
          <div key={ph.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md">
            <PhotoImage patientId={patientId} photoId={ph.id} />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <Badge tone="info">{humanize(ph.photoType)}</Badge>
                <button
                  type="button"
                  title="Delete image"
                  onClick={() => { if (window.confirm('Delete this photo?')) deleteMut.mutate(ph.id); }}
                  className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {ph.toothNumber && (
                <p className="mt-1.5 text-[11px] font-bold text-navy-900">Tooth #{ph.toothNumber}</p>
              )}
              {ph.notes && <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">{ph.notes}</p>}
              <p className="mt-1 text-[10px] text-slate-400">{formatDate(ph.takenAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimpleTable({ columns, rows, loading, error, retry, empty, onRowClick }) {
  if (loading) return <div className="py-10"><div className="flex justify-center"><Spinner /></div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!rows || rows.length === 0) return <EmptyState title={empty || 'No records'} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="table-head">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-slate-400 ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((row) => (
            <tr
              key={row.id || Math.random()}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer transition hover:bg-accent-50/50' : 'transition hover:bg-slate-50/70'}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`table-cell px-4 py-3 text-[13px] ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                  }`}
                >
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
