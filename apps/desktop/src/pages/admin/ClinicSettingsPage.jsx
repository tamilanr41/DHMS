import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save, Upload, Image as ImageIcon, PenTool, Plus, Pencil, Stethoscope, Settings2, CreditCard, Building2,
  CheckCircle2, Clock, FlaskConical, Percent, Search
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useClinic, useBrandImage } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatMoney } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card from '../../components/ui/Card.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Textarea, FormRow, Checkbox, Select } from '../../components/ui/Input.jsx';
import { PageLoader, ErrorState } from '../../components/ui/States.jsx';

const EMPTY_TREATMENT = { code: '', name: '', category: '', description: '', defaultPrice: '', isActive: true };

export default function ClinicSettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const clinic = useClinic();
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');

  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState(EMPTY_TREATMENT);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [treatmentBusy, setTreatmentBusy] = useState(false);
  const [treatmentError, setTreatmentError] = useState(null);

  const [uploading, setUploading] = useState('');
  const logoInput = useRef(null);
  const signatureInput = useRef(null);
  const logoUrl = useBrandImage('logo');
  const signatureUrl = useBrandImage('signature');

  useEffect(() => {
    if (!clinic.data || form) return;
    const c = clinic.data;
    const snapshot = {
      clinicName: c.clinicName || '',
      address: c.address || '',
      phone: c.phone || '',
      email: c.email || '',
      website: c.website || '',
      timezone: c.timezone || 'Asia/Kolkata',
      currency: c.currency || 'INR',
      workingStart: c.workingHours?.start || '',
      workingEnd: c.workingHours?.end || '',
      receiptFooter: c.receiptFooter || '',
      prescriptionFooter: c.prescriptionFooter || '',
      dentistName: c.dentistName || '',
      dentistQualification: c.dentistQualification || '',
      dentistRegistrationNo: c.dentistRegistrationNo || '',
      dentistContact: c.dentistContact || '',
      appointmentSlotMinutes: String(c.appointmentSlotMinutes ?? 30),
      invoicePrefix: c.invoicePrefix || 'INV',
      patientPrefix: c.patientPrefix || 'PAT',
      prescriptionPrefix: c.prescriptionPrefix || 'RX',
      sessionTimeoutMinutes: String(c.sessionTimeoutMinutes ?? 60),
      labModuleEnabled: Boolean(c.labModuleEnabled),
      taxEnabled: Boolean(c.taxEnabled),
      taxPercent: String(c.taxPercent ?? 0),
      recallMonths: String(c.recallMonths ?? 6),
      toothNumbering: c.toothNumbering || 'fdi',
      periodontalChartingEnabled: c.periodontalChartingEnabled !== false,
      labWorkTypesText: (c.labWorkTypes || []).join(', '),
      paymentMethodsText: (c.defaultPaymentMethods || []).join(', '),
      backupDirectory: c.backupPreferences?.directory || ''
    };
    setForm(snapshot);
    setInitialForm(snapshot);
  }, [clinic.data, form]);

  const treatments = useQuery({
    queryKey: ['treatments', 'all'],
    queryFn: async () => (await api.get('/treatments?includeInactive=true')).data,
    enabled: tab === 'services'
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (saving) return;
    setSaveError(null);
    if (!form.clinicName.trim()) return setSaveError('Clinic name is required.');
    const methods = form.paymentMethodsText.split(',').map((m) => m.trim()).filter(Boolean);
    if (!methods.length) return setSaveError('Add at least one payment method.');
    const labWorkTypes = form.labWorkTypesText.split(',').map((m) => m.trim()).filter(Boolean);
    if (!labWorkTypes.length) return setSaveError('Add at least one laboratory work type.');
    setSaving(true);
    try {
      const res = await api.patch('/clinic', {
        clinicName: form.clinicName.trim(),
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        timezone: form.timezone,
        currency: form.currency,
        workingHours: { start: form.workingStart || null, end: form.workingEnd || null },
        receiptFooter: form.receiptFooter || null,
        prescriptionFooter: form.prescriptionFooter || null,
        dentistName: form.dentistName || null,
        dentistQualification: form.dentistQualification || null,
        dentistRegistrationNo: form.dentistRegistrationNo || null,
        dentistContact: form.dentistContact || null,
        appointmentSlotMinutes: Number(form.appointmentSlotMinutes),
        invoicePrefix: form.invoicePrefix.trim(),
        patientPrefix: form.patientPrefix.trim(),
        prescriptionPrefix: form.prescriptionPrefix.trim(),
        sessionTimeoutMinutes: Number(form.sessionTimeoutMinutes),
        labModuleEnabled: form.labModuleEnabled,
        taxEnabled: form.taxEnabled,
        taxPercent: Number(form.taxPercent || 0),
        defaultPaymentMethods: methods,
        recallMonths: Number(form.recallMonths || 6),
        toothNumbering: form.toothNumbering,
        periodontalChartingEnabled: form.periodontalChartingEnabled,
        labWorkTypes,
        backupPreferences: { ...(clinic.data?.backupPreferences || {}), directory: form.backupDirectory.trim() || null }
      });
      queryClient.setQueryData(['clinic'], res.data);
      setInitialForm(form);
      toast.success('Clinic settings saved');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (!form || !['general', 'clinical', 'billing'].includes(tab)) return;
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, tab, saving]);

  const uploadBranding = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    const data = new FormData();
    data.append('file', file);
    try {
      await api.upload(`/clinic/${kind}`, data);
      await queryClient.invalidateQueries({ queryKey: ['clinic'] });
      toast.success(kind === 'logo' ? 'Clinic logo updated' : 'Dentist signature updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading('');
      if (kind === 'logo' && logoInput.current) logoInput.current.value = '';
      if (kind === 'signature' && signatureInput.current) signatureInput.current.value = '';
    }
  };

  const openNewTreatment = () => {
    setEditingTreatment(null);
    setTreatmentForm(EMPTY_TREATMENT);
    setTreatmentError(null);
    setTreatmentOpen(true);
  };

  const openEditTreatment = (t) => {
    setEditingTreatment(t);
    setTreatmentForm({
      code: t.code || '',
      name: t.name,
      category: t.category,
      description: t.description || '',
      defaultPrice: String(t.defaultPrice ?? ''),
      isActive: t.isActive
    });
    setTreatmentError(null);
    setTreatmentOpen(true);
  };

  const submitTreatment = async () => {
    setTreatmentError(null);
    if (treatmentForm.name.trim().length < 2) return setTreatmentError('Service name is required.');
    if (!treatmentForm.category.trim()) return setTreatmentError('Category is required.');
    if (treatmentForm.defaultPrice === '' || Number(treatmentForm.defaultPrice) < 0) return setTreatmentError('Enter a valid default price.');
    setTreatmentBusy(true);
    const payload = {
      code: treatmentForm.code || null,
      name: treatmentForm.name.trim(),
      category: treatmentForm.category.trim(),
      description: treatmentForm.description || null,
      defaultPrice: Number(treatmentForm.defaultPrice),
      isActive: treatmentForm.isActive
    };
    try {
      if (editingTreatment) await api.patch(`/treatments/${editingTreatment.id}`, payload);
      else await api.post('/treatments', payload);
      toast.success(`${payload.name} saved`);
      setTreatmentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
    } catch (err) {
      setTreatmentError(err.message);
    } finally {
      setTreatmentBusy(false);
    }
  };

  const dirty = Boolean(form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm));

  const serviceRows = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return treatments.data || [];
    return (treatments.data || []).filter((t) =>
      t.name?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }, [treatments.data, serviceSearch]);

  if (clinic.isLoading || !form) return <PageLoader label="Loading clinic settings…" />;
  if (clinic.error) return <ErrorState error={clinic.error} onRetry={clinic.refetch} />;

  const treatmentColumns = [
    { key: 'name', label: 'Service', render: (t) => <div><p className="font-medium text-ink">{t.name}</p><p className="text-xs text-slate-500">{t.code || 'No code'}</p></div> },
    { key: 'category', label: 'Category' },
    { key: 'defaultPrice', label: 'Default price', align: 'right', render: (t) => formatMoney(t.defaultPrice) },
    { key: 'isActive', label: 'Status', render: (t) => <Badge tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', align: 'right', render: (t) => <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditTreatment(t)}>Edit</Button> }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Practice Configuration"
        title="Dental Practice Settings & Clinical Master"
        subtitle="Manage clinic identity, FDI odontogram rules, default fees, GST tax configuration, and letterhead branding."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Clinic settings' }]}
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </span>
            )}
            <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save settings</Button>
          </div>
        }
      />

      {/* Doccure Dental Clinic Settings Strip */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8c8] to-[#0a7f8b] text-white shadow-md">
              <Building2 size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Clinic Profile</p>
              <p className="truncate text-base font-black text-slate-900 dark:text-white">{form.clinicName || 'Not configured'}</p>
              <p className="truncate text-xs font-medium text-slate-400" title={form.address}>{form.address || 'Address pending'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <Clock size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Practice Hours</p>
              <p className="truncate text-base font-black text-purple-600 dark:text-purple-400 tabular-nums">
                {form.workingStart || '09:00'} – {form.workingEnd || '20:00'}
              </p>
              <p className="truncate text-xs font-bold text-slate-400">{form.appointmentSlotMinutes} min chair slots</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-white shadow-md">
              <FlaskConical size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Active Modules</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={form.labModuleEnabled ? 'success' : 'neutral'}>Lab {form.labModuleEnabled ? 'ON' : 'OFF'}</Badge>
                <Badge tone={form.taxEnabled ? 'accent' : 'neutral'}>GST {form.taxEnabled ? 'ON' : 'OFF'}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md">
              <Percent size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Billing Protocol</p>
              <p className="truncate text-base font-black text-emerald-600 dark:text-emerald-400">
                {form.currency} · {form.taxEnabled ? `${form.taxPercent || 0}% Tax` : 'No Tax'}
              </p>
              <p className="truncate text-xs font-bold text-slate-400">
                {form.paymentMethodsText.split(',').map((m) => m.trim()).filter(Boolean).length} Payment Modes
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-base">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { value: 'general', label: 'General', icon: Building2 },
              { value: 'clinical', label: 'Clinical', icon: Stethoscope },
              { value: 'billing', label: 'Billing & tax', icon: CreditCard },
              { value: 'branding', label: 'Branding', icon: ImageIcon },
              { value: 'services', label: 'Services', icon: Settings2 }
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        <div className="p-5">
          {tab === 'general' && (
            <div className="space-y-4">
              <FormRow cols={2}>
                <Input label="Clinic name" required value={form.clinicName} onChange={(e) => set({ clinicName: e.target.value })} />
                <Input label="Phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </FormRow>
              <FormRow cols={2}>
                <Input label="Email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
                <Input label="Website" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
              </FormRow>
              <Textarea label="Address" rows={2} value={form.address} onChange={(e) => set({ address: e.target.value })} />
              <FormRow cols={4}>
                <Input label="Working hours from" type="time" value={form.workingStart} onChange={(e) => set({ workingStart: e.target.value })} />
                <Input label="Working hours to" type="time" value={form.workingEnd} onChange={(e) => set({ workingEnd: e.target.value })} />
                <Input label="Time zone" value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} hint="IANA name, e.g. Asia/Kolkata" />
                <Input label="Currency" value={form.currency} onChange={(e) => set({ currency: e.target.value })} hint="ISO code, e.g. INR" />
              </FormRow>
              <FormRow cols={2}>
                <Input label="Appointment slot (minutes)" type="number" min="5" max="240" value={form.appointmentSlotMinutes} onChange={(e) => set({ appointmentSlotMinutes: e.target.value })} />
                <Input label="Session timeout (minutes)" type="number" min="5" max="480" value={form.sessionTimeoutMinutes} onChange={(e) => set({ sessionTimeoutMinutes: e.target.value })} hint="Access tokens are short-lived; refresh sessions expire after this idle period." />
              </FormRow>
              <Input label="Backup folder" value={form.backupDirectory} onChange={(e) => set({ backupDirectory: e.target.value })} placeholder="Leave blank for the default application data folder" hint="Absolute path on the server machine, e.g. D:\ClinicBackups" />
            </div>
          )}

          {tab === 'clinical' && (
            <div className="space-y-5">
              <section>
                <h3 className="text-[12px] font-semibold text-navy">Prescriber identity</h3>
                <p className="mb-3 text-[11px] text-slate-500">Printed on prescriptions and clinical PDFs.</p>
                <div className="space-y-4">
                  <FormRow cols={2}>
                    <Input label="Dentist name" value={form.dentistName} onChange={(e) => set({ dentistName: e.target.value })} />
                    <Input label="Qualification" value={form.dentistQualification} onChange={(e) => set({ dentistQualification: e.target.value })} placeholder="BDS, MDS" />
                  </FormRow>
                  <FormRow cols={2}>
                    <Input label="Registration number" value={form.dentistRegistrationNo} onChange={(e) => set({ dentistRegistrationNo: e.target.value })} />
                    <Input label="Dentist contact" value={form.dentistContact} onChange={(e) => set({ dentistContact: e.target.value })} />
                  </FormRow>
                </div>
              </section>

              <section className="rounded-lg border border-line bg-slate-50/50 p-4">
                <h3 className="text-[12px] font-semibold text-navy">Recall &amp; charting</h3>
                <p className="mb-3 text-[11px] text-slate-500">Used by the recall list and the dental chart.</p>
                <FormRow cols={3}>
                  <Input
                    label="Recall interval (months)"
                    type="number"
                    min="1"
                    max="60"
                    value={form.recallMonths}
                    onChange={(e) => set({ recallMonths: e.target.value })}
                    hint="Reviews fall due this many months after the last completed visit."
                  />
                  <Select label="Tooth notation" value={form.toothNumbering} onChange={(e) => set({ toothNumbering: e.target.value })} hint="Display preference for charts and plans.">
                    <option value="fdi">FDI (11–48)</option>
                    <option value="universal">Universal (1–32)</option>
                  </Select>
                  <div className="flex items-end pb-1">
                    <Checkbox
                      label="Enable periodontal charting"
                      checked={form.periodontalChartingEnabled}
                      onChange={(e) => set({ periodontalChartingEnabled: e.target.checked })}
                    />
                  </div>
                </FormRow>
              </section>

              <section>
                <h3 className="text-[12px] font-semibold text-navy">Laboratory &amp; prescriptions</h3>
                <p className="mb-3 text-[11px] text-slate-500">Configure the work types offered when sending a case to the lab.</p>
                <div className="space-y-4">
                  <Textarea
                    label="Laboratory work types"
                    rows={3}
                    value={form.labWorkTypesText}
                    onChange={(e) => set({ labWorkTypesText: e.target.value })}
                    hint="Comma separated. These appear as quick suggestions on new lab orders."
                  />
                  <Textarea label="Prescription footer" rows={2} value={form.prescriptionFooter} onChange={(e) => set({ prescriptionFooter: e.target.value })} hint="Printed at the bottom of prescriptions" />
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={form.labModuleEnabled} onChange={(e) => set({ labModuleEnabled: e.target.checked })} className="h-4 w-4 rounded border-line text-accent" />
                    Enable dental laboratory module
                  </label>
                </div>
              </section>
            </div>
          )}

          {tab === 'billing' && (
            <div className="space-y-4">
              <FormRow cols={3}>
                <Input label="Invoice prefix" value={form.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} />
                <Input label="Patient prefix" value={form.patientPrefix} onChange={(e) => set({ patientPrefix: e.target.value })} />
                <Input label="Prescription prefix" value={form.prescriptionPrefix} onChange={(e) => set({ prescriptionPrefix: e.target.value })} />
              </FormRow>
              <div className="rounded-md border border-line p-3">
                <Checkbox label="Apply tax on invoices" checked={form.taxEnabled} onChange={(e) => set({ taxEnabled: e.target.checked })} />
                <div className="mt-3 max-w-xs">
                  <Input label="Tax percent" type="number" min="0" max="100" step="0.01" value={form.taxPercent} onChange={(e) => set({ taxPercent: e.target.value })} disabled={!form.taxEnabled} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">New invoices default to this rate. Each invoice stores the tax rate used at the time it was raised.</p>
              </div>
              <Input label="Payment methods" value={form.paymentMethodsText} onChange={(e) => set({ paymentMethodsText: e.target.value })} hint="Comma separated. These appear when collecting payments." />
              <Textarea label="Receipt footer" rows={2} value={form.receiptFooter} onChange={(e) => set({ receiptFooter: e.target.value })} hint="Printed at the bottom of invoices and receipts" />
            </div>
          )}

          {tab === 'branding' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card title="Clinic logo" subtitle="Used on invoices, prescriptions and reports">
                <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-line bg-slate-50 p-4">
                  {logoUrl ? <img src={logoUrl} alt="Clinic logo" className="max-h-24 max-w-full object-contain" /> : <p className="text-xs text-slate-500">No logo uploaded</p>}
                </div>
                <input ref={logoInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => uploadBranding('logo', e.target.files?.[0])} />
                <Button className="mt-3" variant="secondary" icon={Upload} loading={uploading === 'logo'} onClick={() => logoInput.current?.click()}>Upload logo</Button>
                <p className="mt-2 text-[11px] text-slate-500">PNG or JPEG, up to the size limit enforced by the server.</p>
              </Card>
              <Card title="Dentist signature" subtitle="Printed on prescriptions">
                <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-line bg-slate-50 p-4">
                  {signatureUrl ? <img src={signatureUrl} alt="Dentist signature" className="max-h-24 max-w-full object-contain" /> : <p className="text-xs text-slate-500">No signature uploaded</p>}
                </div>
                <input ref={signatureInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => uploadBranding('signature', e.target.files?.[0])} />
                <Button className="mt-3" variant="secondary" icon={PenTool} loading={uploading === 'signature'} onClick={() => signatureInput.current?.click()}>Upload signature</Button>
                <p className="mt-2 text-[11px] text-slate-500">A transparent PNG works best.</p>
              </Card>
            </div>
          )}

          {tab === 'services' && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-navy">Service catalog</h3>
                  <p className="text-xs text-slate-500">Prices prefill invoice lines and treatment plans. Existing invoices keep their recorded price.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Search services…"
                      className="input-base h-9 w-[210px] pl-8 text-[12px]"
                      aria-label="Search services"
                    />
                  </div>
                  <Button size="sm" icon={Plus} onClick={openNewTreatment}>New service</Button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <DataTable
                  columns={treatmentColumns}
                  rows={serviceRows}
                  loading={treatments.isLoading}
                  error={treatments.error}
                  onRetry={treatments.refetch}
                  emptyTitle={serviceSearch ? 'No matching services' : 'No services yet'}
                  emptyMessage={serviceSearch ? 'Adjust the search to find the service you need.' : 'Add the treatments your clinic offers.'}
                  emptyAction={!serviceSearch ? <Button size="sm" variant="secondary" icon={Plus} onClick={openNewTreatment}>New service</Button> : null}
                  footer={
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{serviceRows.length} of {(treatments.data || []).length} service{(treatments.data || []).length === 1 ? '' : 's'}</span>
                      <span className="hidden sm:inline">Inactive services stay visible here but are hidden from billing</span>
                    </div>
                  }
                />
              </div>
            </div>
          )}
        </div>

        {['general', 'clinical', 'billing'].includes(tab) && (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
            {saveError ? (
              <p className="text-xs font-medium text-red-700">{saveError}</p>
            ) : dirty ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <CheckCircle2 size={13} className="text-emerald-600" /> All settings saved · every change is audit-logged
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-slate-400 sm:inline">Ctrl+S to save</span>
              <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save settings</Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={treatmentOpen}
        onClose={() => !treatmentBusy && setTreatmentOpen(false)}
        title={editingTreatment ? `Edit ${editingTreatment.name}` : 'New service'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTreatmentOpen(false)} disabled={treatmentBusy}>Cancel</Button>
            <Button icon={Save} onClick={submitTreatment} loading={treatmentBusy}>{editingTreatment ? 'Save changes' : 'Add service'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow cols={2}>
            <Input label="Service name" required value={treatmentForm.name} onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })} />
            <Input label="Code" value={treatmentForm.code} onChange={(e) => setTreatmentForm({ ...treatmentForm, code: e.target.value })} placeholder="Optional" />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Category" required value={treatmentForm.category} onChange={(e) => setTreatmentForm({ ...treatmentForm, category: e.target.value })} placeholder="e.g. Restorative" />
            <Input label="Default price (₹)" type="number" min="0" step="0.01" required value={treatmentForm.defaultPrice} onChange={(e) => setTreatmentForm({ ...treatmentForm, defaultPrice: e.target.value })} />
          </FormRow>
          <Textarea label="Description" rows={2} value={treatmentForm.description} onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })} />
          {editingTreatment && (
            <Checkbox label="Service is active" checked={treatmentForm.isActive} onChange={(e) => setTreatmentForm({ ...treatmentForm, isActive: e.target.checked })} />
          )}
          {treatmentError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{treatmentError}</p>}
        </div>
      </Modal>
    </div>
  );
}
