import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save, CheckCircle2, Stethoscope, ClipboardList, Pill, FileClock, Plus,
  ArrowLeft, Download, CalendarDays, Clock3, UserRound, Phone, Target, History, CircleCheck,
  Circle, ShieldAlert, FileText, Sparkles, Syringe, Layers, Activity, Check, HeartPulse
} from 'lucide-react';
import { api, openBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney, humanize, initials, todayISO, addDaysISO } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Textarea, Input, FormRow } from '../../components/ui/Input.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { PageLoader, ErrorState, EmptyState } from '../../components/ui/States.jsx';
import Odontogram from '../../components/Odontogram.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import ConsultationAudioRecorder from '../../components/ConsultationAudioRecorder.jsx';
import DoctorPrescriptionPadModal from '../../components/DoctorPrescriptionPadModal.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const TABS = [
  { value: 'record', label: 'Clinical record' },
  { value: 'chart', label: 'Dental chart' },
  { value: 'plans', label: 'Treatment plans' },
  { value: 'prescriptions', label: 'Prescriptions' },
  { value: 'notes', label: 'Amendments & notes' }
];

const CORE_FIELDS = [
  { key: 'chiefComplaint', label: 'Chief complaint' },
  { key: 'examinationFindings', label: 'Examination findings' },
  { key: 'diagnosis', label: 'Diagnosis', required: true },
  { key: 'recommendations', label: 'Recommendations' }
];

const DENTAL_COMPLAINT_CHIPS = [
  'Severe throbbing toothache',
  'Sensitivity to cold & sweets',
  'Broken / chipped tooth',
  'Bleeding gums while brushing',
  'Food impaction between teeth',
  'Dislodged filling / crown',
  'Wisdom tooth pain & swelling',
  'Routine dental scaling & checkup',
  'Aesthetic smile concern'
];

const DENTAL_FINDING_CHIPS = [
  'Deep dentinal caries involving pulp chamber',
  'Generalised subgingival calculus & marginal gingivitis',
  'Grade II tooth mobility with bone resorption',
  'Cervical abrasion with dentin hypersensitivity',
  'Partially erupted 38/48 with inflamed operculum',
  'Tender to vertical percussion (TTP positive)',
  'Defective restoration with microleakage',
  'Root stump with periapical rarefaction'
];

const DENTAL_DIAGNOSIS_CHIPS = [
  'Acute Irreversible Pulpitis',
  'Chronic Periapical Periodontitis',
  'Dental Caries (Enamel / Dentin)',
  'Chronic Generalized Marginal Gingivitis',
  'Localized Severe Periodontitis',
  'Acute Pericoronitis (38/48)',
  'Pulp Necrosis with Periapical Abscess',
  'Partial Edentulism'
];

const DENTAL_PROCEDURES = [
  {
    category: 'Endodontics',
    items: [
      'Access opening done under rubber dam isolation',
      'Working length determined using apex locator & RVG',
      'Biomechanical preparation (BMP) done with rotary files',
      'Canals irrigated with 3% NaOCl and 17% EDTA',
      'Intracanal medicament (Ca(OH)2) placed with temporary seal',
      'Master cone fit verified; obturation completed with AH Plus & GP'
    ]
  },
  {
    category: 'Restorative',
    items: [
      'Caries excavation & cavity preparation done',
      'Acid etched 37% H3PO4 (15s), bonding agent light-cured',
      'Microhybrid composite restored in incremental layers',
      'Occlusion checked with articulating paper & polished',
      'GIC Type II aesthetic restorative placement'
    ]
  },
  {
    category: 'Oral Surgery',
    items: [
      'Local anesthesia administered (2% Lignocaine with 1:80k Adrenaline)',
      'Atraumatic extraction performed with luxator & forceps',
      'Socket debrided, curetted and verified intact',
      'Gelatamp hemostatic sponge placed; gauze pressure pack applied',
      'Surgical disimpaction completed with 3-0 Silk interrupted sutures'
    ]
  },
  {
    category: 'Prosthodontics',
    items: [
      'Crown preparation done with chamfer finish line',
      'Gingival retraction cord (#00) placed',
      'Addition silicone (PVS) impression taken with light/putty body',
      'Bite registration recorded with Jet Blue Bite',
      'Temporary acrylic crown cemented with temp-bond',
      'Final Zirconia / Ceramic crown trial & cementation with RelyX'
    ]
  },
  {
    category: 'Periodontics',
    items: [
      'Full mouth ultrasonic supragingival and subgingival scaling',
      'Subgingival curettage and root planing performed',
      'Chlorhexidine 0.2% pocket irrigation completed',
      'Polishing with prophy paste and rubber cup'
    ]
  }
];

