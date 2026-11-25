import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Stethoscope, Pill, LayoutTemplate, Truck, FlaskConical, Settings2,
  Plus, Pencil, Trash2, Search, CheckCircle2, Clock, CreditCard, Building2,
  X, RefreshCw, AlertTriangle, ShieldCheck, Sparkles, Filter, ChevronRight,
  UserCheck, UserPlus, GraduationCap, CalendarClock, KeyRound, Phone, Mail,
  User, Check, ToggleLeft, ToggleRight, ArrowUpRight, Activity, Wallet, Banknote
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useClinic } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatMoney, humanize, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea, FormRow, Checkbox } from '../../components/ui/Input.jsx';
import { PageLoader, ErrorState, EmptyState } from '../../components/ui/States.jsx';

const TREATMENT_CATEGORIES = [
  'All',
  'Restorative & Fillings',
  'Endodontics (RCT)',
  'Prosthodontics & Crowns',
  'Oral & Maxillofacial Surgery',
  'Periodontics & Scaling',
  'Orthodontics & Aligners',
  'Pediatric Dentistry',
  'Diagnostic & Radiology',
  'Preventive Dentistry'
];

const MEDICINE_CATEGORIES = [
  'All',
  'Antibiotics',
  'Analgesics & NSAIDs',
  'Antacids & PPI',
  'Antiseptics & Mouthwash',
  'Corticosteroids',
  'Local Anesthetics',
  'Hemostatics',
  'Nutritional Supplements'
];

const DENTAL_SPECIALIZATIONS = [
  {
    code: 'GEN',
    name: 'General Dentistry & Diagnostics',
    description: 'Routine clinical checkup, oral prophylaxis, basic restorations, composite fillings, and initial triage.',
    badgeColor: 'sky',
    defaultChairMinutes: 20
  },
  {
    code: 'ENDO',
    name: 'Conservative Dentistry & Endodontics',
    description: 'Single/multi-sitting root canal treatments (RCT), rotary instrumentation, post & core, and apex locator apexogenesis.',
    badgeColor: 'purple',
    defaultChairMinutes: 45
  },
  {
    code: 'ORTHO',
    name: 'Orthodontics & Dentofacial Orthopedics',
    description: 'Correction of malocclusions, metal/ceramic braces, self-ligating systems, and digital clear aligner treatment plans.',
    badgeColor: 'indigo',
    defaultChairMinutes: 30
  },
  {
    code: 'PROSTHO',
    name: 'Prosthodontics, Crown & Bridge',
    description: 'CAD/CAM zirconia crowns, E-Max veneers, bridges, complete dentures, cast partial dentures, and full mouth rehabilitation.',
    badgeColor: 'amber',
    defaultChairMinutes: 45
  },
  {
    code: 'SURG',
    name: 'Oral & Maxillofacial Surgery',
    description: 'Surgical disimpactions, third molar surgical extractions, alveoloplasty, frenectomy, apicoectomy, and biopsy.',
    badgeColor: 'rose',
    defaultChairMinutes: 45
  },
  {
    code: 'PERIO',
    name: 'Periodontics & Oral Implantology',
    description: 'Deep curettage, periodontal flap surgery, bone grafting, GTR membranes, and titanium endosseous dental implants.',
    badgeColor: 'emerald',
    defaultChairMinutes: 40
  },
  {
    code: 'PEDO',
    name: 'Pediatric & Preventive Dentistry',
    description: 'Child dental care, pulpectomy, stainless steel crowns, space maintainers, pit & fissure sealants, and topical fluoride.',
    badgeColor: 'teal',
    defaultChairMinutes: 25
  },
  {
    code: 'COSMETIC',
    name: 'Cosmetic & Aesthetic Dentistry',
    description: 'In-office tooth whitening / bleaching, composite diastema closure, aesthetic smile design, and direct resin veneers.',
    badgeColor: 'pink',
    defaultChairMinutes: 30
  }
];

const APPOINTMENT_TYPES = [
  { id: 'consultation', name: 'Dental Consultation', duration: 15, category: 'General', color: 'bg-sky-100 text-sky-800 border-sky-200', notes: 'Initial clinical examination, intraoral photography & diagnosis' },
  { id: 'follow_up', name: 'Doctor Follow-up', duration: 15, category: 'Review', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', notes: 'Post-operative wound check, suture removal & healing review' },
  { id: 'scaling', name: 'Scaling & Polishing', duration: 30, category: 'Preventive', color: 'bg-teal-100 text-teal-800 border-teal-200', notes: 'Ultrasonic supragingival and subgingival calculus removal' },
  { id: 'rct', name: 'Root Canal Treatment', duration: 45, category: 'Endodontics', color: 'bg-purple-100 text-purple-800 border-purple-200', notes: 'Rotary biomechanical preparation, canal disinfection & obturation' },
  { id: 'extraction', name: 'Tooth Extraction', duration: 30, category: 'Surgery', color: 'bg-rose-100 text-rose-800 border-rose-200', notes: 'Non-surgical / surgical tooth elevation under local anesthesia' },
  { id: 'crown_prep', name: 'Crown & Bridge Impression', duration: 45, category: 'Prosthodontics', color: 'bg-amber-100 text-amber-800 border-amber-200', notes: 'Tooth preparation, gingival retraction cord & precision impression' },
  { id: 'ortho_review', name: 'Ortho Wire Adjustment', duration: 20, category: 'Orthodontics', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', notes: 'Archwire change, elastic ligatures, bracket debonding check' },
  { id: 'emergency', name: 'Dental Emergency Relief', duration: 20, category: 'Emergency', color: 'bg-red-100 text-red-800 border-red-200', notes: 'Acute pulpitis pain relief, temporary dressing or abscess drainage' }
];

const EMPTY_TREATMENT = {
  code: '',
  name: '',
  category: 'Restorative & Fillings',
  description: '',
  defaultPrice: '',
  isActive: true
};

const EMPTY_MEDICINE = {
  name: '',
  form: 'Tablet',
  strength: '',
  category: 'Antibiotics',
  defaultDosage: '1 tablet',
  defaultRoute: 'oral',
  defaultFrequency: 'BID (twice daily)',
  defaultDuration: '5 days',
  defaultInstructions: 'Take after meals with water',
  allergenGroup: '',
  isActive: true
};

const EMPTY_DOCTOR = {
  fullName: '',
  username: '',
  password: '',
  phone: '',
  email: '',
  specialization: 'General Dental Surgeon',
  isActive: true
};

const EMPTY_SUPPLIER = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  isActive: true
};

const EMPTY_LAB = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  isActive: true
};

