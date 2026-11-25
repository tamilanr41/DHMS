import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Camera, CheckCircle2, ClipboardList, FileText, HeartPulse, IdCard, ImagePlus,
  Lock, Phone, Save, ShieldCheck, Trash2, Upload, UserPlus, UserRound, Wallet,
  AlertTriangle, Sparkles, Activity, Pill, Stethoscope, ChevronRight, ChevronLeft,
  Flame, Check, Droplet, MapPin, Building, ShieldAlert, AlertCircle, Smile, Meh, Frown
} from 'lucide-react';
import { api, ApiError } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Textarea, Select, Checkbox, FormRow } from '../../components/ui/Input.jsx';
import { Card } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/States.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import PatientAvatar from '../../components/PatientAvatar.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.jsx';
import { ageFromDob, formatDate, humanize } from '../../utils/format.js';
import heroTooth from '../../assets/dental/hero-tooth.svg';

export const ID_PROOF_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar card', placeholder: '1234 5678 9012', hint: '12 digits', pattern: /^\d{4}\s?\d{4}\s?\d{4}$/ },
  { value: 'pan', label: 'PAN card', placeholder: 'ABCDE1234F', hint: '5 letters, 4 digits, 1 letter', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/i },
  { value: 'passport', label: 'Passport', placeholder: 'M1234567', hint: '1 letter followed by 7 digits', pattern: /^[A-Z][0-9]{7}$/i },
  { value: 'driving_license', label: 'Driving licence', placeholder: 'DL-0420110149646', hint: '8–20 letters, digits or dashes', pattern: /^[A-Z0-9\-\s]{8,20}$/i },
  { value: 'voter_id', label: 'Voter ID', placeholder: 'ABC1234567', hint: '3 letters followed by 7 digits', pattern: /^[A-Z]{3}[0-9]{7}$/i },
  { value: 'ration_card', label: 'Ration card', placeholder: 'Card number', hint: '5–20 characters', pattern: /^[A-Z0-9/\-\s]{5,20}$/i },
  { value: 'other', label: 'Other government ID', placeholder: 'Document number', hint: 'At least 3 characters', pattern: /^.{3,40}$/ }
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'other', label: 'Other' }
];

const DENTAL_COMPLAINTS = [
  { id: 'toothache', label: 'Toothache / Severe Pain', icon: '⚡' },
  { id: 'bleeding_gums', label: 'Bleeding / Sensitive Gums', icon: '🩸' },
  { id: 'broken_tooth', label: 'Broken / Chipped Tooth', icon: '🦷' },
  { id: 'scaling', label: 'Cleaning & Polishing (Scaling)', icon: '✨' },
  { id: 'decay', label: 'Cavity / Food Lodgement', icon: '🔍' },
  { id: 'root_canal', label: 'Root Canal Consultation', icon: '🩺' },
  { id: 'implants', label: 'Missing Teeth / Dental Implants', icon: '🔩' },
  { id: 'braces', label: 'Teeth Alignment / Braces / Aligners', icon: '📏' },
  { id: 'wisdom_tooth', label: 'Wisdom Tooth Pain / Swelling', icon: '⚠️' },
  { id: 'whitening', label: 'Cosmetic / Smile Makeover', icon: '💎' },
  { id: 'checkup', label: 'Routine Dental Health Checkup', icon: '📋' }
];

const MEDICAL_ALERTS = [
  { id: 'hypertension', label: 'Hypertension (High BP)', category: 'condition', icon: Activity, tone: 'amber' },
  { id: 'diabetes', label: 'Diabetes (Sugar)', category: 'condition', icon: Activity, tone: 'amber' },
  { id: 'blood_thinners', label: 'On Blood Thinners (Aspirin/Warfarin)', category: 'alert', icon: AlertTriangle, tone: 'rose' },
  { id: 'cardiac', label: 'Heart Condition / Pacemaker', category: 'alert', icon: HeartPulse, tone: 'rose' },
  { id: 'penicillin_allergy', label: 'Allergic to Penicillin / Amoxicillin', category: 'allergy', icon: ShieldAlert, tone: 'rose' },
  { id: 'anesthesia_allergy', label: 'Allergic to Local Anesthesia', category: 'allergy', icon: ShieldAlert, tone: 'rose' },
  { id: 'asthma', label: 'Asthma / Respiratory Condition', category: 'condition', icon: Activity, tone: 'amber' },
  { id: 'pregnancy', label: 'Pregnancy / Lactation (Precaution)', category: 'alert', icon: AlertCircle, tone: 'amber' },
  { id: 'latex_allergy', label: 'Latex / Glove Allergy', category: 'allergy', icon: ShieldAlert, tone: 'rose' },
  { id: 'dental_anxiety', label: 'Severe Dental Anxiety / Phobia', category: 'alert', icon: Frown, tone: 'sky' }
];

const proofConfig = (type) => ID_PROOF_TYPES.find((p) => p.value === type);

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name'),
  mobile: z.string().trim().min(7, 'Enter a valid mobile number').regex(/^[0-9+\-\s()]+$/, 'Only digits, spaces and + - ( ) allowed'),
  alternateMobile: z.string().trim().regex(/^[0-9+\-\s()]*$/, 'Only digits, spaces and + - ( ) allowed').optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  maritalStatus: z.string().optional(),
  occupation: z.string().optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().trim().refine((v) => !v || /^[0-9]{4,10}$/.test(v), 'PIN code must be 4–10 digits').optional(),
  idProofType: z.string().optional(),
  idProofNumber: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  referredBy: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNo: z.string().optional(),
  dataConsent: z.boolean().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
}).superRefine((values, ctx) => {
  const type = values.idProofType;
  const number = (values.idProofNumber || '').trim();
  if (type && !number) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idProofNumber'], message: 'Enter the number printed on the ID' });
    return;
  }
  if (number && !type) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idProofType'], message: 'Select the ID proof type' });
    return;
  }
  const cfg = proofConfig(type);
  if (cfg && number && !cfg.pattern.test(number)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idProofNumber'], message: `Enter a valid ${cfg.label.toLowerCase()} number (${cfg.hint})` });
  }
});