const DENTAL_POST_OP_CHIPS = [
  'Bite firmly on gauze pack for 45 minutes; do not spit or rinse today.',
  'Warm saline mouth rinses starting tomorrow (3 to 4 times a day for 5 days).',
  'Avoid chewing on the treated side; soft room-temperature diet today.',
  'Avoid hot liquids, spicy foods, smoking, and drinking through a straw.',
  'Take prescribed analgesics before local anesthesia numbness wears off.',
  'Maintain oral hygiene; brush gently around the surgical site.',
  'Return for suture removal after 7 days.'
];

export default function ConsultationWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('record');
  const [form, setForm] = useState(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amend, setAmend] = useState({ content: '', diagnosis: '', examinationFindings: '', clinicalNotes: '', recommendations: '' });
  const [padOpen, setPadOpen] = useState(false);

  const handleSaveConsultationPad = async ({ notes: padNotes, handwritingData, followUpDays }) => {
    try {
      await api.post('/prescriptions', {
        patientId: c.patientId,
        consultationId: id,
        prescriptionDate: todayISO(),
        allergiesNoted: c.patient?.allergies || null,
        notes: padNotes || 'Consultation Stylus Prescription',
        handwritingData: handwritingData || null,
        followUpDate: followUpDays ? addDaysISO(todayISO(), Number(followUpDays)) : null,
        items: [
          {
            medicineName: 'Doctor Stylus Prescription Attached',
            dosage: 'As instructed',
            route: 'oral',
            frequency: 'See handwritten sheet',
            duration: `${followUpDays} days`,
            instructions: 'Follow clinical handwriting on prescription sheet'
          }
        ]
      });
      toast.success('Stylus prescription saved to consultation');
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
      setPadOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Chairside Dental Assistants State
  const [laAgent, setLaAgent] = useState('2% Lignocaine with 1:80k Adrenaline');
  const [laTechnique, setLaTechnique] = useState('Inferior Alveolar Nerve Block (IANB)');
  const [laCarpules, setLaCarpules] = useState('1 cartridge (1.8ml)');
  const [selectedProcCat, setSelectedProcCat] = useState('Endodontics');

  const appendText = (field, text) => {
    setForm((f) => {
      const existing = String(f[field] || '').trim();
      const updated = existing ? `${existing}\n• ${text}` : `• ${text}`;
      return { ...f, [field]: updated };
    });
  };

  const setOrAppendDiagnosis = (diag) => {
    setForm((f) => {
      const existing = String(f.diagnosis || '').trim();
      if (!existing) return { ...f, diagnosis: diag };
      if (existing.includes(diag)) return f;
      return { ...f, diagnosis: `${existing}; ${diag}` };
    });
  };

  const appendLA = () => {
    const laNote = `Local Anesthesia: Administered ${laCarpules} of ${laAgent} via ${laTechnique}. Aspiration negative; profound anesthesia achieved.`;
    appendText('clinicalNotes', laNote);
    toast.success('Anesthesia entry added to clinical notes');
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['consultation', id],
    queryFn: async () => (await api.get(`/consultations/${id}`)).data
  });

  useEffect(() => {
    if (data) {
      setForm({
        chiefComplaint: data.chiefComplaint || '',
        examinationFindings: data.examinationFindings || '',
        diagnosis: data.diagnosis || '',
        clinicalNotes: data.clinicalNotes || '',
        recommendations: data.recommendations || '',
        followUpDate: data.followUpDate || '',
        vitals: data.vitals || {}
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.patch(`/consultations/${id}`, payload),
    onSuccess: () => {
      toast.success('Draft saved');
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
    },
    onError: (err) => toast.error(err.message)
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync({ ...form, followUpDate: form.followUpDate || null });
      return api.post(`/consultations/${id}/complete`);
    },
    onSuccess: () => {
      toast.success('Consultation completed');
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      setCompleteOpen(false);
    },
    onError: (err) => toast.error(err.message)
  });

  const amendMutation = useMutation({
    mutationFn: (payload) => api.post(`/consultations/${id}/amend`, payload),
    onSuccess: () => {
      toast.success('Amendment recorded');
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
      setAmendOpen(false);
      setAmend({ content: '', diagnosis: '', examinationFindings: '', clinicalNotes: '', recommendations: '' });
    },
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      if (!data || data.status !== 'draft' || !form) return;
      e.preventDefault();
      saveMutation.mutate({ ...form, followUpDate: form.followUpDate || null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, form]);

  if (isLoading) return <PageLoader label="Loading consultation…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!form) return <PageLoader label="Preparing consultation…" />;

  const c = data;
  const isDraft = c.status === 'draft';
  const canEdit = has('consultations.manage') && isDraft;
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateVital = (key) => (e) => setForm((f) => ({ ...f, vitals: { ...(f.vitals || {}), [key]: e.target.value } }));

  const filled = CORE_FIELDS.filter((f) => String(form[f.key] || '').trim().length > 0).length;
  const progress = Math.round((filled / CORE_FIELDS.length) * 100);

  const tabsWithCounts = TABS.map((t) => {
    if (t.value === 'plans') return { ...t, count: c.treatmentPlans.length };
    if (t.value === 'prescriptions') return { ...t, count: c.prescriptions.length };
    if (t.value === 'notes') return { ...t, count: c.notes.length };
    return t;
  });

  return (
    <div>
      {/* Doccure Dental Hero Banner */}
      <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a7f8b] via-[#0e95a3] to-[#14b8c8] p-6 text-white shadow-[0_20px_50px_-20px_rgba(10,127,139,0.35)]">
        <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-25">
          <img src={heroTooth} alt="" className="h-48 w-48 object-contain" />
        </div>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PatientAvatar patient={c.patient} size={54} className="rounded-2xl ring-2 ring-white/50 shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">{c.patient?.fullName}</h1>
                <Badge status={c.status} />
              </div>
              <p className="mt-1 text-xs text-white/85">
                <span className="font-mono font-bold text-white">{c.consultationNo}</span> · {formatDateTime(c.visitAt)} · Dr. {c.dentistName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/consultations')}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 border border-white/25 shadow-sm"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              onClick={() => setPadOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 border border-white/25 shadow-sm"
            >
              <Pill size={14} />
              Prescription Pad
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ ...form, followUpDate: form.followUpDate || null })}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 border border-white/25 shadow-sm"
                >
                  <Save size={14} />
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => setCompleteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
                >
                  <CheckCircle2 size={15} className="text-[#0a7f8b]" />
                  Complete Care
                </button>
              </>
            )}
            {has('consultations.amend') && !isDraft && (
              <button
                type="button"
                onClick={() => setAmendOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 border border-white/25 shadow-sm"
              >
                <FileClock size={14} />
                Amend Record
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/80 bg-line/70 shadow-soft sm:grid-cols-4">
        <MetaCell icon={FileText} label="Consultation" value={c.consultationNo} />
        <MetaCell icon={CalendarDays} label="Visit" value={formatDate(c.visitAt)} hint={formatDateTime(c.visitAt).split(', ')[1]} />
        <MetaCell icon={Stethoscope} label="Treating dentist" value={c.dentistName} />
        <MetaCell icon={Clock3} label="Follow-up" value={c.followUpDate ? formatDate(c.followUpDate) : 'Not scheduled'} hint={c.followUpDate ? undefined : 'Optional'} />
      </div>

      {(c.patient?.allergies || c.patient?.conditions) && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 leading-relaxed">
            {c.patient.allergies && <p><strong>Allergies:</strong> {c.patient.allergies}</p>}
            {c.patient.conditions && <p><strong>Medical conditions:</strong> {c.patient.conditions}</p>}
          </div>
        </div>
      )}

      {!isDraft && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3.5 py-2.5 text-[11.5px] text-slate-600">
          <History size={14} className="shrink-0 text-slate-400" />
          <span>Finalised {formatDateTime(c.completedAt)}. Clinical text is locked — use <strong className="font-semibold text-ink">Amend record</strong> to add a logged correction.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_308px]">
        <div className="min-w-0">
          <Tabs tabs={tabsWithCounts} value={tab} onChange={setTab} className="mb-3" />

          {tab === 'record' && (
            <div className="space-y-4">
              <Card
                title="Chief complaint & oral examination"
                subtitle="Record the patient's presenting concern and objective clinical findings."
                actions={isDraft ? <Badge tone="warn" dot={false}>Draft</Badge> : <Badge status={c.status} />}
              >
                <div className="space-y-5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Chief complaint</label>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-sky-600">
                        <Sparkles size={12} /> Dental Quick Complaints
                      </span>
                    </div>
                    {canEdit && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {DENTAL_COMPLAINT_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => appendText('chiefComplaint', chip)}
                            className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 transition cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea
                      rows={3}
                      value={form.chiefComplaint}
                      onChange={update('chiefComplaint')}
                      disabled={!canEdit}
                      placeholder="e.g. Pain in lower right molar for 3 days"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Clinical examination findings</label>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-sky-600">
                        <Sparkles size={12} /> Common Oral Findings
                      </span>
                    </div>
                    {canEdit && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {DENTAL_FINDING_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => appendText('examinationFindings', chip)}
                            className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 transition cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea
                      rows={4}
                      value={form.examinationFindings}
                      onChange={update('examinationFindings')}
                      disabled={!canEdit}
                      placeholder="Intra-oral examination, probing depths, mobility, radiographic findings…"
                    />
                  </div>
                </div>
              </Card>

              {/* Chairside Dental Procedure & Local Anesthesia Logger */}
              {canEdit && (
                <Card
                  title="Chairside Procedure & Local Anesthesia (LA) Logger"
                  subtitle="One-click dental procedure steps and anesthesia documentation for clinical records."
                >
                  <div className="space-y-4">
                    {/* Category tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-2.5">
                      {DENTAL_PROCEDURES.map((p) => (
                        <button
                          key={p.category}
                          type="button"
                          onClick={() => setSelectedProcCat(p.category)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            selectedProcCat === p.category
                              ? 'bg-navy-800 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {p.category}
                        </button>
                      ))}
                    </div>

                    {/* Step chips for selected category */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Click to append {selectedProcCat} steps to clinical notes:
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {DENTAL_PROCEDURES.find((p) => p.category === selectedProcCat)?.items.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              appendText('clinicalNotes', item);
                              toast.success('Step added to clinical notes');
                            }}
                            className="flex items-start gap-2 rounded-xl border border-line bg-white p-2.5 text-left text-xs text-slate-700 shadow-2xs hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-900 transition cursor-pointer"
                          >
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                              +
                            </span>
                            <span className="leading-snug">{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Local Anesthesia Quick Log Strip */}
                    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5">
                      <div className="mb-2.5 flex items-center gap-2">
                        <Syringe size={15} className="text-sky-600" />
                        <span className="text-xs font-bold text-sky-950">Local Anesthesia (LA) Documentation</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600">Solution</label>
                          <select
                            value={laAgent}
                            onChange={(e) => setLaAgent(e.target.value)}
                            className="input-base text-xs py-1 h-8"
                          >
                            <option value="2% Lignocaine with 1:80k Adrenaline">2% Lignocaine with 1:80k Adrenaline</option>
                            <option value="4% Articaine with 1:100k Epinephrine">4% Articaine with 1:100k Epinephrine</option>
                            <option value="3% Mepivacaine plain (No vaso)">3% Mepivacaine plain (No vaso)</option>
                            <option value="0.5% Bupivacaine with 1:200k Epi">0.5% Bupivacaine with 1:200k Epi</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600">Technique</label>
                          <select
                            value={laTechnique}
                            onChange={(e) => setLaTechnique(e.target.value)}
                            className="input-base text-xs py-1 h-8"
                          >
                            <option value="Inferior Alveolar Nerve Block (IANB)">Inferior Alveolar Nerve Block (IANB)</option>
                            <option value="Buccal / Labial Infiltration">Buccal / Labial Infiltration</option>
                            <option value="Palatal Infiltration">Palatal Infiltration</option>
                            <option value="Mental Nerve Block">Mental Nerve Block</option>
                            <option value="Intraligamentary (PDL)">Intraligamentary (PDL)</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600">Dose / Cartridges</label>
                          <div className="flex gap-1.5">
                            <select
                              value={laCarpules}
                              onChange={(e) => setLaCarpules(e.target.value)}
                              className="input-base text-xs py-1 h-8 flex-1"
                            >
                              <option value="1 cartridge (1.8ml)">1 cartridge (1.8ml)</option>
                              <option value="1.5 cartridges (2.7ml)">1.5 cartridges (2.7ml)</option>
                              <option value="2 cartridges (3.6ml)">2 cartridges (3.6ml)</option>
                              <option value="0.5 cartridge (0.9ml)">0.5 cartridge (0.9ml)</option>
                            </select>
                            <Button size="sm" icon={Plus} onClick={appendLA} className="h-8 shrink-0 text-xs">
                              Log LA
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <Card
                title="Vital signs"
                subtitle="Chair-side observations recorded at this visit. Optional, but useful for medically complex patients."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
                    <Input label="BP systolic" type="number" min="0" max="300" value={form.vitals?.bloodPressureSystolic ?? ''} onChange={updateVital('bloodPressureSystolic')} disabled={!canEdit} placeholder="120" />
                    <Input label="BP diastolic" type="number" min="0" max="200" value={form.vitals?.bloodPressureDiastolic ?? ''} onChange={updateVital('bloodPressureDiastolic')} disabled={!canEdit} placeholder="80" />
                    <Input label="Pulse (bpm)" type="number" min="0" max="300" value={form.vitals?.pulse ?? ''} onChange={updateVital('pulse')} disabled={!canEdit} placeholder="72" />
                    <Input label="Temperature (°C)" type="number" step="0.1" min="0" max="50" value={form.vitals?.temperature ?? ''} onChange={updateVital('temperature')} disabled={!canEdit} placeholder="36.8" />
                    <Input label="SpO₂ (%)" type="number" min="0" max="100" value={form.vitals?.spo2 ?? ''} onChange={updateVital('spo2')} disabled={!canEdit} placeholder="98" />
                    <Input label="Respiratory rate" type="number" min="0" max="60" value={form.vitals?.respiratoryRate ?? ''} onChange={updateVital('respiratoryRate')} disabled={!canEdit} placeholder="16" />
                    <Input label="Weight (kg)" type="number" step="0.1" min="0" max="400" value={form.vitals?.weightKg ?? ''} onChange={updateVital('weightKg')} disabled={!canEdit} placeholder="68" />
                    <Input label="Height (cm)" type="number" step="0.1" min="0" max="250" value={form.vitals?.heightCm ?? ''} onChange={updateVital('heightCm')} disabled={!canEdit} placeholder="170" />
                  </div>
                  <FormRow cols={2}>
                    <Input label="Blood sugar (mg/dL)" type="number" min="0" max="1000" value={form.vitals?.bloodSugar ?? ''} onChange={updateVital('bloodSugar')} disabled={!canEdit} placeholder="Optional" />
                    <Input label="Vitals note" value={form.vitals?.notes ?? ''} onChange={updateVital('notes')} disabled={!canEdit} placeholder="e.g. known hypertensive, on medication" />
                  </FormRow>
                </div>
              </Card>

              <Card
                title="Diagnosis & Treatment Plan"
                subtitle={isDraft ? 'A diagnosis is required before the consultation can be completed.' : 'Final diagnosis for this visit.'}
                actions={
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold ring-1 ${form.diagnosis.trim() ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-amber-100'}`}>
                    {form.diagnosis.trim() ? <CircleCheck size={11} /> : <Circle size={11} />}
                    {form.diagnosis.trim() ? 'Recorded' : 'Required'}
                  </span>
                }
              >
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Dental Diagnosis</label>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-sky-600">
                        <Sparkles size={12} /> 1-Click Common Diagnoses
                      </span>
                    </div>
                    {canEdit && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {DENTAL_DIAGNOSIS_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setOrAppendDiagnosis(chip)}
                            className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea
                      required={isDraft}
                      rows={2}
                      value={form.diagnosis}
                      onChange={update('diagnosis')}
                      disabled={!canEdit}
                      placeholder="Primary diagnosis and any secondary findings"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Clinical notes &amp; procedure record</label>
                      <Textarea
                        rows={6}
                        value={form.clinicalNotes}
                        onChange={update('clinicalNotes')}
                        disabled={!canEdit}
                        placeholder="Procedure details, materials used, anesthesia, tooth surfaces…"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">Treatment recommendations &amp; Home care</label>
                      </div>
                      {canEdit && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {DENTAL_POST_OP_CHIPS.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => appendText('recommendations', chip)}
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer"
                            >
                              + {chip.slice(0, 32)}…
                            </button>
                          ))}
                        </div>
                      )}
                      <Textarea
                        rows={5}
                        value={form.recommendations}
                        onChange={update('recommendations')}
                        disabled={!canEdit}
                        placeholder="Recommended post-op steps, oral hygiene advice…"
                      />
                    </div>
                  </div>
                  <Input label="Follow-up date" type="date" value={form.followUpDate || ''} onChange={update('followUpDate')} disabled={!canEdit} wrapperClass="max-w-xs" hint="Leave blank if no review appointment is required." />
                </div>
              </Card>

              {canEdit && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line bg-white/70 px-3.5 py-2.5">
                  <p className="text-[11px] leading-relaxed text-slate-500">Unsaved changes are stored in this draft only. Press <kbd className="rounded border border-line bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-600">Ctrl</kbd> + <kbd className="rounded border border-line bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-600">S</kbd> to save.</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="secondary" icon={Save} loading={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...form, followUpDate: form.followUpDate || null })}>Save draft</Button>
                    <Button size="sm" icon={CheckCircle2} onClick={() => setCompleteOpen(true)}>Complete</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'chart' && <Odontogram patientId={c.patientId} canEdit={has('chart.edit')} consultationId={id} />}

          {tab === 'plans' && (
            <Card
              title="Treatment plans for this consultation"
              subtitle="Procedures proposed during this visit, tracked separately from completed treatment."
              noBody
              actions={(has('plans.manage')) && (
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate(`/treatment-plans?new=1&patientId=${c.patientId}&consultationId=${id}`)}>New plan</Button>
              )}
            >
              {c.treatmentPlans.length === 0 ? (
                <EmptyState title="No treatment plan" message="Create a treatment plan to propose procedures for this visit." icon={ClipboardList} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="table-head"><tr><th className="px-4 py-2 text-left">Plan</th><th className="px-4 py-2 text-left">Created</th><th className="px-4 py-2 text-right">Estimate</th><th className="px-4 py-2 text-center">Items</th><th className="px-4 py-2 text-left">Status</th></tr></thead>
                    <tbody>
                      {c.treatmentPlans.map((p) => (
                        <tr key={p.id} className="cursor-pointer border-t border-line hover:bg-accent-50/30" onClick={() => navigate(`/treatment-plans/${p.id}`)}>
                          <td className="table-cell font-mono text-[11.5px] font-semibold text-navy">{p.plan_no}</td>
                          <td className="table-cell">{formatDate(p.created_at)}</td>
                          <td className="table-cell text-right tabular-nums">{formatMoney(p.estimate)}</td>
                          <td className="table-cell text-center">{p.item_count}</td>
                          <td className="table-cell"><Badge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'prescriptions' && (
            <Card
              title="Prescriptions issued"
              subtitle="Medicines prescribed as part of this clinical visit."
              noBody
              actions={has('prescriptions.manage') && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="subtle" icon={Pill} onClick={() => setPadOpen(true)}>Stylus Pen Pad</Button>
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate(`/prescriptions?new=1&patientId=${c.patientId}&consultationId=${id}`)}>New prescription</Button>
                </div>
              )}
            >
              {c.prescriptions.length === 0 ? (
                <EmptyState title="No prescriptions" message="Issue a prescription from this consultation when clinically indicated." icon={Pill} />
              ) : (
                <ul className="divide-y divide-line">
                  {c.prescriptions.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua-50 text-aqua-700 ring-1 ring-aqua-100"><Pill size={15} /></span>
                        <div>
                          <p className="text-[12.5px] font-medium text-ink">{p.prescription_no}</p>
                          <p className="text-[10.5px] text-slate-500">{formatDate(p.prescription_date)} · {p.item_count} medicine{p.item_count === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" icon={Download} onClick={() => openBlob(`/prescriptions/${p.id}/pdf`, `${p.prescription_no}.pdf`)}>PDF</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === 'notes' && (
            <Card title="Amendments and notes" subtitle="Every correction to a finalised record is preserved with authorship and time.">
              {c.notes.length === 0 ? (
                <EmptyState title="No amendments" message="Corrections to finalised consultations will appear here with authorship and timestamps." icon={FileClock} />
              ) : (
                <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
                  {c.notes.map((n) => (
                    <li key={n.id} className="relative pl-6">
                      <span className="absolute left-0 top-3 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-amber-400 ring-1 ring-amber-200" />
                      <div className="rounded-lg border border-line bg-white p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                            <FileClock size={12} /> {humanize(n.noteType)}
                          </span>
                          <span className="text-[10.5px] text-slate-400">{formatDateTime(n.createdAt)} · {n.authorName}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{n.content}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <Card title="Patient summary">
            <div className="flex items-center gap-3">
              <PatientAvatar patient={c.patient} size={48} className="rounded-xl shadow-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-navy">{c.patient?.fullName}</p>
                <p className="text-[11px] font-mono text-slate-500">{c.patient?.patientNo}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-2 border-t border-line/70 pt-3 text-[11.5px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Age / Gender</dt><dd className="font-medium text-ink">{c.patient?.age != null ? `${c.patient.age} yrs` : '—'} · {c.patient?.gender ? humanize(c.patient.gender) : '—'}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-slate-500">Mobile</dt><dd className="inline-flex items-center gap-1 font-medium text-ink"><Phone size={11} className="text-slate-400" />{c.patient?.mobile || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Follow-up</dt><dd className="font-medium text-ink">{c.followUpDate ? formatDate(c.followUpDate) : '—'}</dd></div>
            </dl>
            <Link to={`/patients/${c.patientId}`} className="link mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium">
              <UserRound size={12} /> Open patient profile
            </Link>
          </Card>

          {/* Chairside Audio Discussion Recorder */}
          <ConsultationAudioRecorder
            consultationId={id}
            patientName={c.patient?.fullName}
          />

          <Card title="Record completion" subtitle={isDraft ? 'Core clinical fields for this draft.' : 'Finalised record.'}>
            <div className="flex items-baseline justify-between">
              <span className="text-[22px] font-semibold leading-none text-navy">{progress}%</span>
              <span className="text-[10.5px] text-slate-500">{filled} of {CORE_FIELDS.length} fields</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: `${progress}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {CORE_FIELDS.map((f) => {
                const done = String(form[f.key] || '').trim().length > 0;
                return (
                  <li key={f.key} className="flex items-center gap-2 text-[11.5px]">
                    {done ? <CircleCheck size={13} className="shrink-0 text-emerald-500" /> : <Circle size={13} className="shrink-0 text-slate-300" />}
                    <span className={done ? 'text-slate-600' : 'text-slate-400'}>{f.label}</span>
                    {f.required && !done && <span className="ml-auto text-[9.5px] font-semibold uppercase text-amber-600">Required</span>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Quick links">
            <div className="space-y-1.5">
              <Button variant="secondary" className="w-full justify-start" size="sm" icon={Target} onClick={() => setTab('chart')}>Update dental chart</Button>
              <Button variant="secondary" className="w-full justify-start" size="sm" icon={ClipboardList} onClick={() => setTab('plans')}>Treatment plans</Button>
              <Button variant="secondary" className="w-full justify-start" size="sm" icon={Pill} onClick={() => setTab('prescriptions')}>Prescriptions</Button>
            </div>
          </Card>

          {c.appointment && (
            <Card title="Linked appointment">
              <p className="font-mono text-[11.5px] font-semibold text-navy">{c.appointment.appointmentNo}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays size={11} /> {formatDate(c.appointment.appointmentDate)}</p>
              <div className="mt-1.5"><Badge status={c.appointment.status} /></div>
            </Card>
          )}

          <Card title="Record details">
            <dl className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Created</dt><dd className="text-right font-medium text-slate-700">{formatDateTime(c.createdAt)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Completed</dt><dd className="text-right font-medium text-slate-700">{c.completedAt ? formatDateTime(c.completedAt) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Amendments</dt><dd className="font-medium text-slate-700">{c.notes.length}</dd></div>
            </dl>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete consultation"
        message="Completing finalises the clinical record. Later corrections must be recorded through the amendment workflow. Continue?"
        confirmLabel="Complete consultation"
        tone="primary"
        loading={completeMutation.isPending}
        onConfirm={() => completeMutation.mutate()}
      />

      <Modal
        open={amendOpen}
        onClose={() => setAmendOpen(false)}
        title="Amend finalized consultation"
        subtitle="Describe the correction. The original clinical text can only be changed through this logged amendment."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAmendOpen(false)}>Cancel</Button>
            <Button
              loading={amendMutation.isPending}
              disabled={amend.content.trim().length < 3}
              onClick={() => amendMutation.mutate(amend)}
            >
              Record amendment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea label="Reason for amendment" required rows={3} value={amend.content} onChange={(e) => setAmend((a) => ({ ...a, content: e.target.value }))} placeholder="Explain what is being corrected and why" />
          <p className="rounded-md border border-line bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">Optionally update the current text fields. Leave blank to keep existing values.</p>
          <Textarea label="Diagnosis" rows={2} value={amend.diagnosis} onChange={(e) => setAmend((a) => ({ ...a, diagnosis: e.target.value }))} placeholder={c.diagnosis || 'No diagnosis recorded'} />
          <Textarea label="Examination findings" rows={3} value={amend.examinationFindings} onChange={(e) => setAmend((a) => ({ ...a, examinationFindings: e.target.value }))} placeholder={c.examinationFindings || 'No findings recorded'} />
          <Textarea label="Clinical notes" rows={3} value={amend.clinicalNotes} onChange={(e) => setAmend((a) => ({ ...a, clinicalNotes: e.target.value }))} />
          <Textarea label="Recommendations" rows={2} value={amend.recommendations} onChange={(e) => setAmend((a) => ({ ...a, recommendations: e.target.value }))} />
        </div>
      </Modal>

      <DoctorPrescriptionPadModal
        isOpen={padOpen}
        onClose={() => setPadOpen(false)}
        patient={c.patient}
        dentistName={c.dentistName || 'Dr. Sarah Jenkins'}
        onSavePrescription={handleSaveConsultationPad}
      />
    </div>
  );
}

function MetaCell({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3 transition-colors hover:bg-slate-50/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-50 to-accent-50 text-navy-700 ring-1 ring-navy-100 shadow-xs">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-xs font-bold text-ink">{value}</p>
        {hint && <p className="truncate text-[10px] text-slate-400 font-medium">{hint}</p>}
      </div>
    </div>
  );
}