export default function MastersPage() {
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const clinic = useClinic();

  const [activeTab, setActiveTab] = useState('treatments');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Treatments Modal State
  const [treatmentModal, setTreatmentModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [treatmentForm, setTreatmentForm] = useState(EMPTY_TREATMENT);
  const [treatmentBusy, setTreatmentBusy] = useState(false);

  // Medicine Modal State
  const [medicineModal, setMedicineModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [medicineForm, setMedicineForm] = useState(EMPTY_MEDICINE);
  const [medicineBusy, setMedicineBusy] = useState(false);

  // Doctor Modal State
  const [doctorModal, setDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR);
  const [doctorBusy, setDoctorBusy] = useState(false);

  // Doctor Password Reset Modal State
  const [passwordModal, setPasswordModal] = useState(false);
  const [resetDoctor, setResetDoctor] = useState(null);
  const [newDoctorPassword, setNewDoctorPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  // Payment Method Modal State
  const [newPaymentModal, setNewPaymentModal] = useState(false);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);

  // Supplier Modal State
  const [supplierModal, setSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [supplierBusy, setSupplierBusy] = useState(false);

  // Lab Modal State
  const [labModal, setLabModal] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [labForm, setLabForm] = useState(EMPTY_LAB);
  const [labBusy, setLabBusy] = useState(false);

  // Delete Template Confirm State
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // 1. Treatments Query
  const treatmentsQuery = useQuery({
    queryKey: ['masters', 'treatments'],
    queryFn: async () => (await api.get('/treatments?includeInactive=true')).data
  });

  // 2. Medicines Query
  const medicinesQuery = useQuery({
    queryKey: ['masters', 'medicines'],
    queryFn: async () => (await api.get('/prescriptions/medicines?includeInactive=true')).data
  });

  // 3. Doctors Query
  const dentistsQuery = useQuery({
    queryKey: ['masters', 'dentists'],
    queryFn: async () => (await api.get('/users/dentists?includeInactive=true')).data
  });

  // 4. Prescription Templates Query
  const templatesQuery = useQuery({
    queryKey: ['masters', 'templates'],
    queryFn: async () => (await api.get('/prescriptions/templates')).data
  });

  // 5. Suppliers Query
  const suppliersQuery = useQuery({
    queryKey: ['masters', 'suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data
  });

  // 6. Laboratories Query
  const labsQuery = useQuery({
    queryKey: ['masters', 'labs'],
    queryFn: async () => (await api.get('/laboratories')).data
  });

  // Data arrays
  const treatments = treatmentsQuery.data || [];
  const medicines = medicinesQuery.data || [];
  const dentists = dentistsQuery.data || [];
  const templates = templatesQuery.data || [];
  const suppliers = suppliersQuery.data || [];
  const labs = labsQuery.data || [];

  // ── Treatments Handlers ───────────────────────────────────────────────────
  const openNewTreatment = () => {
    setEditingTreatment(null);
    setTreatmentForm(EMPTY_TREATMENT);
    setTreatmentModal(true);
  };

  const openEditTreatment = (t) => {
    setEditingTreatment(t);
    setTreatmentForm({
      code: t.code || '',
      name: t.name,
      category: t.category || 'Restorative & Fillings',
      description: t.description || '',
      defaultPrice: String(t.defaultPrice ?? 0),
      isActive: t.isActive
    });
    setTreatmentModal(true);
  };

  const saveTreatment = async (e) => {
    e.preventDefault();
    if (!treatmentForm.name.trim()) return toast.error('Treatment name is required');
    setTreatmentBusy(true);
    try {
      const payload = {
        code: treatmentForm.code.trim() || null,
        name: treatmentForm.name.trim(),
        category: treatmentForm.category.trim(),
        description: treatmentForm.description.trim() || null,
        defaultPrice: Number(treatmentForm.defaultPrice) || 0,
        isActive: treatmentForm.isActive
      };
      if (editingTreatment) {
        await api.patch(`/treatments/${editingTreatment.id}`, payload);
        toast.success(`Updated procedure "${payload.name}"`);
      } else {
        await api.post('/treatments', payload);
        toast.success(`Created procedure "${payload.name}"`);
      }
      setTreatmentModal(false);
      queryClient.invalidateQueries({ queryKey: ['masters', 'treatments'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save treatment procedure');
    } finally {
      setTreatmentBusy(false);
    }
  };

  // ── Medicines Handlers ────────────────────────────────────────────────────
  const openNewMedicine = () => {
    setEditingMedicine(null);
    setMedicineForm(EMPTY_MEDICINE);
    setMedicineModal(true);
  };

  const openEditMedicine = (m) => {
    setEditingMedicine(m);
    setMedicineForm({
      name: m.name,
      form: m.form || 'Tablet',
      strength: m.strength || '',
      category: m.category || 'Antibiotics',
      defaultDosage: m.defaultDosage || '1 tablet',
      defaultRoute: m.defaultRoute || 'oral',
      defaultFrequency: m.defaultFrequency || 'BID (twice daily)',
      defaultDuration: m.defaultDuration || '5 days',
      defaultInstructions: m.defaultInstructions || '',
      allergenGroup: m.allergenGroup || '',
      isActive: m.isActive !== false
    });
    setMedicineModal(true);
  };

  const saveMedicine = async (e) => {
    e.preventDefault();
    if (!medicineForm.name.trim()) return toast.error('Medicine name is required');
    setMedicineBusy(true);
    try {
      const payload = {
        name: medicineForm.name.trim(),
        form: medicineForm.form.trim() || null,
        strength: medicineForm.strength.trim() || null,
        category: medicineForm.category.trim() || null,
        defaultDosage: medicineForm.defaultDosage.trim() || null,
        defaultRoute: medicineForm.defaultRoute.trim() || 'oral',
        defaultFrequency: medicineForm.defaultFrequency.trim() || null,
        defaultDuration: medicineForm.defaultDuration.trim() || null,
        defaultInstructions: medicineForm.defaultInstructions.trim() || null,
        allergenGroup: medicineForm.allergenGroup.trim() || null,
        isActive: medicineForm.isActive
      };
      if (editingMedicine) {
        await api.patch(`/prescriptions/medicines/${editingMedicine.id}`, payload);
        toast.success(`Updated drug "${payload.name}"`);
      } else {
        await api.post('/prescriptions/medicines', payload);
        toast.success(`Added drug "${payload.name}" to catalog`);
      }
      setMedicineModal(false);
      queryClient.invalidateQueries({ queryKey: ['masters', 'medicines'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save medicine');
    } finally {
      setMedicineBusy(false);
    }
  };

  // ── Suppliers Handlers ────────────────────────────────────────────────────
  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm(EMPTY_SUPPLIER);
    setSupplierModal(true);
  };

  const openEditSupplier = (s) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      isActive: s.isActive !== false
    });
    setSupplierModal(true);
  };

  const saveSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return toast.error('Supplier name is required');
    setSupplierBusy(true);
    try {
      const payload = {
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        address: supplierForm.address.trim() || null,
        isActive: supplierForm.isActive
      };
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, payload);
        toast.success(`Updated vendor "${payload.name}"`);
      } else {
        await api.post('/suppliers', payload);
        toast.success(`Created vendor "${payload.name}"`);
      }
      setSupplierModal(false);
      queryClient.invalidateQueries({ queryKey: ['masters', 'suppliers'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save supplier');
    } finally {
      setSupplierBusy(false);
    }
  };

  // ── Laboratories Handlers ─────────────────────────────────────────────────
  const openNewLab = () => {
    setEditingLab(null);
    setLabForm(EMPTY_LAB);
    setLabModal(true);
  };

  const openEditLab = (l) => {
    setEditingLab(l);
    setLabForm({
      name: l.name,
      contactPerson: l.contactPerson || '',
      phone: l.phone || '',
      email: l.email || '',
      address: l.address || '',
      isActive: l.isActive !== false
    });
    setLabModal(true);
  };

  const saveLab = async (e) => {
    e.preventDefault();
    if (!labForm.name.trim()) return toast.error('Laboratory name is required');
    setLabBusy(true);
    try {
      const payload = {
        name: labForm.name.trim(),
        contactPerson: labForm.contactPerson.trim() || null,
        phone: labForm.phone.trim() || null,
        email: labForm.email.trim() || null,
        address: labForm.address.trim() || null,
        isActive: labForm.isActive
      };
      if (editingLab) {
        await api.patch(`/laboratories/${editingLab.id}`, payload);
        toast.success(`Updated lab "${payload.name}"`);
      } else {
        await api.post('/laboratories', payload);
        toast.success(`Created lab "${payload.name}"`);
      }
      setLabModal(false);
      queryClient.invalidateQueries({ queryKey: ['masters', 'labs'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save dental laboratory');
    } finally {
      setLabBusy(false);
    }
  };

  // ── Delete Template Handler ───────────────────────────────────────────────
  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/prescriptions/templates/${deletingTemplate.id}`);
      toast.success(`Template "${deletingTemplate.name}" removed`);
      setDeletingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['masters', 'templates'] });
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Doctors Handlers ──────────────────────────────────────────────────────
  const openNewDoctor = () => {
    setEditingDoctor(null);
    setDoctorForm(EMPTY_DOCTOR);
    setDoctorModal(true);
  };

  const openEditDoctor = (d) => {
    setEditingDoctor(d);
    setDoctorForm({
      fullName: d.fullName,
      username: d.username,
      password: '',
      phone: d.phone || '',
      email: d.email || '',
      specialization: d.specialization || 'General Dental Surgeon',
      isActive: d.isActive !== false
    });
    setDoctorModal(true);
  };

  const saveDoctor = async (e) => {
    e.preventDefault();
    if (!doctorForm.fullName.trim()) return toast.error('Doctor name is required');
    if (!editingDoctor && !doctorForm.username.trim()) return toast.error('Login username is required');
    if (!editingDoctor && (!doctorForm.password || doctorForm.password.length < 8)) {
      return toast.error('Temporary password must be at least 8 characters');
    }

    setDoctorBusy(true);
    try {
      if (editingDoctor) {
        await api.patch(`/users/${editingDoctor.id}`, {
          fullName: doctorForm.fullName.trim(),
          phone: doctorForm.phone.trim() || null,
          email: doctorForm.email.trim() || null,
          isActive: doctorForm.isActive
        });
        toast.success(`Updated Dr. ${doctorForm.fullName}`);
      } else {
        await api.post('/users', {
          fullName: doctorForm.fullName.trim(),
          username: doctorForm.username.trim().toLowerCase(),
          password: doctorForm.password,
          roleCode: 'dentist',
          phone: doctorForm.phone.trim() || null,
          email: doctorForm.email.trim() || null
        });
        toast.success(`Dr. ${doctorForm.fullName} registered successfully in clinic records`);
      }
      setDoctorModal(false);
      queryClient.invalidateQueries({ queryKey: ['masters', 'dentists'] });
      queryClient.invalidateQueries({ queryKey: ['dentists'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save doctor details');
    } finally {
      setDoctorBusy(false);
    }
  };

  const toggleDoctorActive = async (d) => {
    try {
      await api.patch(`/users/${d.id}`, { isActive: !d.isActive });
      toast.success(`Dr. ${d.fullName} ${d.isActive ? 'deactivated' : 'activated'}`);
      queryClient.invalidateQueries({ queryKey: ['masters', 'dentists'] });
      queryClient.invalidateQueries({ queryKey: ['dentists'] });
    } catch (err) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const openResetPassword = (d) => {
    setResetDoctor(d);
    setNewDoctorPassword('');
    setPasswordModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newDoctorPassword || newDoctorPassword.length < 8) {
      return toast.error('New password must be at least 8 characters');
    }
    setResetBusy(true);
    try {
      await api.post(`/users/${resetDoctor.id}/reset-password`, { newPassword: newDoctorPassword });
      toast.success(`Password reset successfully for Dr. ${resetDoctor.fullName}`);
      setPasswordModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResetBusy(false);
    }
  };

  // ── Payment Methods Handlers ──────────────────────────────────────────────
  const currentPaymentMethods = useMemo(() => {
    return clinic.data?.defaultPaymentMethods || ['Cash', 'UPI', 'Card', 'Bank Transfer'];
  }, [clinic.data?.defaultPaymentMethods]);

  const togglePaymentMethod = async (methodName) => {
    setPaymentBusy(true);
    try {
      let updated;
      if (currentPaymentMethods.includes(methodName)) {
        if (currentPaymentMethods.length <= 1) {
          toast.error('At least one payment method must remain active');
          return;
        }
        updated = currentPaymentMethods.filter((m) => m !== methodName);
      } else {
        updated = [...currentPaymentMethods, methodName];
      }
      await api.patch('/clinic', { defaultPaymentMethods: updated });
      toast.success('Payment channels updated');
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
    } catch (err) {
      toast.error(err.message || 'Failed to update payment channels');
    } finally {
      setPaymentBusy(false);
    }
  };

  const addCustomPaymentMethod = async (e) => {
    e.preventDefault();
    const name = newPaymentName.trim();
    if (!name) return toast.error('Payment channel name is required');
    if (currentPaymentMethods.some((m) => m.toLowerCase() === name.toLowerCase())) {
      return toast.error('This payment method is already in your catalog');
    }
    setPaymentBusy(true);
    try {
      const updated = [...currentPaymentMethods, name];
      await api.patch('/clinic', { defaultPaymentMethods: updated });
      toast.success(`Added payment channel "${name}"`);
      setNewPaymentName('');
      setNewPaymentModal(false);
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
    } catch (err) {
      toast.error(err.message || 'Failed to add payment method');
    } finally {
      setPaymentBusy(false);
    }
  };

  // ── Filtered Data Lists ───────────────────────────────────────────────────
  const filteredTreatments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return treatments.filter((t) => {
      const matchesQ = !q || t.name?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'All' || t.category === categoryFilter;
      return matchesQ && matchesCat;
    });
  }, [treatments, search, categoryFilter]);

  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return medicines.filter((m) => {
      const matchesQ = !q || m.name?.toLowerCase().includes(q) || m.strength?.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'All' || m.category === categoryFilter;
      return matchesQ && matchesCat;
    });
  }, [medicines, search, categoryFilter]);

  const filteredDentists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dentists.filter((d) => {
      return !q || d.fullName?.toLowerCase().includes(q) || d.username?.toLowerCase().includes(q) || d.phone?.includes(q) || d.email?.toLowerCase().includes(q);
    });
  }, [dentists, search]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => !q || s.name?.toLowerCase().includes(q) || s.contactPerson?.toLowerCase().includes(q) || s.phone?.includes(q));
  }, [suppliers, search]);

  const filteredLabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return labs.filter((l) => !q || l.name?.toLowerCase().includes(q) || l.contactPerson?.toLowerCase().includes(q) || l.phone?.includes(q));
  }, [labs, search]);

  // Tab definitions
  const MASTER_TABS = [
    { value: 'treatments', label: 'Dental Procedures & Tariffs', count: treatments.length, icon: Stethoscope },
    { value: 'medicines', label: 'Medications & Drugs', count: medicines.length, icon: Pill },
    { value: 'templates', label: 'Prescription Protocols', count: templates.length, icon: LayoutTemplate },
    { value: 'doctors', label: 'Doctors & Dentists', count: dentists.length, icon: UserCheck },
    { value: 'specializations', label: 'Clinical Departments', count: DENTAL_SPECIALIZATIONS.length, icon: GraduationCap },
    { value: 'appointment_types', label: 'Appointment Types & Durations', count: APPOINTMENT_TYPES.length, icon: CalendarClock },
    { value: 'payment_methods', label: 'Payment Channels & Accounts', count: currentPaymentMethods.length, icon: CreditCard },
    { value: 'suppliers', label: 'Material Vendors', count: suppliers.length, icon: Truck },
    { value: 'labs', label: 'Dental Laboratories', count: labs.length, icon: FlaskConical },
    { value: 'practice', label: 'Practice & Tariff Rules', icon: Settings2 }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Clinical & Operational Administration"
        title="Master Records & Clinic Catalogs"
        subtitle="Centralized management of doctors, dental procedures, tariffs, prescription formulary, suppliers, and clinical departments."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Master records' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'treatments' && has('settings.manage') && (
              <Button icon={Plus} onClick={openNewTreatment}>Add Procedure</Button>
            )}
            {activeTab === 'medicines' && has('prescriptions.manage') && (
              <Button icon={Plus} onClick={openNewMedicine}>Add Medication</Button>
            )}
            {activeTab === 'doctors' && has('settings.manage') && (
              <Button icon={UserPlus} onClick={openNewDoctor}>Add Doctor</Button>
            )}
            {activeTab === 'payment_methods' && has('settings.manage') && (
              <Button icon={Plus} onClick={() => setNewPaymentModal(true)}>Add Payment Channel</Button>
            )}
            {activeTab === 'suppliers' && has('inventory.manage') && (
              <Button icon={Plus} onClick={openNewSupplier}>Add Vendor</Button>
            )}
            {activeTab === 'labs' && has('labs.manage') && (
              <Button icon={Plus} onClick={openNewLab}>Add Dental Lab</Button>
            )}
          </div>
        }
      />

      {/* KPI Overview Metric Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-line/80 bg-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Procedures</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-50 text-navy-700 ring-1 ring-navy-100">
              <Stethoscope size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-navy">{treatments.length}</span>
            <span className="text-[11px] text-slate-400 font-medium">in catalog</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Medications</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              <Pill size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-emerald-800">{medicines.length}</span>
            <span className="text-[11px] text-emerald-600 font-medium">formulations</span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">Doctors</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 ring-1 ring-blue-200">
              <UserCheck size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-blue-800">{dentists.length}</span>
            <span className="text-[11px] text-blue-600 font-medium">practitioners</span>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">Rx Protocols</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
              <LayoutTemplate size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-sky-800">{templates.length}</span>
            <span className="text-[11px] text-sky-600 font-medium">presets</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Supply Vendors</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <Truck size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-amber-800">{suppliers.length}</span>
            <span className="text-[11px] text-amber-600 font-medium">dealers</span>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-800">Partner Labs</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200">
              <FlaskConical size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-violet-800">{labs.length}</span>
            <span className="text-[11px] text-violet-600 font-medium">dental labs</span>
          </div>
        </div>
      </div>

      {/* Main Master Workspace Container */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {/* Master Section Navigation Tabs */}
        <div className="border-b border-line/80 bg-slate-50/70 px-4 pt-2">
          <Tabs
            tabs={MASTER_TABS}
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val);
              setSearch('');
              setCategoryFilter('All');
            }}
          />
        </div>

        {/* ── TAB 1: DENTAL PROCEDURES & TARIFFS ──────────────────────────────── */}
        {activeTab === 'treatments' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 p-4 bg-white">
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search procedures by code, name, or clinical category…"
                  className="input-base h-9 w-full pl-9 pr-8 text-[12.5px]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input-base h-9 text-[12px] font-medium"
                >
                  {TREATMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => treatmentsQuery.refetch()} loading={treatmentsQuery.isFetching}>
                  Refresh
                </Button>
              </div>
            </div>

            <DataTable
              columns={[
                {
                  key: 'code',
                  label: 'Code',
                  width: 100,
                  render: (t) => (
                    <span className="font-mono text-xs font-bold text-navy-800 bg-slate-100 px-2 py-0.5 rounded">
                      {t.code || '—'}
                    </span>
                  )
                },
                {
                  key: 'name',
                  label: 'Procedure Name',
                  render: (t) => (
                    <div>
                      <p className="font-semibold text-ink text-[13px]">{t.name}</p>
                      {t.description && <p className="text-[11px] text-slate-500 truncate max-w-md">{t.description}</p>}
                    </div>
                  )
                },
                {
                  key: 'category',
                  label: 'Category',
                  render: (t) => (
                    <span className="inline-flex items-center rounded-md bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-800 border border-accent-200">
                      {t.category}
                    </span>
                  )
                },
                {
                  key: 'defaultPrice',
                  label: 'Standard Fee',
                  align: 'right',
                  render: (t) => (
                    <span className="font-bold tabular-nums text-navy text-[13px]">
                      {formatMoney(t.defaultPrice)}
                    </span>
                  )
                },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (t) => (
                    <Badge tone={t.isActive ? 'success' : 'neutral'}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  )
                },
                {
                  key: 'actions',
                  label: '',
                  align: 'right',
                  render: (t) => (
                    has('settings.manage') && (
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditTreatment(t)}>
                        Edit
                      </Button>
                    )
                  )
                }
              ]}
              rows={filteredTreatments}
              loading={treatmentsQuery.isLoading}
              error={treatmentsQuery.error}
              onRetry={treatmentsQuery.refetch}
              emptyTitle="No procedures found"
              emptyMessage="Click 'Add Procedure' to add new dental procedures to the practice fee schedule."
            />
          </div>
        )}

        {/* ── TAB 2: MEDICATIONS & DRUGS ─────────────────────────────────────── */}
        {activeTab === 'medicines' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 p-4 bg-white">
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search medications by name, brand, formulation, strength…"
                  className="input-base h-9 w-full pl-9 pr-8 text-[12.5px]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input-base h-9 text-[12px] font-medium"
                >
                  {MEDICINE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => medicinesQuery.refetch()} loading={medicinesQuery.isFetching}>
                  Refresh
                </Button>
              </div>
            </div>

            <DataTable
              columns={[
                {
                  key: 'name',
                  label: 'Medication',
                  render: (m) => (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink text-[13px]">{m.name}</span>
                        {m.strength && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-700">
                            {m.strength}
                          </span>
                        )}
                      </div>
                      {m.defaultInstructions && (
                        <p className="text-[11px] text-slate-500 truncate max-w-sm">{m.defaultInstructions}</p>
                      )}
                    </div>
                  )
                },
                {
                  key: 'form',
                  label: 'Form',
                  render: (m) => (
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 border border-sky-200">
                      {m.form || 'Tablet'}
                    </span>
                  )
                },
                {
                  key: 'category',
                  label: 'Category',
                  render: (m) => <span className="text-[12px] text-slate-700 font-medium">{m.category || 'General Rx'}</span>
                },
                {
                  key: 'defaultDosage',
                  label: 'Default Regimen',
                  render: (m) => (
                    <div className="text-[11.5px] text-slate-600">
                      <p className="font-medium">{m.defaultDosage || '1 unit'} · {m.defaultFrequency || 'As needed'}</p>
                      <p className="text-[10.5px] text-slate-400">{m.defaultDuration || '3-5 days'}</p>
                    </div>
                  )
                },
                {
                  key: 'allergenGroup',
                  label: 'Allergen Alert',
                  render: (m) => (
                    m.allergenGroup ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 border border-amber-200">
                        <AlertTriangle size={11} />
                        {m.allergenGroup}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )
                  )
                },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (m) => (
                    <Badge tone={m.isActive ? 'success' : 'neutral'}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  )
                },
                {
                  key: 'actions',
                  label: '',
                  align: 'right',
                  render: (m) => (
                    has('prescriptions.manage') && (
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditMedicine(m)}>
                        Edit
                      </Button>
                    )
                  )
                }
              ]}
              rows={filteredMedicines}
              loading={medicinesQuery.isLoading}
              error={medicinesQuery.error}
              onRetry={medicinesQuery.refetch}
              emptyTitle="No medications in catalog"
              emptyMessage="Click 'Add Medication' to populate your dental clinic drug formulary."
            />
          </div>
        )}

        {/* ── TAB 3: PRESCRIPTION PROTOCOLS (TEMPLATES) ──────────────────────── */}
        {activeTab === 'templates' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold text-navy">Dental Rx Prescription Templates</h3>
                <p className="text-xs text-slate-500">Standardized clinical medication protocols for rapid 1-click prescribing.</p>
              </div>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => templatesQuery.refetch()} loading={templatesQuery.isFetching}>
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-xl border border-line bg-slate-50/50 p-4 transition-all hover:border-accent-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800">
                        {tpl.category || 'Clinical Protocol'}
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-navy">{tpl.name}</h4>
                    </div>
                    {has('prescriptions.manage') && (
                      <button
                        type="button"
                        onClick={() => setDeletingTemplate(tpl)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Delete template"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {tpl.instructions && (
                    <p className="mt-2 text-[11.5px] text-slate-600 line-clamp-2 italic">
                      "{tpl.instructions}"
                    </p>
                  )}

                  <div className="mt-3 divide-y divide-line/60 rounded-lg border border-line bg-white p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Prescribed Items ({tpl.items?.length || 0})</p>
                    {(tpl.items || []).map((it, idx) => (
                      <div key={idx} className="py-1.5 first:pt-0 last:pb-0 text-xs">
                        <p className="font-semibold text-navy-800">{it.medicineName}</p>
                        <p className="text-[11px] text-slate-500">
                          {it.dosage && `${it.dosage} · `}{it.frequency} · {it.duration}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: DOCTORS & CLINICAL PRACTITIONERS ──────────────────────────── */}
        {activeTab === 'doctors' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 p-4 bg-white">
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search doctors by name, login username, or phone…"
                  className="input-base h-9 w-full pl-9 pr-8 text-[12.5px]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => dentistsQuery.refetch()} loading={dentistsQuery.isFetching}>
                  Refresh
                </Button>
                {has('settings.manage') && (
                  <Button size="sm" icon={UserPlus} onClick={openNewDoctor}>
                    Add Doctor
                  </Button>
                )}
              </div>
            </div>

            <DataTable
              columns={[
                {
                  key: 'fullName',
                  label: 'Doctor / Clinician',
                  render: (d) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-700 to-accent text-white font-bold text-xs shadow-xs">
                        {initials(d.fullName)}
                      </div>
                      <div>
                        <div className="font-bold text-navy text-[13px] flex items-center gap-1.5">
                          <span>{d.fullName}</span>
                          {d.isActive && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Treating Dentist · Dental Practitioner</span>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'username',
                  label: 'Login ID',
                  render: (d) => (
                    <span className="inline-flex items-center gap-1 font-mono text-[11.5px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      @{d.username}
                    </span>
                  )
                },
                {
                  key: 'phone',
                  label: 'Contact Details',
                  render: (d) => (
                    <div className="space-y-0.5">
                      {d.phone ? (
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[12px]">
                          <Phone size={12} className="text-slate-400" />
                          <span>{d.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11.5px]">No phone</span>
                      )}
                      {d.email && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <Mail size={12} className="text-slate-400" />
                          <span>{d.email}</span>
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'role',
                  label: 'Clinical Role',
                  render: () => <Badge tone="info">Dentist</Badge>
                },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (d) => (
                    <Badge tone={d.isActive ? 'success' : 'neutral'}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  )
                },
                {
                  key: 'actions',
                  label: '',
                  align: 'right',
                  render: (d) => (
                    has('settings.manage') && (
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditDoctor(d)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => openResetPassword(d)} title="Reset Login Password">
                          Password
                        </Button>
                        <button
                          type="button"
                          onClick={() => toggleDoctorActive(d)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            d.isActive
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={d.isActive ? 'Deactivate doctor' : 'Activate doctor'}
                        >
                          {d.isActive ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} className="text-slate-400" />}
                        </button>
                      </div>
                    )
                  )
                }
              ]}
              rows={filteredDentists}
              loading={dentistsQuery.isLoading}
              error={dentistsQuery.error}
              onRetry={dentistsQuery.refetch}
              emptyTitle="No doctors found"
              emptyMessage="Click 'Add Doctor' to register dentists and dental specialists."
            />
          </div>
        )}

        {/* ── TAB: CLINICAL DEPARTMENTS & SPECIALIZATIONS ────────────────────── */}
        {activeTab === 'specializations' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold text-navy">Dental Clinical Specialties & Departments</h3>
                <p className="text-xs text-slate-500">Standard clinical specialties covering all dental disciplines and operatory chair allocations.</p>
              </div>
              <Badge tone="primary">{DENTAL_SPECIALIZATIONS.length} Specialized Departments</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {DENTAL_SPECIALIZATIONS.map((spec) => {
                const docCount = dentists.filter((d) => d.isActive).length;
                return (
                  <div key={spec.code} className="flex flex-col justify-between rounded-xl border border-line bg-gradient-to-br from-white to-slate-50/50 p-4 transition-all hover:border-accent-300 hover:shadow-soft">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-accent-700 bg-accent-50 ring-1 ring-accent-200 px-2 py-0.5 rounded">
                          {spec.code}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          ~{spec.defaultChairMinutes}m chair
                        </span>
                      </div>
                      <h4 className="mt-2.5 text-sm font-bold text-navy leading-snug">{spec.name}</h4>
                      <p className="mt-1.5 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {spec.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line/70 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Eligible Clinicians</span>
                      <span className="font-bold text-navy">{docCount} on panel</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: APPOINTMENT TYPES & DURATIONS ──────────────────────────────── */}
        {activeTab === 'appointment_types' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold text-navy">Clinical Appointment Types & Operatory Durations</h3>
                <p className="text-xs text-slate-500">Standard dental appointment slots and operatory duration presets for front-desk scheduling.</p>
              </div>
              <Badge tone="info">{APPOINTMENT_TYPES.length} Appointment Types</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {APPOINTMENT_TYPES.map((apt) => (
                <div key={apt.id} className="rounded-xl border border-line bg-white p-4 shadow-2xs hover:border-accent-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${apt.color}`}>
                      {apt.category}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-navy text-xs">
                      <Clock size={13} className="text-accent" />
                      {apt.duration} mins
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-navy">{apt.name}</h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{apt.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: PAYMENT CHANNELS & ACCOUNTS ────────────────────────────────── */}
        {activeTab === 'payment_methods' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold text-navy">Payment Channels & Cash Counter Accounts</h3>
                <p className="text-xs text-slate-500">Enable or disable accepted patient payment methods across billing invoices and receipts.</p>
              </div>
              <Button size="sm" icon={Plus} onClick={() => setNewPaymentModal(true)}>
                Add Payment Channel
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Bajaj Finserv EMI', 'Insurance TPA'].map((method) => {
                const isEnabled = currentPaymentMethods.some((m) => m.toLowerCase() === method.toLowerCase());
                return (
                  <div
                    key={method}
                    className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                      isEnabled ? 'border-emerald-300 bg-emerald-50/30' : 'border-line bg-slate-50/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        <Wallet size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-navy text-xs">{method}</p>
                        <p className="text-[11px] text-slate-500">{isEnabled ? 'Active Channel' : 'Disabled'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={paymentBusy}
                      onClick={() => togglePaymentMethod(method)}
                      className={`p-1.5 rounded-lg transition-colors ${isEnabled ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-200'}`}
                      title={isEnabled ? 'Click to disable' : 'Click to enable'}
                    >
                      {isEnabled ? <ToggleRight size={22} className="text-emerald-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
                    </button>
                  </div>
                );
              })}

              {currentPaymentMethods
                .filter((m) => !['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Bajaj Finserv EMI', 'Insurance TPA'].some((std) => std.toLowerCase() === m.toLowerCase()))
                .map((customMethod) => (
                  <div key={customMethod} className="flex items-center justify-between rounded-xl border border-blue-300 bg-blue-50/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <CreditCard size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-navy text-xs">{customMethod}</p>
                        <p className="text-[11px] text-blue-600 font-medium">Custom Channel</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={paymentBusy}
                      onClick={() => togglePaymentMethod(customMethod)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove custom channel"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: MATERIAL VENDORS & SUPPLIERS ─────────────────────────────── */}
        {activeTab === 'suppliers' && (
          <div>
            <div className="flex items-center justify-between border-b border-line/80 p-4 bg-white">
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search suppliers by company name, contact person, or phone…"
                  className="input-base h-9 w-full pl-9 pr-8 text-[12.5px]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => suppliersQuery.refetch()} loading={suppliersQuery.isFetching}>
                Refresh
              </Button>
            </div>

            <DataTable
              columns={[
                {
                  key: 'name',
                  label: 'Supplier / Dealer Name',
                  render: (s) => (
                    <div>
                      <p className="font-semibold text-ink text-[13px]">{s.name}</p>
                      {s.address && <p className="text-[11px] text-slate-500 truncate max-w-sm">{s.address}</p>}
                    </div>
                  )
                },
                {
                  key: 'contactPerson',
                  label: 'Contact Person',
                  render: (s) => <span className="text-[12px] text-slate-700">{s.contactPerson || '—'}</span>
                },
                {
                  key: 'phone',
                  label: 'Phone / Mobile',
                  render: (s) => <span className="font-mono text-[12px] text-slate-800">{s.phone || '—'}</span>
                },
                {
                  key: 'email',
                  label: 'Email',
                  render: (s) => <span className="text-[11.5px] text-slate-600">{s.email || '—'}</span>
                },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (s) => (
                    <Badge tone={s.isActive ? 'success' : 'neutral'}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  )
                },
                {
                  key: 'actions',
                  label: '',
                  align: 'right',
                  render: (s) => (
                    has('inventory.manage') && (
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditSupplier(s)}>
                        Edit
                      </Button>
                    )
                  )
                }
              ]}
              rows={filteredSuppliers}
              loading={suppliersQuery.isLoading}
              error={suppliersQuery.error}
              onRetry={suppliersQuery.refetch}
              emptyTitle="No suppliers registered"
              emptyMessage="Click 'Add Vendor' to register dental consumable and material suppliers."
            />
          </div>
        )}

        {/* ── TAB 5: DENTAL LABORATORIES ─────────────────────────────────────── */}
        {activeTab === 'labs' && (
          <div>
            <div className="flex items-center justify-between border-b border-line/80 p-4 bg-white">
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search labs by name, technician, or phone…"
                  className="input-base h-9 w-full pl-9 pr-8 text-[12.5px]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => labsQuery.refetch()} loading={labsQuery.isFetching}>
                Refresh
              </Button>
            </div>

            <DataTable
              columns={[
                {
                  key: 'name',
                  label: 'Dental Laboratory',
                  render: (l) => (
                    <div>
                      <p className="font-semibold text-ink text-[13px]">{l.name}</p>
                      {l.address && <p className="text-[11px] text-slate-500 truncate max-w-sm">{l.address}</p>}
                    </div>
                  )
                },
                {
                  key: 'contactPerson',
                  label: 'Technician / Contact',
                  render: (l) => <span className="text-[12px] text-slate-700">{l.contactPerson || '—'}</span>
                },
                {
                  key: 'phone',
                  label: 'Phone / Mobile',
                  render: (l) => <span className="font-mono text-[12px] text-slate-800">{l.phone || '—'}</span>
                },
                {
                  key: 'email',
                  label: 'Email',
                  render: (l) => <span className="text-[11.5px] text-slate-600">{l.email || '—'}</span>
                },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (l) => (
                    <Badge tone={l.isActive ? 'success' : 'neutral'}>
                      {l.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  )
                },
                {
                  key: 'actions',
                  label: '',
                  align: 'right',
                  render: (l) => (
                    has('labs.manage') && (
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditLab(l)}>
                        Edit
                      </Button>
                    )
                  )
                }
              ]}
              rows={filteredLabs}
              loading={labsQuery.isLoading}
              error={labsQuery.error}
              onRetry={labsQuery.refetch}
              emptyTitle="No dental laboratories registered"
              emptyMessage="Click 'Add Dental Lab' to register crown & bridge, prosthetics, and clear aligner labs."
            />
          </div>
        )}

        {/* ── TAB 6: PRACTICE & TARIFF RULES ─────────────────────────────────── */}
        {activeTab === 'practice' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50/60 p-4">
                <h4 className="text-sm font-bold text-navy flex items-center gap-2">
                  <Stethoscope size={16} className="text-accent-600" />
                  Clinical Numbering & Chair Defaults
                </h4>
                <div className="mt-3 space-y-2.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Tooth Numbering Standard:</span>
                    <span className="font-bold text-navy">FDI Two-Digit World Notation (ISO 3950)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Adult Dentition:</span>
                    <span className="font-semibold text-slate-800">Quadrants 1 to 4 (Teeth 11–48)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Primary / Deciduous:</span>
                    <span className="font-semibold text-slate-800">Quadrants 5 to 8 (Teeth 51–85)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Standard Operatory Slot:</span>
                    <span className="font-bold text-navy">{clinic.data?.appointmentSlotMinutes || 30} minutes</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Default Routine Recall Cycle:</span>
                    <span className="font-bold text-navy">{clinic.data?.recallMonths || 6} months</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-slate-50/60 p-4">
                <h4 className="text-sm font-bold text-navy flex items-center gap-2">
                  <CreditCard size={16} className="text-emerald-600" />
                  Billing & Tariff Tax Configuration
                </h4>
                <div className="mt-3 space-y-2.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Practice Base Currency:</span>
                    <span className="font-bold text-navy">{clinic.data?.currency || 'INR'} (₹)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Tax Status:</span>
                    <span className="font-bold text-navy">
                      {clinic.data?.taxEnabled ? `${clinic.data?.taxPercent || 0}% GST / Applicable Tax` : 'Exempt (Healthcare)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Authorized Payment Modes:</span>
                    <span className="font-semibold text-slate-800">
                      {(clinic.data?.defaultPaymentMethods || ['Cash', 'UPI', 'Card']).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line/60">
                    <span className="text-slate-500">Invoice Numbering Prefix:</span>
                    <span className="font-mono font-bold text-navy">{clinic.data?.invoicePrefix || 'INV'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Patient Identifier Prefix:</span>
                    <span className="font-mono font-bold text-navy">{clinic.data?.patientPrefix || 'PAT'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: ADD / EDIT PROCEDURE ──────────────────────────────────────── */}
      <Modal
        open={treatmentModal}
        onClose={() => setTreatmentModal(false)}
        title={editingTreatment ? 'Edit Dental Procedure' : 'Add New Dental Procedure'}
        size="md"
      >
        <form onSubmit={saveTreatment} className="space-y-4">
          <FormRow cols={2}>
            <Input
              label="Procedure Code"
              placeholder="e.g. RCT-01, EXT-02"
              value={treatmentForm.code}
              onChange={(e) => setTreatmentForm({ ...treatmentForm, code: e.target.value })}
            />
            <Select
              label="Category"
              value={treatmentForm.category}
              onChange={(e) => setTreatmentForm({ ...treatmentForm, category: e.target.value })}
            >
              {TREATMENT_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </FormRow>

          <Input
            label="Procedure Name"
            required
            placeholder="e.g. Single Sitting Root Canal Treatment"
            value={treatmentForm.name}
            onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })}
          />

          <Input
            label="Standard Price / Fee (₹)"
            required
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 3500"
            value={treatmentForm.defaultPrice}
            onChange={(e) => setTreatmentForm({ ...treatmentForm, defaultPrice: e.target.value })}
          />

          <Textarea
            label="Procedure Description / Clinical Notes"
            rows={2}
            placeholder="Clinical details, scope, materials used…"
            value={treatmentForm.description}
            onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })}
          />

          <Checkbox
            label="Active Procedure (Available in treatment plans & billing)"
            checked={treatmentForm.isActive}
            onChange={(e) => setTreatmentForm({ ...treatmentForm, isActive: e.target.checked })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setTreatmentModal(false)}>Cancel</Button>
            <Button type="submit" loading={treatmentBusy}>
              {editingTreatment ? 'Save Changes' : 'Create Procedure'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: ADD / EDIT MEDICATION ─────────────────────────────────────── */}
      <Modal
        open={medicineModal}
        onClose={() => setMedicineModal(false)}
        title={editingMedicine ? 'Edit Drug Formulation' : 'Add New Medication to Formulary'}
        size="md"
      >
        <form onSubmit={saveMedicine} className="space-y-4">
          <FormRow cols={2}>
            <Input
              label="Medicine Brand / Generic Name"
              required
              placeholder="e.g. Amoxicillin + Potassium Clavulanate"
              value={medicineForm.name}
              onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
            />
            <Input
              label="Strength"
              placeholder="e.g. 625mg, 500mg, 100mg"
              value={medicineForm.strength}
              onChange={(e) => setMedicineForm({ ...medicineForm, strength: e.target.value })}
            />
          </FormRow>

          <FormRow cols={2}>
            <Select
              label="Form"
              value={medicineForm.form}
              onChange={(e) => setMedicineForm({ ...medicineForm, form: e.target.value })}
            >
              {['Tablet', 'Capsule', 'Syrup / Suspension', 'Gel / Ointment', 'Mouthwash', 'Injection', 'Drop'].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>

            <Select
              label="Category"
              value={medicineForm.category}
              onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })}
            >
              {MEDICINE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </FormRow>

          <FormRow cols={2}>
            <Input
              label="Default Dosage"
              placeholder="e.g. 1 tablet, 10ml"
              value={medicineForm.defaultDosage}
              onChange={(e) => setMedicineForm({ ...medicineForm, defaultDosage: e.target.value })}
            />
            <Input
              label="Default Frequency"
              placeholder="e.g. TID (3 times/day), BID (twice daily)"
              value={medicineForm.defaultFrequency}
              onChange={(e) => setMedicineForm({ ...medicineForm, defaultFrequency: e.target.value })}
            />
          </FormRow>

          <FormRow cols={2}>
            <Input
              label="Default Duration"
              placeholder="e.g. 5 days, 3 days"
              value={medicineForm.defaultDuration}
              onChange={(e) => setMedicineForm({ ...medicineForm, defaultDuration: e.target.value })}
            />
            <Input
              label="Allergen Group (Optional)"
              placeholder="e.g. Penicillin, NSAID, Sulfa"
              value={medicineForm.allergenGroup}
              onChange={(e) => setMedicineForm({ ...medicineForm, allergenGroup: e.target.value })}
            />
          </FormRow>

          <Input
            label="Patient Instructions"
            placeholder="e.g. Take after food with a full glass of water"
            value={medicineForm.defaultInstructions}
            onChange={(e) => setMedicineForm({ ...medicineForm, defaultInstructions: e.target.value })}
          />

          <Checkbox
            label="Active in Formulary"
            checked={medicineForm.isActive}
            onChange={(e) => setMedicineForm({ ...medicineForm, isActive: e.target.checked })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setMedicineModal(false)}>Cancel</Button>
            <Button type="submit" loading={medicineBusy}>
              {editingMedicine ? 'Save Drug' : 'Add to Formulary'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: ADD / EDIT SUPPLIER ───────────────────────────────────────── */}
      <Modal
        open={supplierModal}
        onClose={() => setSupplierModal(false)}
        title={editingSupplier ? 'Edit Vendor Details' : 'Add New Material Supplier'}
        size="md"
      >
        <form onSubmit={saveSupplier} className="space-y-4">
          <Input
            label="Company / Vendor Name"
            required
            placeholder="e.g. Dentsply Sirona India, Prime Dental"
            value={supplierForm.name}
            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
          />

          <FormRow cols={2}>
            <Input
              label="Contact Person"
              placeholder="e.g. Rajesh Kumar"
              value={supplierForm.contactPerson}
              onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
            />
            <Input
              label="Phone Number"
              placeholder="e.g. 9876543210"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
            />
          </FormRow>

          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. orders@primedental.com"
            value={supplierForm.email}
            onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
          />

          <Textarea
            label="Office / Warehouse Address"
            rows={2}
            placeholder="Street address, city, pin code…"
            value={supplierForm.address}
            onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
          />

          <Checkbox
            label="Active Vendor"
            checked={supplierForm.isActive}
            onChange={(e) => setSupplierForm({ ...supplierForm, isActive: e.target.checked })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setSupplierModal(false)}>Cancel</Button>
            <Button type="submit" loading={supplierBusy}>
              {editingSupplier ? 'Save Vendor' : 'Register Vendor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: ADD / EDIT LABORATORY ─────────────────────────────────────── */}
      <Modal
        open={labModal}
        onClose={() => setLabModal(false)}
        title={editingLab ? 'Edit Dental Laboratory' : 'Add New Dental Laboratory'}
        size="md"
      >
        <form onSubmit={saveLab} className="space-y-4">
          <Input
            label="Laboratory Name"
            required
            placeholder="e.g. Apex Digital Dental Ceramics"
            value={labForm.name}
            onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
          />

          <FormRow cols={2}>
            <Input
              label="Senior Technician / Contact"
              placeholder="e.g. Suresh Master Tech"
              value={labForm.contactPerson}
              onChange={(e) => setLabForm({ ...labForm, contactPerson: e.target.value })}
            />
            <Input
              label="Phone Number"
              placeholder="e.g. 9444123456"
              value={labForm.phone}
              onChange={(e) => setLabForm({ ...labForm, phone: e.target.value })}
            />
          </FormRow>

          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. apexceramics@gmail.com"
            value={labForm.email}
            onChange={(e) => setLabForm({ ...labForm, email: e.target.value })}
          />

          <Textarea
            label="Laboratory Address"
            rows={2}
            placeholder="Address for pickup & delivery dispatch…"
            value={labForm.address}
            onChange={(e) => setLabForm({ ...labForm, address: e.target.value })}
          />

          <Checkbox
            label="Active Laboratory Partner"
            checked={labForm.isActive}
            onChange={(e) => setLabForm({ ...labForm, isActive: e.target.checked })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setLabModal(false)}>Cancel</Button>
            <Button type="submit" loading={labBusy}>
              {editingLab ? 'Save Laboratory' : 'Register Lab'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── CONFIRM DELETE TEMPLATE ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deletingTemplate)}
        onClose={() => setDeletingTemplate(null)}
        title="Delete Prescription Protocol"
        message={`Are you sure you want to delete template "${deletingTemplate?.name}"? Clinicians will no longer see this preset.`}
        confirmText="Delete Template"
        confirmTone="danger"
        onConfirm={confirmDeleteTemplate}
        loading={deleteBusy}
      />

      {/* ── MODAL: ADD / EDIT DOCTOR ─────────────────────────────────────────── */}
      <Modal
        open={doctorModal}
        onClose={() => setDoctorModal(false)}
        title={editingDoctor ? 'Edit Doctor Profile' : 'Add New Doctor / Practitioner'}
        size="md"
      >
        <form onSubmit={saveDoctor} className="space-y-4">
          <Input
            label="Doctor's Full Name (with Degrees)"
            required
            placeholder="e.g. Dr. Rajesh Kumar MDS"
            value={doctorForm.fullName}
            onChange={(e) => setDoctorForm({ ...doctorForm, fullName: e.target.value })}
          />

          {!editingDoctor && (
            <FormRow cols={2}>
              <Input
                label="Login Username"
                required
                placeholder="e.g. dr.rajesh"
                value={doctorForm.username}
                onChange={(e) => setDoctorForm({ ...doctorForm, username: e.target.value })}
              />
              <Input
                label="Initial Password"
                required
                type="password"
                placeholder="Min 8 characters"
                value={doctorForm.password}
                onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
              />
            </FormRow>
          )}

          <FormRow cols={2}>
            <Input
              label="Contact Mobile / Phone"
              placeholder="e.g. 9876543210"
              value={doctorForm.phone}
              onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. dr.rajesh@clinic.com"
              value={doctorForm.email}
              onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
            />
          </FormRow>

          <Select
            label="Primary Dental Specialization"
            value={doctorForm.specialization}
            onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
          >
            {DENTAL_SPECIALIZATIONS.map((s) => (
              <option key={s.code} value={s.name}>{s.name}</option>
            ))}
          </Select>

          <Checkbox
            label="Active Clinical Practitioner (can be assigned chairs & appointments)"
            checked={doctorForm.isActive}
            onChange={(e) => setDoctorForm({ ...doctorForm, isActive: e.target.checked })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setDoctorModal(false)}>Cancel</Button>
            <Button type="submit" loading={doctorBusy}>
              {editingDoctor ? 'Save Changes' : 'Register Doctor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: RESET DOCTOR PASSWORD ─────────────────────────────────────── */}
      <Modal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        title={`Reset Password: ${resetDoctor?.fullName}`}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-600">
            Enter a new password for <strong className="text-navy">@{resetDoctor?.username}</strong>. They will be required to update it upon sign in.
          </p>

          <Input
            label="New Login Password"
            required
            type="password"
            placeholder="At least 8 characters"
            value={newDoctorPassword}
            onChange={(e) => setNewDoctorPassword(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setPasswordModal(false)}>Cancel</Button>
            <Button type="submit" loading={resetBusy}>
              Set New Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: ADD PAYMENT METHOD ────────────────────────────────────────── */}
      <Modal
        open={newPaymentModal}
        onClose={() => setNewPaymentModal(false)}
        title="Add Payment Channel"
        size="sm"
      >
        <form onSubmit={addCustomPaymentMethod} className="space-y-4">
          <Input
            label="Payment Channel Name"
            required
            placeholder="e.g. Bajaj Finserv, CareCredit, Google Pay"
            value={newPaymentName}
            onChange={(e) => setNewPaymentName(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="secondary" onClick={() => setNewPaymentModal(false)}>Cancel</Button>
            <Button type="submit" loading={paymentBusy}>
              Add Channel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