function SectionHeader({ icon: Icon, title, subtitle, badge }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-teal-50/50 via-white to-transparent dark:from-slate-800/40 dark:via-slate-900 px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#0a7f8b] dark:bg-teal-950/60 dark:text-teal-300 shadow-xs">
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400 font-medium">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-[#0a7f8b] border border-teal-200/60 dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-300">
          {badge}
        </span>
      )}
    </div>
  );
}

function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImage(file, maxEdge = 1200, quality = 0.84) {
  if (!file || !/^image\//.test(file.type) || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 450 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob ? new File([blob], 'patient-photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export default function PatientFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { has } = useAuth();
  const photoInputRef = useRef(null);
  const proofInputRef = useRef(null);

  // Stepper state for intake workflow
  const [activeStep, setActiveStep] = useState(1);
  const [mode, setMode] = useState('wizard'); // 'wizard' | 'all'

  // Clinical dental intake state
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [painLevel, setPainLevel] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [customAllergies, setCustomAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [pastDentalSurgeries, setPastDentalSurgeries] = useState('');

  // Duplicates, photos and proofs
  const [duplicates, setDuplicates] = useState(null);
  const [pendingValues, setPendingValues] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofError, setProofError] = useState('');

  const canEdit = has('patients.edit');
  const canUploadDocs = has('patients.documents');

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data,
    enabled: editing
  });
  const patient = patientQuery.data;

  const medicalQuery = useQuery({
    queryKey: ['medical-history', id],
    queryFn: async () => (await api.get(`/patients/${id}/medical-history`)).data,
    enabled: editing
  });

  const documentsQuery = useQuery({
    queryKey: ['patient-documents', id],
    queryFn: async () => (await api.get(`/patients/${id}/documents`)).data,
    enabled: editing && canUploadDocs
  });
  const existingProof = (documentsQuery.data || []).find((d) => d.category === 'id_proof');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isDirty }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '', mobile: '', alternateMobile: '', dob: '', gender: '', bloodGroup: '',
      maritalStatus: '', occupation: '', email: '', address: '', city: '', state: '', pincode: '',
      idProofType: '', idProofNumber: '', emergencyContactName: '', emergencyContactRelation: '',
      emergencyContactPhone: '', referredBy: '', insuranceProvider: '', insurancePolicyNo: '',
      dataConsent: true, notes: '', isActive: true
    }
  });

  const values = watch();

  // Populate form if editing
  useEffect(() => {
    if (patient) {
      reset({
        fullName: patient.fullName || '',
        mobile: patient.mobile || '',
        alternateMobile: patient.alternateMobile || '',
        dob: patient.dob || '',
        gender: patient.gender || '',
        bloodGroup: patient.bloodGroup || '',
        maritalStatus: patient.maritalStatus || '',
        occupation: patient.occupation || '',
        email: patient.email || '',
        address: patient.address || '',
        city: patient.city || '',
        state: patient.state || '',
        pincode: patient.pincode || '',
        idProofType: patient.idProofType || '',
        idProofNumber: patient.idProofNumber || '',
        emergencyContactName: patient.emergencyContactName || '',
        emergencyContactRelation: patient.emergencyContactRelation || '',
        emergencyContactPhone: patient.emergencyContactPhone || '',
        referredBy: patient.referredBy || '',
        insuranceProvider: patient.insuranceProvider || '',
        insurancePolicyNo: patient.insurancePolicyNo || '',
        dataConsent: Boolean(patient.dataConsent),
        notes: patient.notes || '',
        isActive: patient.isActive
      });
      setPhotoFile(null);
      setRemovePhoto(false);
      setProofFile(null);
    }
  }, [patient, reset]);

  // Prepopulate medical history if available
  useEffect(() => {
    if (medicalQuery.data?.current) {
      const cur = medicalQuery.data.current;
      setCustomAllergies(cur.allergies || '');
      setCurrentMedications(cur.medications || '');
      setPastDentalSurgeries(cur.dentalHistory || '');
    }
  }, [medicalQuery.data]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const hasExistingPhoto = Boolean(patient?.hasPhoto) && !removePhoto;
  const hasPhoto = Boolean(photoFile) || hasExistingPhoto;
  const previewPatient = useMemo(() => ({
    id: patient?.id || 'new',
    fullName: values.fullName,
    hasPhoto: hasExistingPhoto
  }), [patient?.id, values.fullName, hasExistingPhoto]);

  const toggleComplaint = (label) => {
    setSelectedComplaints((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const toggleAlert = (alert) => {
    setActiveAlerts((prev) =>
      prev.some((a) => a.id === alert.id) ? prev.filter((a) => a.id !== alert.id) : [...prev, alert]
    );
  };

  const onPhotoChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setPhotoError('Choose a JPEG, PNG or WebP photo');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Photo must be smaller than 8 MB');
      return;
    }
    setPhotoError('');
    setPhotoFile(file);
    setRemovePhoto(false);
  };

  const onProofChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setProofError('Attach a PDF, JPEG, PNG or WebP file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProofError('ID proof must be smaller than 10 MB');
      return;
    }
    setProofError('');
    setProofFile(file);
  };

  const save = async (formValues, confirmDuplicate = false) => {
    // Merge clinical complaints and pain score into notes if not already present
    let compiledNotes = formValues.notes ? formValues.notes.trim() : '';
    if (selectedComplaints.length) {
      const complaintLine = `Chief complaints: ${selectedComplaints.join(', ')}.`;
      if (!compiledNotes.includes('Chief complaints:')) {
        compiledNotes = compiledNotes ? `${compiledNotes}\n${complaintLine}` : complaintLine;
      }
    }
    if (painLevel > 0) {
      const painLine = `Initial Dental Pain Score: ${painLevel}/10.`;
      if (!compiledNotes.includes('Pain Score:')) {
        compiledNotes = compiledNotes ? `${compiledNotes}\n${painLine}` : painLine;
      }
    }

    const payload = {
      ...formValues,
      dob: formValues.dob || null,
      gender: formValues.gender || null,
      bloodGroup: formValues.bloodGroup || null,
      maritalStatus: formValues.maritalStatus || null,
      email: formValues.email || null,
      address: formValues.address || null,
      city: formValues.city || null,
      state: formValues.state || null,
      pincode: formValues.pincode || null,
      idProofType: formValues.idProofType || null,
      idProofNumber: formValues.idProofNumber?.trim() || null,
      emergencyContactName: formValues.emergencyContactName || null,
      emergencyContactRelation: formValues.emergencyContactRelation || null,
      emergencyContactPhone: formValues.emergencyContactPhone || null,
      referredBy: formValues.referredBy || null,
      insuranceProvider: formValues.insuranceProvider || null,
      insurancePolicyNo: formValues.insurancePolicyNo || null,
      alternateMobile: formValues.alternateMobile || null,
      dataConsent: Boolean(formValues.dataConsent),
      notes: compiledNotes || null,
      confirmDuplicate
    };

    let patientId = id;
    try {
      if (editing) {
        await api.patch(`/patients/${id}`, payload);
      } else {
        const res = await api.post('/patients', payload);
        patientId = res.data.id;
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'POSSIBLE_DUPLICATE') {
        setPendingValues(formValues);
        setDuplicates(err.details?.duplicates || []);
        return false;
      }
      toast.error(err.message || 'Could not save patient');
      return false;
    }

    // Save medical history if any clinical data was entered
    const conditionList = activeAlerts.filter((a) => a.category === 'condition').map((a) => a.label);
    const allergyList = [
      ...activeAlerts.filter((a) => a.category === 'allergy').map((a) => a.label),
      customAllergies.trim()
    ].filter(Boolean);
    const alertList = activeAlerts.filter((a) => a.category === 'alert').map((a) => a.label);

    const hasClinicalHistory =
      conditionList.length > 0 ||
      allergyList.length > 0 ||
      alertList.length > 0 ||
      currentMedications.trim() ||
      pastDentalSurgeries.trim();

    if (hasClinicalHistory && patientId) {
      try {
        const conditionsCompiled = [...conditionList, ...alertList].join(', ');
        await api.post(`/patients/${patientId}/medical-history`, {
          conditions: conditionsCompiled || null,
          allergies: allergyList.join(', ') || null,
          medications: currentMedications.trim() || null,
          dentalHistory: pastDentalSurgeries.trim() || (selectedComplaints.length ? `Complaints: ${selectedComplaints.join(', ')}` : null),
          consentConfirmed: true
        });
      } catch (err) {
        console.warn('Could not auto-save initial medical history:', err);
      }
    }

    const failed = [];
    if (photoFile) {
      try {
        const compressed = await compressImage(photoFile);
        const fd = new FormData();
        fd.append('photo', compressed, compressed.name || 'patient-photo.jpg');
        await api.upload(`/patients/${patientId}/photo`, fd);
      } catch (err) {
        failed.push(`photo (${err.message})`);
      }
    } else if (removePhoto && editing) {
      try {
        await api.del(`/patients/${patientId}/photo`);
      } catch (err) {
        failed.push(`photo removal (${err.message})`);
      }
    }

    if (proofFile) {
      try {
        const fd = new FormData();
        fd.append('file', proofFile);
        fd.append('category', 'id_proof');
        fd.append('notes', `ID proof — ${proofConfig(formValues.idProofType)?.label || 'document'}`);
        await api.upload(`/patients/${patientId}/documents`, fd);
      } catch (err) {
        failed.push(`ID proof (${err.message})`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['patients'] });
    queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
    queryClient.invalidateQueries({ queryKey: ['patient-photo', patientId] });
    queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
    queryClient.invalidateQueries({ queryKey: ['medical-history', patientId] });

    if (failed.length) {
      toast.error(`Patient registered, but ${failed.join(' and ')} failed to upload.`);
    } else if (editing) {
      toast.success('Patient details and clinical records updated');
    } else {
      toast.success(`Patient registered successfully! ID assigned.`);
    }
    navigate(`/patients/${patientId}`);
    return true;
  };

  const onSubmit = (formValues) => save(formValues, false);

  const pendingFiles = Boolean(photoFile || proofFile || removePhoto);
  const confirmLeave = useUnsavedChanges((isDirty || pendingFiles) && !isSubmitting, () =>
    new Promise((resolve) => {
      handleSubmit(async (v) => resolve((await save(v, false)) === true), () => resolve(false))();
    })
  );

  if (editing && patientQuery.isLoading) return <PageLoader label="Loading patient profile…" />;
  if (editing && patientQuery.error) return <p className="text-sm text-rose-700">{patientQuery.error.message}</p>;

  const previewAge = ageFromDob(values.dob);
  const proofCfg = proofConfig(values.idProofType);

  const checklist = [
    { key: 'name', label: 'Full name', done: (values.fullName || '').trim().length > 1, step: 1 },
    { key: 'mobile', label: 'Primary mobile', done: (values.mobile || '').trim().length >= 7, step: 2 },
    { key: 'dob', label: 'Date of birth', done: Boolean(values.dob), step: 1 },
    { key: 'gender', label: 'Gender', done: Boolean(values.gender), step: 1 },
    { key: 'bloodGroup', label: 'Blood group', done: Boolean(values.bloodGroup), step: 1 },
    { key: 'photo', label: 'Profile photo', done: hasPhoto, step: 1 },
    { key: 'address', label: 'Address & City', done: Boolean((values.address || '').trim() && (values.city || '').trim()), step: 2 },
    { key: 'complaints', label: 'Dental complaints recorded', done: selectedComplaints.length > 0, step: 3 },
    { key: 'medical', label: 'Medical & allergy screening', done: activeAlerts.length > 0 || customAllergies.length > 0, step: 3 },
    { key: 'id', label: 'Government ID verification', done: Boolean(values.idProofType && (values.idProofNumber || '').trim()), step: 4 },
    { key: 'emergency', label: 'Emergency contact', done: Boolean((values.emergencyContactName || '').trim() && (values.emergencyContactPhone || '').trim()), step: 5 },
    { key: 'consent', label: 'Treatment & Data Consent', done: Boolean(values.dataConsent), step: 5 }
  ];

  const doneCount = checklist.filter((c) => c.done).length;
  const completeness = Math.round((doneCount / checklist.length) * 100);

  const steps = [
    { num: 1, title: 'Demographics', desc: 'Identity & Photo', icon: UserRound },
    { num: 2, title: 'Contact', desc: 'Phone & Address', icon: Phone },
    { num: 3, title: 'Dental & Health', desc: 'Complaints & Alerts', icon: Stethoscope },
    { num: 4, title: 'ID & Insurance', desc: 'Verification & Claims', icon: IdCard },
    { num: 5, title: 'Emergency', desc: 'Contact & Consent', icon: HeartPulse }
  ];

  const validateAndNext = async (targetStep) => {
    if (activeStep === 1) {
      const ok = await trigger(['fullName']);
      if (!ok) return;
    }
    if (activeStep === 2) {
      const ok = await trigger(['mobile']);
      if (!ok) return;
    }
    if (activeStep === 4 && values.idProofType) {
      const ok = await trigger(['idProofNumber']);
      if (!ok) return;
    }
    setActiveStep(targetStep);
  };

  return (
    <div className="mx-auto max-w-7xl animate-fade-in pb-12">
      {/* Doccure Dental Hero Banner & Mode Bar */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a7f8b] via-[#0e95a3] to-[#14b8c8] p-6 text-white shadow-[0_20px_50px_-20px_rgba(10,127,139,0.35)]">
        <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-25">
          <img src={heroTooth} alt="" className="h-56 w-56 object-contain" />
        </div>
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 p-2 backdrop-blur-md shadow-inner">
              <img src={heroTooth} alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-black text-emerald-100 backdrop-blur-sm border border-emerald-300/30">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  {editing ? 'Patient Update' : 'New Intake Workflow'}
                </span>
                <span className="text-xs text-white/80">· Dental Registration &amp; Clinical Records</span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                {editing ? `Edit ${patient?.fullName || 'Patient'}` : 'Register New Dental Patient'}
              </h1>
              <p className="mt-1 text-xs text-white/85 max-w-xl">
                {editing
                  ? `Patient ID: ${patient?.patientNo} · Registered ${formatDate(patient?.createdAt)}`
                  : 'Capture demographics, dental chief complaints, medical alerts, smile history and ID verification.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-2xl border border-white/25 bg-white/15 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode('wizard')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                mode === 'wizard' ? 'bg-white text-[#0a7f8b] shadow-md' : 'text-white/90 hover:bg-white/20'
              }`}
            >
              Step-by-Step
            </button>
            <button
              type="button"
              onClick={() => setMode('all')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                mode === 'all' ? 'bg-white text-[#0a7f8b] shadow-md' : 'text-white/90 hover:bg-white/20'
              }`}
            >
              Expanded View
            </button>
          </div>
        </div>

        {/* Step Navigation Bar */}
        {mode === 'wizard' && (
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {steps.map((s) => {
              const active = activeStep === s.num;
              const isPast = activeStep > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => validateAndNext(s.num)}
                  className={`group relative flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all ${
                    active
                      ? 'border-white bg-white text-slate-900 shadow-lg ring-2 ring-white/50'
                      : isPast
                        ? 'border-white/20 bg-white/15 text-white hover:bg-white/25'
                        : 'border-white/10 bg-white/10 text-white/75 hover:bg-white/20'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-all ${
                      active
                        ? 'bg-[#0a7f8b] text-white shadow-xs'
                        : isPast
                          ? 'bg-emerald-400 text-slate-900'
                          : 'bg-white/20 text-white'
                    }`}
                  >
                    {isPast ? <Check size={14} strokeWidth={3} /> : s.num}
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-black leading-tight ${active ? 'text-[#0a7f8b]' : 'text-white'}`}>
                      {s.title}
                    </p>
                    <p className={`truncate text-[10px] font-semibold ${active ? 'text-slate-500' : 'text-white/75'}`}>
                      {s.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main Form Body */}
          <div className="space-y-6">
            {/* STEP 1: Demographics & Identity */}
            {(mode === 'all' || activeStep === 1) && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <SectionHeader
                  icon={UserRound}
                  title="1. Patient Demographics & Identification"
                  subtitle="Primary identity, photograph, age and medical classification."
                  badge="Core Identity"
                />

                <div className="p-6">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    {/* Patient Photo Capture */}
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="group relative h-[120px] w-[120px] shrink-0">
                        <div className="h-full w-full overflow-hidden rounded-2xl border-2 border-line/90 bg-gradient-to-br from-slate-50 via-slate-100 to-sky-50 shadow-inner">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Patient Preview" className="h-full w-full object-cover" />
                          ) : hasExistingPhoto ? (
                            <PatientAvatar patient={patient} size={120} className="!rounded-2xl text-xl" ring={false} />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                              <UserRound size={36} strokeWidth={1.5} className="text-slate-300" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Add Photo</span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => canEdit && photoInputRef.current?.click()}
                          title="Upload patient photo"
                          className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-accent text-white shadow-md transition-transform duration-200 hover:scale-110 active:scale-95 disabled:cursor-not-allowed"
                          disabled={!canEdit}
                        >
                          <Camera size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="rounded-lg bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 transition hover:bg-accent-100 disabled:opacity-50"
                          disabled={!canEdit}
                        >
                          {hasPhoto ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        {(photoFile || hasExistingPhoto) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoFile(null);
                              setRemovePhoto(true);
                              setPhotoError('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>
                      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhotoChange} />
                      <p className="text-center text-[10px] text-slate-400">JPG, PNG · Auto-compressed</p>
                      {photoError && <p className="text-center text-[11px] font-semibold text-rose-600">{photoError}</p>}
                    </div>

                    {/* Patient Information Fields */}
                    <div className="min-w-0 flex-1">
                      <FormRow cols={2}>
                        <Input
                          label="Full Patient Name"
                          required
                          placeholder="e.g. Rajesh Kumar"
                          autoFocus={activeStep === 1}
                          wrapperClass="md:col-span-2"
                          error={errors.fullName?.message}
                          {...register('fullName')}
                        />

                        <Input
                          label="Date of Birth"
                          type="date"
                          hint={previewAge != null ? `Calculated age: ${previewAge} years` : 'Auto-computes clinical age'}
                          error={errors.dob?.message}
                          {...register('dob')}
                        />

                        <Select label="Gender" error={errors.gender?.message} {...register('gender')}>
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </Select>

                        <Select label="Blood Group" error={errors.bloodGroup?.message} {...register('bloodGroup')}>
                          <option value="">Select blood group</option>
                          {BLOOD_GROUPS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          <option value="unknown">Unknown</option>
                        </Select>

                        <Select label="Marital Status" error={errors.maritalStatus?.message} {...register('maritalStatus')}>
                          <option value="">Select marital status</option>
                          {MARITAL_STATUS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </Select>

                        <Input
                          label="Occupation"
                          placeholder="e.g. Software Engineer, Teacher, Homemaker"
                          wrapperClass="md:col-span-2"
                          error={errors.occupation?.message}
                          {...register('occupation')}
                        />
                      </FormRow>
                    </div>
                  </div>
                </div>

                {mode === 'wizard' && (
                  <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/70 px-6 py-3.5">
                    <span className="text-[11.5px] text-slate-500">Name is mandatory to proceed.</span>
                    <Button type="button" onClick={() => validateAndNext(2)} icon={ChevronRight}>
                      Continue to Contact
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Contact & Address */}
            {(mode === 'all' || activeStep === 2) && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <SectionHeader
                  icon={Phone}
                  title="2. Contact Numbers & Residential Address"
                  subtitle="Direct communication channels for appointment alerts, reminders and invoices."
                  badge="Communication"
                />

                <div className="p-6">
                  <FormRow cols={2}>
                    <Input
                      label="Primary Mobile Phone"
                      required
                      inputMode="tel"
                      placeholder="e.g. 9876543210"
                      hint="Used for appointment SMS and WhatsApp updates"
                      error={errors.mobile?.message}
                      {...register('mobile')}
                    />

                    <Input
                      label="Alternate Contact Phone"
                      inputMode="tel"
                      placeholder="e.g. 9876500000"
                      hint="Family member or secondary phone"
                      error={errors.alternateMobile?.message}
                      {...register('alternateMobile')}
                    />

                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="e.g. patient@gmail.com"
                      hint="Digital bills & dental prescription PDF"
                      error={errors.email?.message}
                      {...register('email')}
                    />

                    <Input
                      label="Postal PIN Code"
                      inputMode="numeric"
                      placeholder="e.g. 600001"
                      error={errors.pincode?.message}
                      {...register('pincode')}
                    />

                    <Textarea
                      label="Residential Address"
                      rows={2}
                      placeholder="Door no, Street name, Apartment / Area"
                      wrapperClass="md:col-span-2"
                      error={errors.address?.message}
                      {...register('address')}
                    />

                    <Input
                      label="City / District"
                      placeholder="e.g. Chennai, Coimbatore"
                      error={errors.city?.message}
                      {...register('city')}
                    />

                    <Input
                      label="State / Province"
                      placeholder="e.g. Tamil Nadu"
                      error={errors.state?.message}
                      {...register('state')}
                    />
                  </FormRow>
                </div>

                {mode === 'wizard' && (
                  <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/70 px-6 py-3.5">
                    <Button type="button" variant="secondary" onClick={() => setActiveStep(1)} icon={ChevronLeft}>
                      Back to Demographics
                    </Button>
                    <Button type="button" onClick={() => validateAndNext(3)} icon={ChevronRight}>
                      Continue to Dental & Health
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Dental Intake, Chief Complaint & Medical Alerts (HIGH DENSITY) */}
            {(mode === 'all' || activeStep === 3) && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <SectionHeader
                  icon={Stethoscope}
                  title="3. Dental Complaints & Medical Safety Screening"
                  subtitle="Capture chief dental concern, pain severity score, and vital medical conditions before operative procedures."
                  badge="Clinical Safety"
                />

                <div className="p-6 space-y-6">
                  {/* Dental Chief Complaint Chips */}
                  <div>
                    <label className="block text-[12.5px] font-bold text-navy-900">
                      Primary Dental Complaint(s) / Reason for Visit
                    </label>
                    <p className="mt-0.5 text-[11.5px] text-slate-500">
                      Click all that apply. These will be highlighted on the clinical dental chart.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {DENTAL_COMPLAINTS.map((c) => {
                        const selected = selectedComplaints.includes(c.label);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleComplaint(c.label)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all ${
                              selected
                                ? 'border-accent-600 bg-accent text-white shadow-sm ring-2 ring-accent-300/40'
                                : 'border-line/90 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <span>{c.icon}</span>
                            <span>{c.label}</span>
                            {selected && <Check size={13} strokeWidth={3} className="ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dental Pain Severity Gauge */}
                  <div className="rounded-2xl border border-line/80 bg-gradient-to-r from-emerald-50/40 via-amber-50/30 to-rose-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[12.5px] font-bold text-navy-900">Current Dental Pain Level (0 - 10)</p>
                        <p className="text-[11px] text-slate-500">Clinical pain rating assessed at dental reception</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[12px] font-bold shadow-sm ${
                          painLevel === 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : painLevel <= 3
                              ? 'bg-emerald-200 text-emerald-900'
                              : painLevel <= 6
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-rose-600 text-white animate-pulse'
                        }`}
                      >
                        {painLevel === 0 ? 'No Pain (0)' : painLevel <= 3 ? `Mild Pain (${painLevel})` : painLevel <= 6 ? `Moderate Pain (${painLevel})` : `Severe / Emergency (${painLevel})`}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-11 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setPainLevel(score)}
                          className={`flex h-9 items-center justify-center rounded-lg text-[12px] font-bold transition-all ${
                            painLevel === score
                              ? score === 0
                                ? 'bg-emerald-600 text-white shadow-md'
                                : score <= 3
                                  ? 'bg-emerald-500 text-white shadow-md'
                                  : score <= 6
                                    ? 'bg-amber-500 text-white shadow-md'
                                    : 'bg-rose-600 text-white shadow-md scale-105 ring-2 ring-rose-400'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* High-Risk Medical Alerts & Allergies (Dental Critical) */}
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="text-rose-600" />
                      <label className="text-[12.5px] font-bold text-navy-900">
                        Critical Medical Conditions & Dental Precautions
                      </label>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-slate-500">
                      Essential screening before dental anesthesia, surgical extractions or drug prescriptions.
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {MEDICAL_ALERTS.map((alert) => {
                        const active = activeAlerts.some((a) => a.id === alert.id);
                        const Icon = alert.icon;
                        return (
                          <button
                            key={alert.id}
                            type="button"
                            onClick={() => toggleAlert(alert)}
                            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                              active
                                ? alert.tone === 'rose'
                                  ? 'border-rose-300 bg-rose-50/90 text-rose-900 ring-2 ring-rose-200'
                                  : 'border-amber-300 bg-amber-50/90 text-amber-900 ring-2 ring-amber-200'
                                : 'border-line/70 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                active
                                  ? alert.tone === 'rose'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-500 text-white'
                                  : 'bg-white text-slate-400 ring-1 ring-slate-200'
                              }`}
                            >
                              <Icon size={14} />
                            </span>
                            <span className="flex-1 text-[12px] font-semibold leading-tight">{alert.label}</span>
                            {active && <Check size={14} strokeWidth={3} className="shrink-0 text-current" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additional Medical Details */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Other Specific Allergies (Drugs / Foods)"
                      placeholder="e.g. Sulfa drugs, Ibuprofen, Aspirin"
                      value={customAllergies}
                      onChange={(e) => setCustomAllergies(e.target.value)}
                    />
                    <Input
                      label="Current Ongoing Medications"
                      placeholder="e.g. Metformin 500mg, Ecosprin 75mg"
                      value={currentMedications}
                      onChange={(e) => setCurrentMedications(e.target.value)}
                    />
                    <Textarea
                      label="Past Dental Treatment History"
                      placeholder="e.g. Underwent RCT in 2023, frequent bleeding gums, wears dental retainers"
                      rows={2}
                      wrapperClass="sm:col-span-2"
                      value={pastDentalSurgeries}
                      onChange={(e) => setPastDentalSurgeries(e.target.value)}
                    />
                  </div>
                </div>

                {mode === 'wizard' && (
                  <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/70 px-6 py-3.5">
                    <Button type="button" variant="secondary" onClick={() => setActiveStep(2)} icon={ChevronLeft}>
                      Back to Contact
                    </Button>
                    <Button type="button" onClick={() => validateAndNext(4)} icon={ChevronRight}>
                      Continue to ID & Insurance
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: ID Proof & Insurance */}
            {(mode === 'all' || activeStep === 4) && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <SectionHeader
                  icon={IdCard}
                  title="4. Government ID Proof & Dental Insurance"
                  subtitle="Statutory identity verification and insurance policy for seamless dental claims."
                  badge="Verification"
                />

                <div className="p-6 space-y-5">
                  <FormRow cols={2}>
                    <Select label="Government ID Proof Type" error={errors.idProofType?.message} {...register('idProofType')}>
                      <option value="">Select ID proof type</option>
                      {ID_PROOF_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </Select>

                    <Input
                      label="ID Proof Document Number"
                      placeholder={proofCfg?.placeholder || 'Select ID type first'}
                      hint={proofCfg?.hint || 'Recorded as printed on document'}
                      disabled={!values.idProofType}
                      error={errors.idProofNumber?.message}
                      {...register('idProofNumber')}
                    />
                  </FormRow>

                  {/* ID Proof Document Upload Container */}
                  <div>
                    <label className="block text-[12px] font-bold text-navy-900">Attach Scanned ID Document / Photo</label>
                    <div
                      className={`mt-2 flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-all sm:flex-row sm:items-center ${
                        proofFile
                          ? 'border-accent-500 bg-accent-50/50'
                          : 'border-line/90 bg-slate-50/70 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-accent shadow-sm ring-1 ring-line">
                        <FileText size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-navy-900">
                          {proofFile ? proofFile.name : existingProof ? existingProof.file_name : 'No ID document attached yet'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {proofFile
                            ? `${fileSize(proofFile.size)} · Ready to upload with registration`
                            : existingProof
                              ? `Uploaded on file · ${formatDate(existingProof.created_at)}`
                              : 'Upload front scan or photo (PDF, JPG, PNG up to 10 MB)'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {proofFile && (
                          <button
                            type="button"
                            onClick={() => setProofFile(null)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-rose-600"
                            aria-label="Remove attached ID proof"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={Upload}
                          disabled={!canUploadDocs}
                          onClick={() => proofInputRef.current?.click()}
                        >
                          {proofFile || existingProof ? 'Change Document' : 'Attach File'}
                        </Button>
                        <input
                          ref={proofInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={onProofChange}
                        />
                      </div>
                    </div>
                    {proofError && <p className="mt-1 text-[11px] font-semibold text-rose-600">{proofError}</p>}
                  </div>

                  {/* Insurance & Referral Source */}
                  <div className="border-t border-line/60 pt-4">
                    <p className="text-[12.5px] font-bold text-navy-900">Dental Insurance & Referral Source</p>
                    <div className="mt-3">
                      <FormRow cols={3}>
                        <Input
                          label="Referred By"
                          placeholder="e.g. Dr. Priya, Google, Friend"
                          error={errors.referredBy?.message}
                          {...register('referredBy')}
                        />
                        <Input
                          label="Dental Insurance Provider"
                          placeholder="e.g. Star Health, MediAssist"
                          error={errors.insuranceProvider?.message}
                          {...register('insuranceProvider')}
                        />
                        <Input
                          label="Insurance Policy / Card ID"
                          placeholder="e.g. POL-8947194"
                          error={errors.insurancePolicyNo?.message}
                          {...register('insurancePolicyNo')}
                        />
                      </FormRow>
                    </div>
                  </div>
                </div>

                {mode === 'wizard' && (
                  <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/70 px-6 py-3.5">
                    <Button type="button" variant="secondary" onClick={() => setActiveStep(3)} icon={ChevronLeft}>
                      Back to Dental & Health
                    </Button>
                    <Button type="button" onClick={() => validateAndNext(5)} icon={ChevronRight}>
                      Continue to Emergency & Consent
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Emergency & Consent */}
            {(mode === 'all' || activeStep === 5) && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <SectionHeader
                  icon={HeartPulse}
                  title="5. Emergency Contact & Patient Consent"
                  subtitle="Immediate contact details for unforeseen emergencies and electronic data consent."
                  badge="Final Step"
                />

                <div className="p-6 space-y-5">
                  <FormRow cols={3}>
                    <Input
                      label="Emergency Contact Name"
                      placeholder="e.g. Sangeetha Kumar"
                      error={errors.emergencyContactName?.message}
                      {...register('emergencyContactName')}
                    />
                    <Input
                      label="Relationship"
                      placeholder="e.g. Spouse, Father, Brother"
                      error={errors.emergencyContactRelation?.message}
                      {...register('emergencyContactRelation')}
                    />
                    <Input
                      label="Emergency Contact Phone"
                      inputMode="tel"
                      placeholder="e.g. 9840001111"
                      error={errors.emergencyContactPhone?.message}
                      {...register('emergencyContactPhone')}
                    />
                  </FormRow>

                  <Textarea
                    label="Front Desk / Administrative Remarks"
                    rows={2}
                    placeholder="e.g. Patient prefers morning slots, requested Tamil speaking dentist, wheelchair assistance needed"
                    hint="Staff notes only. Clinical findings should be logged on the consultation page."
                    error={errors.notes?.message}
                    {...register('notes')}
                  />

                  {/* Digital Patient Consent Box */}
                  <div className="rounded-2xl border border-accent-200/80 bg-accent-50/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Checkbox {...register('dataConsent')} />
                      </div>
                      <div className="text-[12px] leading-relaxed text-slate-700">
                        <span className="font-bold text-navy-900">
                          Digital Patient & Dental Treatment Consent:
                        </span>{' '}
                        The patient hereby consents to the clinic capturing and storing demographic information,
                        dental radiographs/photos, and medical history in digital records for dental diagnostic,
                        billing and clinical purposes in compliance with medical data privacy guidelines.
                      </div>
                    </div>

                    {editing && (
                      <div className="mt-3 border-t border-accent-200/60 pt-3">
                        <Checkbox label="Patient Record is Active (Enabled for consultations and billing)" {...register('isActive')} />
                      </div>
                    )}
                  </div>
                </div>

                {mode === 'wizard' && (
                  <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/70 px-6 py-3.5">
                    <Button type="button" variant="secondary" onClick={() => setActiveStep(4)} icon={ChevronLeft}>
                      Back to ID & Insurance
                    </Button>
                    <Button type="submit" loading={isSubmitting} icon={editing ? Save : UserPlus}>
                      {editing ? 'Save Changes' : 'Complete Registration'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Rail: Interactive Live Dental Clinic Card & Checklist */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            {/* Live Patient Card Preview */}
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#0a7f8b] via-[#0d8f9d] to-[#14b8c8] p-5 text-white shadow-md">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent-400/25 blur-2xl"
                />

                <div className="relative flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent-200 ring-1 ring-white/15">
                    Dental Clinic Pass
                  </span>
                  <span className="text-[10px] text-slate-300">
                    {editing ? patient?.patientNo : 'Auto ID Generated'}
                  </span>
                </div>

                <div className="relative mt-4 flex items-center gap-3.5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white/40 bg-white/10 shadow-md">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Patient" className="h-full w-full object-cover" />
                    ) : hasExistingPhoto ? (
                      <PatientAvatar patient={previewPatient} size={64} className="!rounded-2xl text-lg" ring={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/50">
                        <UserRound size={28} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-bold text-white">
                      {values.fullName?.trim() || 'New Patient'}
                    </h3>
                    <p className="truncate text-[11.5px] text-accent-200">
                      {values.mobile?.trim() || 'Mobile not entered'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {previewAge != null && (
                        <span className="rounded bg-white/15 px-1.5 py-0.5 font-semibold text-white">
                          {previewAge} yrs
                        </span>
                      )}
                      {values.gender && (
                        <span className="rounded bg-white/15 px-1.5 py-0.5 font-medium uppercase text-slate-200">
                          {values.gender}
                        </span>
                      )}
                      {values.bloodGroup && values.bloodGroup !== 'unknown' && (
                        <span className="rounded bg-rose-500/80 px-1.5 py-0.5 font-bold text-white">
                          {values.bloodGroup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pain Alert Banner on Card */}
                {painLevel > 0 && (
                  <div className="relative mt-3 flex items-center justify-between rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5 text-rose-300">
                      <Flame size={13} /> Reported Pain Level
                    </span>
                    <span className="rounded bg-rose-500 px-1.5 py-0.2 text-[10.5px] text-white">
                      {painLevel}/10
                    </span>
                  </div>
                )}
              </div>

              {/* Critical Alert Highlights */}
              {activeAlerts.length > 0 && (
                <div className="border-b border-line/70 bg-rose-50/50 p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    <ShieldAlert size={14} /> Medical Precautions ({activeAlerts.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeAlerts.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-md bg-rose-100 px-2 py-0.5 text-[10.5px] font-semibold text-rose-800 ring-1 ring-rose-200"
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile Completeness Gauge */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Profile Completeness
                  </span>
                  <span
                    className={`text-[12px] font-extrabold tabular-nums ${
                      completeness === 100 ? 'text-emerald-600' : 'text-accent'
                    }`}
                  >
                    {completeness}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completeness === 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'bg-gradient-to-r from-accent to-sky-400'
                    }`}
                    style={{ width: `${Math.max(5, completeness)}%` }}
                  />
                </div>

                <div className="mt-4 space-y-1.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    Intake Checklist
                  </p>
                  {checklist.map((item) => (
                    <div
                      key={item.key}
                      onClick={() => mode === 'wizard' && setActiveStep(item.step)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-1 text-[11.5px] transition hover:bg-slate-50 ${
                        item.done ? 'text-slate-400 line-through' : 'font-medium text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          size={14}
                          className={item.done ? 'text-emerald-500' : 'text-slate-300'}
                        />
                        <span>{item.label}</span>
                      </div>
                      {!item.done && mode === 'wizard' && (
                        <span className="text-[10px] font-semibold text-accent">Step {item.step}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Submission Bar in All Mode */}
            {mode === 'all' && (
              <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={isSubmitting}
                  icon={editing ? Save : UserPlus}
                >
                  {editing ? 'Save Changes' : 'Register Patient'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={() => confirmLeave(editing ? `/patients/${id}` : '/patients')}
                >
                  Cancel
                </Button>
              </div>
            )}
          </aside>
        </div>
      </form>

      {/* Duplicate Patient Alert Dialog */}
      <Modal
        open={Boolean(duplicates)}
        onClose={() => setDuplicates(null)}
        title="Potential Duplicate Patient Record"
        subtitle="A patient with the same mobile number or full name was found in the clinic database."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicates(null)}>
              Review Details
            </Button>
            <Button
              onClick={() => {
                const pending = pendingValues;
                setDuplicates(null);
                setPendingValues(null);
                save(pending, true);
              }}
            >
              Confirm & Register Anyway
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {(duplicates || []).map((d) => (
            <li key={d.id || `${d.patient_no}-${d.mobile}`} className="surface-muted rounded-xl p-3 border border-line">
              <p className="text-sm font-semibold text-navy-900">
                {d.full_name || d.fullName}{' '}
                <span className="text-xs font-normal text-slate-500">({d.patient_no || d.patientNo})</span>
              </p>
              <p className="text-xs text-slate-600">
                {d.mobile} {d.dob ? `· DOB ${formatDate(d.dob)}` : ''} {d.gender ? `· ${humanize(d.gender)}` : ''}
              </p>
              {d.id && (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-semibold text-accent hover:underline"
                  onClick={() => navigate(`/patients/${d.id}`)}
                >
                  Open Existing Patient Record →
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Double check before registering to avoid creating fragmented medical histories for the same patient.
        </p>
      </Modal>
    </div>
  );
}
