import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Download, Pill, AlertTriangle, RefreshCw, FileText, CalendarDays, CalendarClock, Users,
  LayoutTemplate, BookmarkPlus, Pencil, Sparkles, LayoutGrid, List, Clock3, CheckCircle2,
  ArrowRight, Eye, Stethoscope, Armchair, X, Search, UserCheck, ShieldAlert
} from 'lucide-react';
import { api, openBlob } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useDentists } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, todayISO, initials, addDaysISO } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button, { IconButton } from '../../components/ui/Button.jsx';
import { StatCard } from '../../components/ui/Card.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import DoctorPrescriptionPadModal from '../../components/DoctorPrescriptionPadModal.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const EMPTY_MED = { medicineName: '', dosage: '', route: 'oral', frequency: '', duration: '', instructions: '' };

const DENTAL_RX_PROTOCOLS = [
  {
    id: 'standard-extraction',
    name: 'Standard Extraction / Pulpitis',
    desc: 'Amoxicillin 500mg + Zerodol-P + Pan-40',
    tag: 'Routine Rx',
    meds: [
      { medicineName: 'Amoxicillin 500mg Capsule', dosage: '500mg', route: 'oral', frequency: 'TID (3 times/day)', duration: '5 days', instructions: 'Take 1 capsule every 8 hours after meals' },
      { medicineName: 'Zerodol-P (Aceclofenac 100mg + Paracetamol 325mg)', dosage: '1 tablet', route: 'oral', frequency: 'BID (2 times/day)', duration: '3 days', instructions: 'Take 1 tablet after food for dental pain' },
      { medicineName: 'Pantoprazole 40mg (Pan-40)', dosage: '40mg', route: 'oral', frequency: 'OD (Once daily)', duration: '5 days', instructions: 'Take on empty stomach 30 mins before breakfast' }
    ]
  },
  {
    id: 'severe-infection',
    name: 'Severe Abscess / Cellulitis',
    desc: 'Augmentin 625mg + Metrogyl + Zerodol-SP',
    tag: 'Acute Infection',
    meds: [
      { medicineName: 'Augmentin 625mg (Amox 500mg + Clav 125mg)', dosage: '625mg', route: 'oral', frequency: 'BID (2 times/day)', duration: '5 days', instructions: 'Take 1 tablet every 12 hours after food' },
      { medicineName: 'Metronidazole 400mg (Flagyl / Metrogyl)', dosage: '400mg', route: 'oral', frequency: 'TID (3 times/day)', duration: '5 days', instructions: 'Take with food; strictly avoid alcohol' },
      { medicineName: 'Zerodol-SP (Aceclo + Para + Serratiopeptidase)', dosage: '1 tablet', route: 'oral', frequency: 'BID (2 times/day)', duration: '3 days', instructions: 'Take after meals for pain & severe facial edema' },
      { medicineName: 'Pantoprazole 40mg (Pan-40)', dosage: '40mg', route: 'oral', frequency: 'OD (Once daily)', duration: '5 days', instructions: 'Take on empty stomach in morning' }
    ]
  },
  {
    id: 'penicillin-allergy',
    name: 'Penicillin Allergy Safe',
    desc: 'Clindamycin 300mg + Ibuprofen 400mg',
    tag: 'Penicillin Allergy',
    meds: [
      { medicineName: 'Clindamycin 300mg Capsule (Dalacin C)', dosage: '300mg', route: 'oral', frequency: 'QID (every 6 hours)', duration: '5 days', instructions: 'Take with a full glass of water; safe for penicillin allergy' },
      { medicineName: 'Ibuprofen 400mg + Paracetamol 325mg', dosage: '1 tablet', route: 'oral', frequency: 'TID (3 times/day)', duration: '3 days', instructions: 'Take after meals for pain relief' },
      { medicineName: 'Rabeprazole 20mg (Razo-20)', dosage: '20mg', route: 'oral', frequency: 'OD (Once daily)', duration: '5 days', instructions: 'Take before breakfast' }
    ]
  },
  {
    id: 'periodontal-rinse',
    name: 'Periodontal & Scaling Protocol',
    desc: 'Chlorhexidine 0.2% Rinse + Vitamin C',
    tag: 'Gingival Care',
    meds: [
      { medicineName: 'Chlorhexidine Gluconate 0.2% Oral Rinse (Hexidine)', dosage: '10ml', route: 'oral', frequency: 'BID (Morning & Night)', duration: '14 days', instructions: 'Swish undiluted for 60 seconds after brushing; do not rinse with water for 30 mins' },
      { medicineName: 'Vitamin C 500mg (Limcee Chewable)', dosage: '500mg', route: 'oral', frequency: 'OD (Once daily)', duration: '15 days', instructions: 'Chew 1 tablet daily to promote tissue healing' }
    ]
  },
  {
    id: 'ulcer-mucosal',
    name: 'Oral Ulcers & Stomatitis',
    desc: 'Triamcinolone 0.1% Paste + Becosules Z',
    tag: 'Ulcer Relief',
    meds: [
      { medicineName: 'Triamcinolone Acetonide 0.1% Paste (Kenalog in Orabase)', dosage: 'Small dab', route: 'topical', frequency: 'TID (3 times/day)', duration: '7 days', instructions: 'Apply thin layer to ulcer after meals and at bedtime; do not rub in' },
      { medicineName: 'Becosules Z (B-Complex + Zinc)', dosage: '1 capsule', route: 'oral', frequency: 'OD (Once daily)', duration: '15 days', instructions: 'Take after breakfast' }
    ]
  }
];

