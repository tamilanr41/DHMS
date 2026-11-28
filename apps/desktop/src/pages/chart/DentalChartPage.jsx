import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Grid3X3, ArrowLeft, ShieldAlert, Sparkles, User, Stethoscope,
  MessageCircle, ExternalLink, CalendarDays, Clock, Armchair,
  CheckCircle2, Search, ArrowRight, UserCheck, Phone, AlertTriangle, Users,
  Sliders, Wand2
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { formatDate, todayISO, humanize, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import Odontogram from '../../components/Odontogram.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import { PageLoader, ErrorState } from '../../components/ui/States.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';
import BeforeAfterSlider from '../../components/clinical/BeforeAfterSlider.jsx';
import GloveTouchModeModal from '../../components/clinical/GloveTouchModeModal.jsx';

export default function DentalChartPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { has } = useAuth();
  const [picked, setPicked] = useState(null);
  const [gloveModeOpen, setGloveModeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'aesthetic'
  const today = todayISO();

  // Load patient data if ID present
  const patientQuery = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}`)).data,
    enabled: Boolean(patientId)
  });

  // Load today's clinical queue for live KPI cards & quick-pick
  const queueQuery = useQuery({
    queryKey: ['queue-chart-page', today],
    queryFn: async () => (await api.get(`/appointments/queue?date=${today}`)).data,
    refetchInterval: 30_000
  });

  // Load recent patients for fast one-click charting
  const recentPatientsQuery = useQuery({
    queryKey: ['recent-patients-for-chart'],
    queryFn: async () => (await api.get('/patients?limit=6')).data
  });

  const queueData = queueQuery.data || [];
  const recentPatients = recentPatientsQuery.data || [];

  const summary = useMemo(() => {
    const total = queueData.length;
    const waiting = queueData.filter((r) => ['checked_in', 'waiting'].includes(r.status)).length;
    const consulting = queueData.filter((r) => r.status === 'in_consultation').length;
    const completed = queueData.filter((r) => r.status === 'completed').length;
    return { total, waiting, consulting, completed };
  }, [queueData]);

  const p = patientQuery.data;

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* ── Doccure Dental Hero Banner ────────────────────────────────────── */}
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
                <h1 className="text-2xl font-black tracking-tight">Interactive Dental Chart &amp; Odontogram</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  FDI World Federation Standard
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                32 Permanent &amp; 20 Deciduous tooth surface diagnosis, restoratives, periodontal probing depth scoring, and clinical charting history.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/queue')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] border border-white/25 shadow-sm"
            >
              <Armchair size={15} />
              Operatory Floor
            </button>
            <button
              type="button"
              onClick={() => navigate('/consultations')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
            >
              <Stethoscope size={16} className="text-[#0a7f8b]" />
              Consultations Desk
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards (Matches Waiting Queue Screenshot 1:1) ────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="SCHEDULED VISITS"
          value={summary.total}
          subtitle="on roster"
          icon={CalendarDays}
          variant="teal"
        />
        <DoccureKpiCard
          title="WAITING LOUNGE"
          value={summary.waiting}
          subtitle="triage checked-in"
          icon={Clock}
          variant="amber"
        />
        <DoccureKpiCard
          title="IN OPERATORY CHAIR"
          value={summary.consulting}
          subtitle="active care"
          icon={Stethoscope}
          variant="purple"
          hasDot={true}
        />
        <DoccureKpiCard
          title="COMPLETED CARE"
          value={summary.completed}
          subtitle="treated today"
          icon={CheckCircle2}
          variant="emerald"
        />
      </div>

      {/* ── Condition A: Patient IS Selected ─────────────────────────────────── */}
      {patientId ? (
        patientQuery.isLoading ? (
          <PageLoader label="Loading patient dental chart…" />
        ) : patientQuery.error ? (
          <ErrorState error={patientQuery.error} onRetry={patientQuery.refetch} />
        ) : (
          <div className="space-y-6">
            {/* Executive Patient Header Bar */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <PatientAvatar
                    patient={p}
                    size={52}
                    className="rounded-2xl shadow-md ring-2 ring-teal-500/20"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                        {p.fullName}
                      </h2>
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-mono font-bold text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                        {p.patientNo}
                      </span>
                      <Badge tone={p.isActive ? 'success' : 'neutral'}>
                        {p.isActive ? 'Active Care' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-semibold">
                      {p.age != null ? `${p.age} yrs` : 'Age not recorded'} · {p.gender ? humanize(p.gender) : 'Gender not specified'} · Phone: {p.mobile || 'None'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGloveModeOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#009da6] to-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    <span>🧤 Glove Mode (Fast Touch)</span>
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowLeft}
                    onClick={() => navigate('/dental-chart')}
                  >
                    Change Patient
                  </Button>
                  <Link
                    to={`/patients/${p.id}?tab=chart`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span>Full Profile</span>
                    <ExternalLink size={12} />
                  </Link>
                  <Link
                    to={`/consultations?new=1&patientId=${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-3.5 py-1.5 text-xs font-black text-white shadow-sm hover:opacity-95 transition"
                  >
                    <Stethoscope size={13} />
                    <span>Start Consultation</span>
                  </Link>
                </div>
              </div>

              {/* Medical Alert Warning Strip */}
              {(p.allergies || p.medicalAlerts) && (
                <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 border border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                  <ShieldAlert size={16} className="shrink-0 text-rose-500" />
                  <span className="truncate">
                    <strong>Medical Alerts / Allergies:</strong> {p.allergies ? `Allergies: ${p.allergies}` : ''} {p.medicalAlerts ? `· Alerts: ${p.medicalAlerts}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* View Switcher Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 pt-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 rounded-2xl shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition cursor-pointer ${
                  activeTab === 'chart'
                    ? 'border-[#0a7f8b] text-[#0a7f8b] dark:text-teal-300 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Grid3X3 size={15} />
                <span>3D Pearl Enamel Odontogram</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('aesthetic')}
                className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition cursor-pointer ${
                  activeTab === 'aesthetic'
                    ? 'border-[#0a7f8b] text-[#0a7f8b] dark:text-teal-300 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Sliders size={15} />
                <span>Before &amp; After Smile Studio</span>
              </button>
            </div>

            {/* Conditional Tab Rendering */}
            {activeTab === 'chart' ? (
              <Odontogram patientId={p.id} canEdit={has('chart.edit')} />
            ) : (
              <BeforeAfterSlider patientName={p.fullName} />
            )}

            {/* Chair-Side Glove Touch Mode Modal */}
            <GloveTouchModeModal
              isOpen={gloveModeOpen}
              onClose={() => setGloveModeOpen(false)}
              patientName={p.fullName}
              patientId={p.id}
            />
          </div>
        )
      ) : (
        /* ── Condition B: NO Patient Selected ─────────────────────────────────── */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (7 cols): Patient Picker & Search */}
          <div className="lg:col-span-7 space-y-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                  <Grid3X3 size={20} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Patient Odontogram
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Search patient by name, ID (#PAT-...) or mobile number to launch the 3D dental chart
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <PatientPicker
                  value={picked}
                  onChange={(patient) => {
                    setPicked(patient);
                    if (patient) navigate(`/dental-chart/${patient.id}`);
                  }}
                  label="Search & Select Patient"
                  autoFocus
                  hint="Type at least 2 characters to search clinic records."
                />

                <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4 text-xs text-slate-700 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-slate-300 leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <Sparkles size={16} className="text-[#0a7f8b] mt-0.5 shrink-0" />
                    <div>
                      <strong className="font-bold text-[#0a7f8b] dark:text-teal-300">FDI World Dental Federation Standard:</strong>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        Supports permanent teeth (#11–#48) and primary deciduous teeth (#51–#85). Surface diagnoses (Mesial, Distal, Occlusal, Buccal, Lingual) and treatments are versioned automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Pick: Patients In Today's Waiting Lounge */}
            {queueData.length > 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      Today's Lounge Patients (Click to Chart)
                    </h3>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    {queueData.length} in clinic
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {queueData.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/dental-chart/${item.patientId}`)}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition-all hover:-translate-y-0.5 hover:border-[#0a7f8b]/40 hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-800/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PatientAvatar
                          patient={{ id: item.patientId, fullName: item.patientName }}
                          size={36}
                          className="rounded-xl shadow-xs shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-800 group-hover:text-[#0a7f8b] dark:text-white">
                            {item.patientName}
                          </p>
                          <p className="text-[10.5px] font-mono text-slate-400 font-semibold">
                            {item.tokenNumber ? `Token #${item.tokenNumber}` : 'In Clinic'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-slate-400 group-hover:text-[#0a7f8b] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (5 cols): Quick Recent Patients & FDI Legend */}
          <div className="lg:col-span-5 space-y-6">
            {/* Recent Patients */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#0a7f8b]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                    Recent Patients
                  </h3>
                </div>
                <Link
                  to="/patients"
                  className="text-xs font-bold text-[#0a7f8b] hover:underline"
                >
                  View All →
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {recentPatients.slice(0, 5).map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/dental-chart/${patient.id}`)}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition-all hover:border-[#14b8c8]/40 hover:bg-teal-50/30 hover:shadow-xs dark:border-slate-800 dark:bg-slate-800/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PatientAvatar
                        patient={patient}
                        size={36}
                        className="rounded-xl shadow-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-800 group-hover:text-[#0a7f8b] dark:text-white">
                          {patient.fullName}
                        </p>
                        <p className="text-[10.5px] font-mono text-slate-400">
                          {patient.patientNo} · {patient.mobile || 'No phone'}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0a7f8b] opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Chart</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* FDI Quadrant Guide Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white mb-3">
                FDI Two-Digit Quadrant Key
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="font-black text-[#0a7f8b]">Q1 · Upper Right</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Teeth 18 to 11</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="font-black text-[#0a7f8b]">Q2 · Upper Left</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Teeth 21 to 28</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="font-black text-[#0a7f8b]">Q4 · Lower Right</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Teeth 48 to 41</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="font-black text-[#0a7f8b]">Q3 · Lower Left</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Teeth 31 to 38</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