export default function PrescriptionsPage() {
  const { user, has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ start: '', end: '' });
  const [dentistFilter, setDentistFilter] = useState('');
  const [sort, setSort] = useState({ key: 'prescriptionDate', order: 'desc' });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'thisMonth' | 'followUp'
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState(null);
  const [consultationId, setConsultationId] = useState(null);
  const [dentistId, setDentistId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [allergiesNoted, setAllergiesNoted] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [safetyFlags, setSafetyFlags] = useState([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [medicines, setMedicines] = useState([{ ...EMPTY_MED }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', category: '' });
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState(null);
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [stylusPadOpen, setStylusPadOpen] = useState(false);

  const dentists = useDentists();
  const today = todayISO();

  const templatesQuery = useQuery({
    queryKey: ['prescription-templates'],
    queryFn: async () => (await api.get('/prescriptions/templates')).data,
    enabled: open,
    staleTime: 60_000
  });

  const medicinesQuery = useQuery({
    queryKey: ['medicine-master'],
    queryFn: async () => (await api.get('/prescriptions/medicines')).data,
    enabled: open,
    staleTime: 10 * 60_000
  });

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      if (params.get('patientId')) {
        api.get(`/patients/${params.get('patientId')}`).then((res) => {
          setPatient(res.data);
          setAllergiesNoted(res.data.allergies || '');
        }).catch(() => { });
      }
      setConsultationId(params.get('consultationId') || null);
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('patientId');
      next.delete('consultationId');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => (await api.get('/prescriptions')).data
  });

  const all = data || [];
  const monthStart = `${today.slice(0, 7)}-01`;

  const summary = useMemo(() => {
    const thisMonth = all.filter((p) => String(p.prescriptionDate || '').slice(0, 10) >= monthStart).length;
    const followUps = all.filter((p) => p.followUpDate && String(p.followUpDate).slice(0, 10) >= today).length;
    const patients = new Set(all.map((p) => p.patientId).filter(Boolean)).size;
    return { total: all.length, thisMonth, followUps, patients };
  }, [all, monthStart, today]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (q && !(
        p.patientName?.toLowerCase().includes(q) ||
        p.prescriptionNo?.toLowerCase().includes(q) ||
        p.patientNo?.toLowerCase().includes(q) ||
        p.dentistName?.toLowerCase().includes(q)
      )) return false;
      if (dentistFilter && p.dentistId !== dentistFilter) return false;
      const d = String(p.prescriptionDate || '').slice(0, 10);
      if (range.start && d < range.start) return false;
      if (range.end && d > range.end) return false;
      if (activeTab === 'thisMonth' && d < monthStart) return false;
      if (activeTab === 'followUp' && (!p.followUpDate || String(p.followUpDate).slice(0, 10) < today)) return false;
      return true;
    });
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sort.key === 'itemCount') return (Number(av) - Number(bv)) * dir;
      if (sort.key === 'prescriptionDate' || sort.key === 'followUpDate') {
        return (new Date(av) - new Date(bv)) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [all, search, dentistFilter, range, sort, activeTab, monthStart, today]);

  const setMed = (idx, patch) => setMedicines((list) => list.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const filledCount = medicines.filter((m) => m.medicineName.trim()).length;

  const medLabel = (m) => `${m.name}${m.strength ? ` ${m.strength}` : ''}`;

  const applyTemplate = (id) => {
    setTemplateId(id);
    const template = (templatesQuery.data || []).find((t) => t.id === id);
    if (!template) return;
    const items = (template.items || []).map((item) => ({ ...EMPTY_MED, ...item }));
    const hasFilled = medicines.some((m) => m.medicineName.trim());
    setMedicines(hasFilled ? [...medicines.filter((m) => m.medicineName.trim()), ...items] : items);
    if (template.instructions) {
      setNotes((prev) => (prev.trim() ? `${prev}\n\n${template.instructions}` : template.instructions));
    }
    toast.success(`Template “${template.name}” applied`);
    setTemplateId('');
  };

  const applyMedicineDefaults = (idx, value) => {
    const text = value.trim().toLowerCase();
    if (!text) return;
    const match = (medicinesQuery.data || []).find(
      (m) => medLabel(m).toLowerCase() === text || m.name.toLowerCase() === text
    );
    if (!match) return;
    setMedicines((list) => list.map((m, i) => {
      if (i !== idx) return m;
      return {
        ...m,
        medicineName: medLabel(match),
        dosage: m.dosage || match.defaultDosage || '',
        route: m.route || match.defaultRoute || 'oral',
        frequency: m.frequency || match.defaultFrequency || '',
        duration: m.duration || match.defaultDuration || '',
        instructions: m.instructions || match.defaultInstructions || ''
      };
    }));
  };

  const openSaveTemplate = () => {
    const items = medicines.filter((m) => m.medicineName.trim());
    if (!items.length) {
      toast.error('Add at least one medicine before saving a template');
      return;
    }
    setTemplateForm({ name: '', category: '' });
    setTemplateError(null);
    setSaveTemplateOpen(true);
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim()) return setTemplateError('Give the template a name.');
    const items = medicines.filter((m) => m.medicineName.trim());
    if (!items.length) return setTemplateError('Add at least one medicine.');
    setTemplateBusy(true);
    setTemplateError(null);
    try {
      await api.post('/prescriptions/templates', {
        name: templateForm.name.trim(),
        category: templateForm.category.trim() || null,
        instructions: notes.trim() || null,
        items: items.map((m) => ({
          medicineName: m.medicineName.trim(),
          dosage: m.dosage || null,
          route: m.route || null,
          frequency: m.frequency || null,
          duration: m.duration || null,
          instructions: m.instructions || null
        }))
      });
      await queryClient.invalidateQueries({ queryKey: ['prescription-templates'] });
      toast.success(`Template “${templateForm.name.trim()}” saved`);
      setSaveTemplateOpen(false);
    } catch (err) {
      setTemplateError(err.message);
    } finally {
      setTemplateBusy(false);
    }
  };

  const deleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await api.delete(`/prescriptions/templates/${templateToDelete.id}`);
      await queryClient.invalidateQueries({ queryKey: ['prescription-templates'] });
      toast.success(`Template “${templateToDelete.name}” removed`);
      setTemplateToDelete(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const save = async () => {
    setError(null);
    if (!patient?.id) return setError('Select a patient');
    if (user.role !== 'dentist' && !dentistId) return setError('Select the prescribing dentist');
    const items = medicines.filter((m) => m.medicineName.trim());
    if (!items.length) return setError('Add at least one medicine');
    setSaving(true);
    try {
      const safety = await api.post('/prescriptions/safety-check', {
        patientId: patient.id,
        items: items.map((m) => ({ medicineName: m.medicineName.trim(), dosage: m.dosage || null, route: m.route || null, frequency: m.frequency || null, duration: m.duration || null, instructions: m.instructions || null }))
      });
      const flags = safety.data?.flags || [];
      setSafetyFlags(flags);
      let reason = overrideReason;
      if (flags.some((f) => f.severity === 'major') && !reason) {
        reason = window.prompt('Major safety warning. Enter an override reason to proceed:') || '';
        if (!reason) { setError('Override reason is required for major safety warnings.'); setSaving(false); return; }
        setOverrideReason(reason);
      }
      const res = await api.post('/prescriptions', {
        patientId: patient.id,
        consultationId: consultationId || undefined,
        dentistId: user.role === 'dentist' ? undefined : dentistId,
        prescriptionDate: date,
        allergiesNoted: allergiesNoted || null,
        notes: notes || null,
        followUpDate: followUpDate || null,
        safetyOverrideReason: reason || null,
        items: items.map((m) => ({
          medicineName: m.medicineName.trim(),
          dosage: m.dosage || null,
          route: m.route || null,
          frequency: m.frequency || null,
          duration: m.duration || null,
          instructions: m.instructions || null
        }))
      });
      toast.success(`Prescription ${res.data.prescriptionNo} recorded`);
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      setOpen(false);
      resetForm();
      openBlob(`/prescriptions/${res.data.id}/pdf`, `${res.data.prescriptionNo}.pdf`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  function resetForm() {
    setPatient(null);
    setConsultationId(null);
    setDentistId('');
    setAllergiesNoted('');
    setNotes('');
    setFollowUpDate('');
    setSafetyFlags([]);
    setOverrideReason('');
    setMedicines([{ ...EMPTY_MED }]);
    setDate(todayISO());
  }

  const openNew = () => {
    resetForm();
    setError(null);
    setOpen(true);
  };

  const openStylusPad = () => {
    setStylusPadOpen(true);
  };

  const handleSaveStylusPrescription = async ({ notes: padNotes, handwritingData, followUpDays }) => {
    if (!patient) {
      toast.error('Please pick a patient first from the form before writing prescription');
      setOpen(true);
      return;
    }
    try {
      const res = await api.post('/prescriptions', {
        patientId: patient.id,
        consultationId: consultationId || undefined,
        dentistId: user.role === 'dentist' ? undefined : (dentistId || undefined),
        prescriptionDate: date || todayISO(),
        allergiesNoted: allergiesNoted || null,
        notes: padNotes || 'Doctor Stylus Prescription',
        handwritingData: handwritingData || null,
        followUpDate: followUpDays ? addDaysISO(todayISO(), Number(followUpDays)) : null,
        items: filledCount > 0 ? medicines.filter((m) => m.medicineName.trim()).map((m) => ({
          medicineName: m.medicineName.trim(),
          dosage: m.dosage || null,
          route: m.route || null,
          frequency: m.frequency || null,
          duration: m.duration || null,
          instructions: m.instructions || null
        })) : [
          {
            medicineName: 'Digital Stylus Prescription Attached',
            dosage: 'As instructed',
            route: 'oral',
            frequency: 'See handwritten pad',
            duration: `${followUpDays} days`,
            instructions: 'Follow clinical handwriting on prescription sheet'
          }
        ]
      });
      toast.success(`Digital prescription ${res.data.prescriptionNo} recorded`);
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      setStylusPadOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeNew = () => {
    if (saving) return;
    setOpen(false);
    resetForm();
  };

  const columns = [
    {
      key: 'prescriptionNo',
      label: 'Prescription',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-mono text-[11.5px] font-bold text-navy">{r.prescriptionNo}</p>
          <p className="mt-0.5 text-[10.5px] text-slate-400 font-medium">{formatDate(r.prescriptionDate)}</p>
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
            <p className="text-[10.5px] font-mono text-slate-400">{r.patientNo}</p>
          </div>
        </div>
      )
    },
    {
      key: 'dentistName',
      label: 'Prescribed by',
      sortable: true,
      render: (r) => (
        <span className="text-[12px] font-medium text-slate-700">
          Dr. {r.dentistName}
        </span>
      )
    },
    {
      key: 'itemCount',
      label: 'Rx Items',
      align: 'center',
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200">
          <Pill size={11} className="text-violet-500" />
          {r.itemCount} med{r.itemCount === 1 ? '' : 's'}
        </span>
      )
    },
    {
      key: 'followUpDate',
      label: 'Review Date',
      sortable: true,
      render: (r) =>
        r.followUpDate ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${String(r.followUpDate).slice(0, 10) < today ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-700'}`}>
            <CalendarClock size={11} /> {formatDate(r.followUpDate)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          variant="secondary"
          icon={Download}
          onClick={(e) => { e.stopPropagation(); openBlob(`/prescriptions/${r.id}/pdf`, `${r.prescriptionNo}.pdf`); }}
        >
          Print PDF
        </Button>
      )
    }
  ];

  const filtered = Boolean(search.trim() || dentistFilter || range.start || range.end);

  const statusTabs = [
    { key: 'all', label: 'All Prescriptions', count: summary.total },
    { key: 'thisMonth', label: 'Dispensed This Month', count: summary.thisMonth, isMonth: true },
    { key: 'followUp', label: 'Review Scheduled', count: summary.followUps, isReview: true }
  ];

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
                <h1 className="text-2xl font-black tracking-tight">Dental Prescriptions &amp; Digital Rx Master</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  CDSCO / Dental Council Compliant
                </span>
              </div>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                Chairside dental e-prescribing, drug-allergy safety validation, digital prescription slips, and instant 1-click dental protocols.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {has('prescriptions.manage') && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!patient) {
                      setOpen(true);
                      toast.info('Select a patient first, then tap "Doctor Stylus Pad"');
                    } else {
                      setStylusPadOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.02] border border-white/25 shadow-sm"
                >
                  <Pencil size={15} />
                  Doctor Stylus Pad
                </button>
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-[#0a7f8b] shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02]"
                >
                  <Plus size={16} className="text-[#0a7f8b]" />
                  New Prescription
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards (Matches Waiting Queue Screenshot 1:1) ────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DoccureKpiCard
          title="SCHEDULED VISITS"
          value={summary.total}
          subtitle="on roster"
          icon={Pill}
          variant="teal"
        />
        <DoccureKpiCard
          title="WAITING LOUNGE"
          value={summary.thisMonth}
          subtitle="triage checked-in"
          icon={Clock3}
          variant="amber"
        />
        <DoccureKpiCard
          title="IN OPERATORY CHAIR"
          value={summary.followUps}
          subtitle="active care"
          icon={CalendarClock}
          variant="purple"
          hasDot={true}
        />
        <DoccureKpiCard
          title="COMPLETED CARE"
          value={summary.patients}
          subtitle="treated today"
          icon={CheckCircle2}
          variant="emerald"
        />
      </div>

      {/* ── Main Container: Status Tabs + Filters + Records ─────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        
        {/* Status Quick Filter Tabs */}
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Pill Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {statusTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black transition-all ${
                      isActive
                        ? 'bg-[#0a7f8b] text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : tab.isMonth
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : tab.isReview
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card Grid View"
                className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-[#0a7f8b] shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <List size={14} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Controls & Search Toolbar */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, prescription #, patient ID or doctor..."
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-10 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 transition focus:border-[#0a7f8b] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                start={range.start}
                end={range.end}
                onChange={(start, end) => setRange({ start, end })}
                className="hidden md:flex"
              />

              <select
                value={dentistFilter}
                onChange={(e) => setDentistFilter(e.target.value)}
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:border-[#0a7f8b] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Filter by dentist"
              >
                <option value="">All prescribers</option>
                {(dentists.data || []).map((d) => <option key={d.id} value={d.id}>Dr. {d.fullName}</option>)}
              </select>

              <IconButton
                icon={RefreshCw}
                label="Refresh prescriptions"
                size="sm"
                variant="secondary"
                onClick={() => refetch()}
                disabled={isFetching}
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'cards' ? (
          <div className="p-6">
            {isLoading ? (
              <div className="py-20 text-center">
                <RefreshCw size={24} className="mx-auto animate-spin text-[#0a7f8b]" />
                <p className="mt-3 text-xs font-bold text-slate-500">Loading prescription slips...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300">
                  <Pill size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">No prescriptions found</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {search || dentistFilter || range.start ? 'No records match your active search or filters.' : 'Issue your first dental prescription slip.'}
                </p>
                {has('prescriptions.manage') && (
                  <button
                    type="button"
                    onClick={openNew}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8] px-4 py-2 text-xs font-black text-white shadow-md hover:opacity-95 transition"
                  >
                    <Plus size={15} />
                    Issue First Prescription
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((r) => (
                  <article
                    key={r.id}
                    className="group relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#14b8c8]/50 hover:shadow-[0_16px_36px_-12px_rgba(10,127,139,0.22)] dark:border-slate-800 dark:bg-slate-850"
                  >
                    <div>
                      {/* Top: Rx # & Med Count Badge */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100/80 pb-3 dark:border-slate-800">
                        <span className="font-mono text-xs font-black text-[#0a7f8b] dark:text-teal-300">
                          {r.prescriptionNo}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-black text-[#0a7f8b] border border-teal-200/60 dark:bg-teal-950/60 dark:border-teal-800">
                          <Pill size={11} />
                          {r.itemCount} med{r.itemCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Patient Identity */}
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
                            {r.patientNo}
                          </p>
                        </div>
                      </div>

                      {/* Doctor & Date */}
                      <div className="mt-3.5 space-y-1.5 rounded-2xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">Prescriber:</span>
                          <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Stethoscope size={12} className="text-[#0a7f8b]" />
                            Dr. {r.dentistName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">Date:</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {formatDate(r.prescriptionDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Review & Print PDF Button */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {r.followUpDate ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-[11px] font-black text-purple-700 dark:bg-purple-950/40">
                          <CalendarClock size={12} />
                          Review: {formatDate(r.followUpDate)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">No review date</span>
                      )}

                      <button
                        type="button"
                        onClick={() => openBlob(`/prescriptions/${r.id}/pdf`, `${r.prescriptionNo}.pdf`)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 transition shadow-xs"
                      >
                        <Download size={13} />
                        Print PDF
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={queryError}
            onRetry={refetch}
            sort={sort}
            onSortChange={setSort}
            emptyTitle={filtered ? 'No matching prescriptions' : 'No prescriptions'}
            emptyMessage={
              filtered
                ? 'Adjust the search, dentist or date range to find the prescription you need.'
                : 'Prescriptions issued by dentists will appear here.'
            }
            emptyAction={!filtered && has('prescriptions.manage') ? <Button size="sm" variant="secondary" icon={Plus} onClick={openNew}>New prescription</Button> : null}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-4 py-3">
                <span>{rows.length} of {summary.total} prescription{summary.total === 1 ? '' : 's'}</span>
                <span className="hidden sm:inline">Most recent prescriptions appear first by default</span>
              </div>
            }
          />
        )}
      </div>

      <Modal
        open={open}
        onClose={closeNew}
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-[#0a7f8b] shadow-inner dark:bg-teal-500/20">
              <Pill size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Issue Clinical Prescription
                </h3>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#0a7f8b] border border-teal-200/80 dark:bg-teal-950/60 dark:border-teal-800">
                  Rx Authoring
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Every prescription must be reviewed and certified by the prescribing dentist.
              </p>
            </div>
          </div>
        }
        size="xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (!patient) {
                  toast.error('Select a patient before opening stylus pad');
                  return;
                }
                setStylusPadOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-teal-200/80 bg-teal-50/70 px-4 py-2.5 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300 transition shadow-2xs cursor-pointer"
            >
              <Pencil size={14} className="stroke-[2.5]" />
              Open Tablet Stylus Pad (Draw &amp; Write)
            </button>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={closeNew}
                disabled={saving}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition shadow-2xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a7f8b] to-[#08636d] px-6 py-2.5 text-xs font-black text-white hover:opacity-95 shadow-md shadow-teal-700/25 transition disabled:opacity-50 cursor-pointer"
              >
                <Pill size={15} />
                {saving ? 'Saving...' : 'Save & Print PDF'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Card 1: Patient & Clinician Information */}
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-slate-50/80 p-4 shadow-xs dark:bg-slate-900/60 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <UserCheck size={14} className="text-[#0a7f8b]" />
                Patient &amp; Clinician Context
              </span>
              {patient && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-black text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  Patient Identified: {patient.fullName || patient.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <PatientPicker
                value={patient}
                onChange={(p) => {
                  setPatient(p);
                  setAllergiesNoted('');
                  if (p?.id) {
                    api.get(`/patients/${p.id}`)
                      .then((res) => setAllergiesNoted(res.data.allergies || ''))
                      .catch(() => { });
                  }
                }}
                required
              />
              {user.role !== 'dentist' ? (
                <Select label="Prescribing dentist" required value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
                  <option value="">Select dentist…</option>
                  {(dentists.data || []).map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                </Select>
              ) : (
                <div>
                  <p className="mb-1.5 text-[11.5px] font-bold text-slate-600 dark:text-slate-300">Prescribing Dentist</p>
                  <div className="flex h-[38px] items-center gap-2 rounded-xl border border-teal-200/80 bg-teal-50/40 px-3 text-xs font-bold text-[#0a7f8b] dark:bg-teal-950/30 dark:border-teal-800">
                    <Stethoscope size={14} />
                    {user.fullName || 'Signed-in dentist'}
                  </div>
                </div>
              )}
              <Input label="Prescription date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Follow-up review date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
          </div>

          {/* Safety Flags and Allergy Banner */}
          {safetyFlags.length > 0 && (
            <div className="rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50/90 via-red-50/40 to-white p-4 text-[12px] text-red-900 shadow-xs dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-red-600 dark:text-red-400" />
                  <p className="font-black text-red-950 dark:text-red-100">Medication Safety Advisory Warning</p>
                </div>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-red-800 dark:bg-red-900/60 dark:text-red-200">
                  {safetyFlags.length} Rule Alert{safetyFlags.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
                Advisory check cross-referenced against recorded allergies and known drug interaction rules. Clinician discretion required.
              </p>
              <ul className="mt-2.5 list-disc pl-5 space-y-1 text-xs">
                {safetyFlags.map((f, i) => (
                  <li key={i}>
                    <strong className="text-red-950 dark:text-red-100">{f.title}</strong> — {f.detail}
                  </li>
                ))}
              </ul>
              {safetyFlags.some((f) => f.severity === 'major') && (
                <div className="mt-3 pt-3 border-t border-red-200/80 dark:border-red-800">
                  <label className="text-xs font-bold text-red-950 dark:text-red-100">Clinician Override Reason (Required for Major Flags)</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none dark:bg-slate-900 dark:text-white dark:border-red-800"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Document clinical justification for overriding major advisory warning..."
                  />
                </div>
              )}
            </div>
          )}

          {patient?.allergies && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-amber-50/40 p-3.5 text-xs text-amber-900 shadow-xs dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-black text-amber-950 dark:text-amber-100">Recorded Patient Allergy: {patient.allergies}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  Clinical safety checks cross-reference this against prescribed drugs. Always verify brand variants and full patient allergy history.
                </p>
              </div>
            </div>
          )}

          {/* Notes and Allergy Inputs */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Textarea
              label="Allergy warnings noted"
              rows={2}
              value={allergiesNoted}
              onChange={(e) => setAllergiesNoted(e.target.value)}
              placeholder="Known allergies reviewed with the patient"
              hint="Printed prominently on the final prescription sheet."
            />
            <Textarea
              label="Patient instructions & notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special oral rinse, diet instructions, or warm saline advice..."
            />
          </div>

          {/* 1-Click Dental Clinical Rx Regimens */}
          <div className="rounded-2xl border border-teal-100/80 bg-gradient-to-br from-teal-50/50 via-cyan-50/20 to-white p-4 shadow-xs dark:from-teal-950/20 dark:via-slate-900/40 dark:to-slate-900 dark:border-teal-900/50">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-teal-100/60 pb-2.5 dark:border-teal-900/40">
              <span className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-white">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/10 text-[#0a7f8b]">
                  <Sparkles size={13} className="stroke-[2.5]" />
                </div>
                1-Click Dental Clinical Rx Protocols
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Click any regimen to auto-fill standard dosages, frequencies & directions
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {DENTAL_RX_PROTOCOLS.map((proto) => {
                const tagColor =
                  proto.tag === 'Routine Rx'
                    ? 'bg-teal-50 text-[#0a7f8b] border-teal-200 dark:bg-teal-950/60 dark:text-teal-300'
                    : proto.tag === 'Acute Infection'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                    : proto.tag === 'Penicillin Allergy'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                    : proto.tag === 'Periodontal'
                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300';

                return (
                  <button
                    key={proto.id}
                    type="button"
                    onClick={() => {
                      setMedicines(proto.meds.map((m) => ({ ...m })));
                      toast.success(`Loaded ${proto.name} protocol`);
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-3 text-left shadow-2xs hover:border-[#0a7f8b] hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group dark:bg-slate-850 dark:border-slate-800"
                  >
                    <div>
                      <div className="flex w-full items-start justify-between gap-1">
                        <span className="text-xs font-black text-slate-900 group-hover:text-[#0a7f8b] transition-colors leading-snug dark:text-white">
                          {proto.name}
                        </span>
                      </div>
                      <span className={`mt-1.5 inline-block rounded-md border px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${tagColor}`}>
                        {proto.tag}
                      </span>
                      <p className="mt-2 text-[10.5px] text-slate-500 font-medium line-clamp-2 leading-relaxed dark:text-slate-400">
                        {proto.desc}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-black text-[#0a7f8b] group-hover:underline dark:border-slate-800">
                      <span>Load {proto.meds.length} drugs</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Medicines Master Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            {/* Top Bar: Templates */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <LayoutTemplate size={15} className="shrink-0 text-[#0a7f8b]" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">Clinic Rx Templates</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                  aria-label="Apply prescription template"
                >
                  <option value="">Apply a template…</option>
                  {(templatesQuery.data || []).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openSaveTemplate}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition"
                >
                  <BookmarkPlus size={13} className="text-[#0a7f8b]" />
                  Save as template
                </button>
                <button
                  type="button"
                  onClick={() => setManageTemplatesOpen(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition"
                >
                  <Pencil size={12} />
                  Manage
                </button>
              </div>
            </div>

            <datalist id="medicine-master-options">
              {(medicinesQuery.data || []).map((m) => (
                <option key={m.id} value={medLabel(m)}>{[m.form, m.category].filter(Boolean).join(' · ')}</option>
              ))}
            </datalist>

            {/* Medicines List Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Prescribed Medications</p>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-black text-[#0a7f8b] border border-teal-200/60 dark:bg-teal-950/60">
                  {filledCount} active
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMedicines((l) => [...l, { ...EMPTY_MED }])}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-black text-[#0a7f8b] hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 transition shadow-2xs"
              >
                <Plus size={14} className="stroke-[2.5]" />
                Add Medicine
              </button>
            </div>

            {/* Grid Table Header */}
            <div className="hidden grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[10.5px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800/40 dark:border-slate-800 md:grid">
              <span className="col-span-3">Medicine Name</span>
              <span className="col-span-2">Dosage</span>
              <span className="col-span-1">Route</span>
              <span className="col-span-1">Frequency</span>
              <span className="col-span-1">Duration</span>
              <span className="col-span-3">Instructions</span>
              <span className="col-span-1 text-right">Action</span>
            </div>

            {/* Grid Table Rows */}
            <div className="space-y-2.5 p-3">
              {medicines.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2 rounded-xl bg-slate-50/40 p-2 hover:bg-slate-50/90 dark:bg-slate-800/30 dark:hover:bg-slate-800/60 transition">
                  <div className="col-span-12 md:col-span-3">
                    <input
                      value={m.medicineName}
                      onChange={(e) => setMed(idx, { medicineName: e.target.value })}
                      onBlur={(e) => applyMedicineDefaults(idx, e.target.value)}
                      list="medicine-master-options"
                      placeholder="e.g. Amoxicillin 500mg"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      aria-label="Medicine name"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      value={m.dosage}
                      onChange={(e) => setMed(idx, { dosage: e.target.value })}
                      placeholder="500 mg / 1 tab"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      aria-label="Dosage"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <select
                      value={m.route}
                      onChange={(e) => setMed(idx, { route: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-1.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white capitalize"
                      aria-label="Route"
                    >
                      {['oral', 'topical', 'sublingual', 'injection', 'rinse', 'other'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <input
                      value={m.frequency}
                      onChange={(e) => setMed(idx, { frequency: e.target.value })}
                      placeholder="TID / 1-0-1"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      aria-label="Frequency"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <input
                      value={m.duration}
                      onChange={(e) => setMed(idx, { duration: e.target.value })}
                      placeholder="5 days"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      aria-label="Duration"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <input
                      value={m.instructions}
                      onChange={(e) => setMed(idx, { instructions: e.target.value })}
                      placeholder="After food / with full glass of water"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0a7f8b] focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      aria-label="Instructions"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end md:col-span-1">
                    <button
                      type="button"
                      disabled={medicines.length === 1}
                      onClick={() => setMedicines((l) => (l.length === 1 ? l : l.filter((_, i) => i !== idx)))}
                      className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 dark:hover:bg-rose-950/40"
                      aria-label="Remove medicine"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200">
              {error}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
            Templates and medicine suggestions are clinical defaults configured by your clinic. Dosages are starting recommendations — the licensed prescribing dentist must clinically verify each line before final issuance.
          </p>
        </div>
      </Modal>

      <Modal
        open={saveTemplateOpen}
        onClose={() => !templateBusy && setSaveTemplateOpen(false)}
        title="Save as prescription template"
        subtitle="Reuse this medicine set for future visits. Every prescription is still reviewed by the dentist."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveTemplateOpen(false)} disabled={templateBusy}>Cancel</Button>
            <Button icon={BookmarkPlus} onClick={saveTemplate} loading={templateBusy}>Save template</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label="Template name" required value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Post-extraction care" />
            <Input label="Category" value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} placeholder="e.g. Surgery" />
          </div>
          <div className="rounded-lg border border-line bg-slate-50/60 p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-500">Medicines in this template</p>
            <ul className="mt-2 space-y-1">
              {medicines.filter((m) => m.medicineName.trim()).map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
                  <Pill size={12} className="text-accent-600" />
                  <span className="font-medium text-ink">{m.medicineName}</span>
                  <span className="text-[10.5px] text-slate-400">{[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-slate-500">The current notes field is saved as the template's patient instructions.</p>
          {templateError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{templateError}</p>}
        </div>
      </Modal>

      <Modal
        open={manageTemplatesOpen}
        onClose={() => setManageTemplatesOpen(false)}
        title="Prescription templates"
        subtitle="Templates configured by this clinic. Deleting a template does not change prescriptions already issued."
        footer={<Button variant="secondary" onClick={() => setManageTemplatesOpen(false)}>Close</Button>}
      >
        {(templatesQuery.data || []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12px] text-slate-500">
            No templates yet. Fill the medicines list and choose “Save as template”.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {(templatesQuery.data || []).map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink">{t.name}</p>
                  <p className="text-[10.5px] text-slate-500">
                    {t.category ? `${t.category} · ` : ''}{t.items?.length || 0} medicine{(t.items?.length || 0) === 1 ? '' : 's'}
                  </p>
                  {t.instructions && <p className="mt-0.5 line-clamp-2 text-[10.5px] text-slate-400">{t.instructions}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  className="shrink-0 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setTemplateToDelete(t)}
                  aria-label={`Delete ${t.name}`}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(templateToDelete)}
        onClose={() => setTemplateToDelete(null)}
        title="Delete prescription template"
        message={templateToDelete ? `“${templateToDelete.name}” will be removed from the template list. Prescriptions already issued are not affected.` : ''}
        confirmLabel="Delete template"
        tone="danger"
        onConfirm={deleteTemplate}
      />

      <DoctorPrescriptionPadModal
        isOpen={stylusPadOpen}
        onClose={() => setStylusPadOpen(false)}
        patient={patient}
        dentistName={user?.fullName || 'Dr. Sarah Jenkins'}
        initialNotes={notes}
        onSavePrescription={handleSaveStylusPrescription}
      />
    </div>
  );
}
