import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FlaskConical, Pencil, ClipboardList, AlertTriangle, Settings2, RefreshCw, Clock, CheckCircle2, CalendarClock, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useClinic } from '../../hooks/useClinic.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatMoney, humanize, todayISO } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { StatCard } from '../../components/ui/Card.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea, FormRow, Checkbox } from '../../components/ui/Input.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const STATUSES = ['created', 'sent_to_lab', 'in_progress', 'received', 'fitted', 'cancelled'];
const AWAITING = ['created', 'sent_to_lab', 'in_progress'];
const FALLBACK_WORK_TYPES = [
  'Zirconia crown', 'PFM crown', 'E-max crown', 'Veneer', 'Bridge', 'Complete denture',
  'Partial denture', 'Denture repair', 'Implant abutment', 'Clear aligner', 'Orthodontic retainer',
  'Night guard', 'Study model'
];

const EMPTY_ORDER = {
  patient: null, laboratoryId: '', toothNumber: '', workType: '', sentDate: todayISO(),
  expectedDate: '', charge: '', notes: '', status: 'created'
};
const EMPTY_LAB = { name: '', contactPerson: '', phone: '', email: '', address: '', isActive: true };

const VITA_SHADES = [
  { code: 'A1', hex: '#faf7ee', desc: 'Light reddish-brown' },
  { code: 'A2', hex: '#f4ede0', desc: 'Universal anterior' },
  { code: 'A3', hex: '#ebdcc5', desc: 'Natural universal' },
  { code: 'A3.5', hex: '#dfcbaf', desc: 'Warm natural' },
  { code: 'A4', hex: '#cbb38f', desc: 'Dark reddish-brown' },
  { code: 'B1', hex: '#fcfaf2', desc: 'Light yellowish' },
  { code: 'B2', hex: '#f6eedc', desc: 'Yellowish' },
  { code: 'B3', hex: '#ebd9ba', desc: 'Deep yellow' },
  { code: 'C1', hex: '#efebe3', desc: 'Light greyish' },
  { code: 'C2', hex: '#ded7c9', desc: 'Greyish' },
  { code: 'D2', hex: '#eee6dc', desc: 'Reddish-grey' },
  { code: 'BL1', hex: '#ffffff', desc: 'Bleach extra white' },
  { code: 'BL2', hex: '#fbfbf9', desc: 'Bleach white' },
  { code: 'BL3', hex: '#f7f6f1', desc: 'Bleach natural' }
];

const IMPRESSION_PRESETS = [
  'Digital 3D Intraoral Scan (STL)',
  'Addition Silicone (PVS Putty + Light Body)',
  'Alginate Study Model',
  'Bite Registration Taken'
];

const OCCLUSION_PRESETS = [
  'Normal Occlusion (0.5mm clearance)',
  'Heavy Bite / Deep Overbite',
  'Severe Bruxism (Night grinder)',
  'Opposing Natural Dentition'
];

export default function LabsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const clinic = useClinic();
  const labEnabled = clinic.data?.labModuleEnabled !== false;
  const workTypes = clinic.data?.labWorkTypes?.length ? clinic.data.labWorkTypes : FALLBACK_WORK_TYPES;
  const today = todayISO();

  const [tab, setTab] = useState('orders');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', order: 'desc' });

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState(null);

  const [editingOrder, setEditingOrder] = useState(null);
  const [updateForm, setUpdateForm] = useState({ status: 'created', expectedDate: '', deliveredDate: '', charge: '', notes: '' });
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const [labOpen, setLabOpen] = useState(false);
  const [labForm, setLabForm] = useState(EMPTY_LAB);
  const [editingLab, setEditingLab] = useState(null);
  const [labBusy, setLabBusy] = useState(false);
  const [labError, setLabError] = useState(null);

  const orderParams = new URLSearchParams();
  if (status) orderParams.set('status', status);
  if (search.trim()) orderParams.set('q', search.trim());

  const orders = useQuery({
    queryKey: ['lab-orders', status, search],
    queryFn: async () => (await api.get(`/laboratories/orders?${orderParams.toString()}`)).data,
    enabled: labEnabled
  });

  const allOrders = useQuery({
    queryKey: ['lab-orders', 'all'],
    queryFn: async () => (await api.get('/laboratories/orders')).data,
    enabled: labEnabled
  });

  const labs = useQuery({
    queryKey: ['laboratories'],
    queryFn: async () => (await api.get('/laboratories')).data
  });

  const orderRows = orders.data || [];
  const activeLabs = (labs.data || []).filter((l) => l.is_active);

  const summary = useMemo(() => {
    const all = allOrders.data || [];
    return {
      total: all.length,
      awaiting: all.filter((o) => AWAITING.includes(o.status)).length,
      overdue: all.filter((o) => AWAITING.includes(o.status) && o.expectedDate && String(o.expectedDate).slice(0, 10) < today).length,
      ready: all.filter((o) => o.status === 'received').length
    };
  }, [allOrders.data, today]);

  const sortedRows = useMemo(() => {
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...orderRows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sort.key === 'charge') return (Number(av) - Number(bv)) * dir;
      if (sort.key === 'createdAt' || sort.key === 'expectedDate' || sort.key === 'sentDate') {
        return (new Date(av) - new Date(bv)) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [orderRows, sort]);

  const isOverdue = (order) => AWAITING.includes(order.status) && order.expectedDate && String(order.expectedDate).slice(0, 10) < today;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    queryClient.invalidateQueries({ queryKey: ['laboratories'] });
  };

  const openNewOrder = () => {
    setOrderForm(EMPTY_ORDER);
    setOrderError(null);
    setOrderOpen(true);
  };

  const submitOrder = async () => {
    setOrderError(null);
    if (!orderForm.patient?.id) return setOrderError('Select a patient.');
    if (!orderForm.laboratoryId) return setOrderError('Select a laboratory.');
    if (orderForm.workType.trim().length < 2) return setOrderError('Describe the work sent to the lab.');

    setOrderBusy(true);
    try {
      await api.post('/laboratories/orders', {
        patientId: orderForm.patient.id,
        laboratoryId: orderForm.laboratoryId,
        toothNumber: orderForm.toothNumber || null,
        workType: orderForm.workType.trim(),
        sentDate: orderForm.sentDate || null,
        expectedDate: orderForm.expectedDate || null,
        charge: orderForm.charge === '' ? 0 : Number(orderForm.charge),
        notes: orderForm.notes || null,
        status: orderForm.status
      });
      toast.success('Lab order created');
      setOrderOpen(false);
      invalidate();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setOrderBusy(false);
    }
  };

  const openUpdate = (order) => {
    setEditingOrder(order);
    setUpdateForm({
      status: order.status,
      expectedDate: order.expectedDate ? String(order.expectedDate).slice(0, 10) : '',
      deliveredDate: order.deliveredDate ? String(order.deliveredDate).slice(0, 10) : '',
      charge: String(order.charge ?? ''),
      notes: order.notes || ''
    });
    setUpdateError(null);
  };

  const submitUpdate = async () => {
    setUpdateError(null);
    setUpdateBusy(true);
    try {
      await api.patch(`/laboratories/orders/${editingOrder.id}`, {
        status: updateForm.status,
        expectedDate: updateForm.expectedDate || null,
        deliveredDate: updateForm.status === 'received' || updateForm.status === 'fitted' ? updateForm.deliveredDate || null : null,
        charge: updateForm.charge === '' ? undefined : Number(updateForm.charge),
        notes: updateForm.notes || null
      });
      toast.success(`Order ${editingOrder.orderNo} updated`);
      setEditingOrder(null);
      invalidate();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdateBusy(false);
    }
  };

  const openNewLab = () => {
    setEditingLab(null);
    setLabForm(EMPTY_LAB);
    setLabError(null);
    setLabOpen(true);
  };

  const openEditLab = (lab) => {
    setEditingLab(lab);
    setLabForm({
      name: lab.name,
      contactPerson: lab.contact_person || '',
      phone: lab.phone || '',
      email: lab.email || '',
      address: lab.address || '',
      isActive: lab.is_active
    });
    setLabError(null);
    setLabOpen(true);
  };

  const submitLab = async () => {
    setLabError(null);
    if (labForm.name.trim().length < 2) return setLabError('Laboratory name is required.');
    setLabBusy(true);
    const payload = {
      name: labForm.name.trim(),
      contactPerson: labForm.contactPerson || null,
      phone: labForm.phone || null,
      email: labForm.email || null,
      address: labForm.address || null,
      isActive: labForm.isActive
    };
    try {
      if (editingLab) await api.patch(`/laboratories/${editingLab.id}`, payload);
      else await api.post('/laboratories', payload);
      toast.success(`Laboratory ${payload.name} saved`);
      setLabOpen(false);
      invalidate();
    } catch (err) {
      setLabError(err.message);
    } finally {
      setLabBusy(false);
    }
  };

  const orderColumns = [
    {
      key: 'orderNo',
      label: 'Order',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-mono text-[11.5px] font-semibold text-navy">{r.orderNo}</p>
          <p className="mt-0.5 text-[10.5px] text-slate-400">{formatDate(r.sentDate || r.createdAt)}</p>
        </div>
      )
    },
    {
      key: 'patientName',
      label: 'Patient',
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <Link
            to={`/patients/${r.patientId}`}
            onClick={(e) => e.stopPropagation()}
            className="truncate font-medium text-ink transition-colors hover:text-accent"
          >
            {r.patientName}
          </Link>
          <p className="text-[10.5px] text-slate-500">{r.patientNo}</p>
        </div>
      )
    },
    {
      key: 'laboratoryName',
      label: 'Laboratory',
      sortable: true,
      render: (r) => <span className="text-[12px] text-slate-600">{r.laboratoryName}</span>
    },
    {
      key: 'workType',
      label: 'Work',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[12px] text-ink" title={r.workType}>{r.workType}</p>
          {r.toothNumber && <p className="text-[10.5px] text-slate-500">Tooth {r.toothNumber}</p>}
        </div>
      )
    },
    {
      key: 'expectedDate',
      label: 'Expected',
      sortable: true,
      render: (r) =>
        r.expectedDate ? (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[12px] ${isOverdue(r) ? 'font-medium text-red-700' : 'text-slate-600'}`}>
            {isOverdue(r) && <CalendarClock size={12} />}
            {formatDate(r.expectedDate)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )
    },
    {
      key: 'charge',
      label: 'Charge',
      align: 'right',
      sortable: true,
      render: (r) => <span className="tabular-nums text-[12px] text-slate-600">{formatMoney(r.charge)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge status={r.status} />
          {isOverdue(r) && <Badge tone="danger">Overdue</Badge>}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => has('labs.manage') ? (
        <Button size="sm" variant="ghost" icon={Pencil} onClick={(e) => { e.stopPropagation(); openUpdate(r); }}>Update</Button>
      ) : null
    }
  ];

  const labColumns = [
    {
      key: 'name',
      label: 'Laboratory',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.name}</p>
          {r.address && <p className="truncate text-[10.5px] text-slate-500">{r.address}</p>}
        </div>
      )
    },
    { key: 'contact_person', label: 'Contact', render: (r) => r.contact_person || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    ...(has('labs.manage') ? [{
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditLab(r)}>Edit</Button>
    }] : [])
  ];

  return (
    <div>
      {/* Doccure Dental Signature Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#08636d] p-6 text-white shadow-xl mb-6">
        <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-15 pointer-events-none">
          <img src={heroTooth} alt="" className="h-64 translate-x-12" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-0.5 text-xs font-black tracking-wide text-white backdrop-blur-sm">
              <FlaskConical size={14} className="stroke-[2.5]" />
              PROSTHETICS, ORTHODONTICS &amp; LAB TRACKING
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Dental Laboratory &amp; Prosthesis Tracking
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Track custom zirconia crowns, PFM bridges, complete dentures, clear aligners, and fabrication turnarounds across partner laboratories.
            </p>
          </div>
          {has('labs.manage') && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openNewLab}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-black text-white hover:bg-white/25 backdrop-blur-sm transition border border-white/20 cursor-pointer shadow-xs"
              >
                <FlaskConical size={14} />
                New Laboratory
              </button>
              <button
                type="button"
                onClick={openNewOrder}
                disabled={!labEnabled || !activeLabs.length}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-[#0a7f8b] shadow-lg hover:bg-teal-50 hover:shadow-xl transition cursor-pointer disabled:opacity-50"
              >
                <Plus size={16} className="stroke-[3]" />
                New Lab Order
              </button>
            </div>
          )}
        </div>
      </div>

      {!labEnabled && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 shadow-xs dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-black text-amber-950 dark:text-amber-100">Laboratory module is disabled.</p>
            <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              Enable it in <Link to="/admin/clinic" className="underline font-bold">clinic settings</Link> before dispatching lab orders.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards: Strictly Matches Waiting Queue Screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <DoccureKpiCard
          title="PROSTHETIC ORDERS"
          value={summary.total}
          subtitle="total cases"
          icon={ClipboardList}
          variant="teal"
        />
        <DoccureKpiCard
          title="IN FABRICATION"
          value={summary.awaiting}
          subtitle="at dental lab"
          icon={Clock}
          variant="purple"
        />
        <DoccureKpiCard
          title="DELIVERY OVERDUE"
          value={summary.overdue}
          subtitle="past promise date"
          icon={AlertTriangle}
          variant="rose"
        />
        <DoccureKpiCard
          title="READY FOR FITTING"
          value={summary.ready}
          subtitle="in clinic"
          icon={CheckCircle2}
          variant="emerald"
          hasDot
        />
      </div>

      <div className="card-base overflow-hidden">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { value: 'orders', label: 'Lab orders', count: summary.total },
              { value: 'labs', label: 'Laboratories', count: labs.data?.length }
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {tab === 'orders' ? (
          labEnabled ? (
            <>
              <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by order number or patient…">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-[140px] text-[11.5px]" aria-label="Filter by order status">
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={() => orders.refetch()}
                  loading={orders.isFetching}
                  aria-label="Refresh lab orders"
                >
                  Refresh
                </Button>
              </TableToolbar>
              <DataTable
                columns={orderColumns}
                rows={sortedRows}
                loading={orders.isLoading}
                error={orders.error}
                onRetry={orders.refetch}
                sort={sort}
                onSortChange={setSort}
                emptyTitle={search || status ? 'No matching lab orders' : 'No lab orders'}
                emptyMessage={
                  search || status
                    ? 'Adjust the search or status filter to find the order you need.'
                    : activeLabs.length
                      ? 'Create a lab order when work is sent to a laboratory.'
                      : 'Add a laboratory first, then create orders.'
                }
                emptyAction={
                  has('labs.manage') && !search && !status ? (
                    activeLabs.length
                      ? <Button size="sm" variant="secondary" icon={Plus} onClick={openNewOrder}>New lab order</Button>
                      : <Button size="sm" variant="secondary" icon={FlaskConical} onClick={openNewLab}>Add laboratory</Button>
                  ) : null
                }
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{sortedRows.length} of {summary.total} order{summary.total === 1 ? '' : 's'}</span>
                    <span className="hidden sm:inline">Newest orders appear first by default</span>
                  </div>
                }
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-gradient-to-b from-white to-slate-50 text-slate-400">
                <Settings2 size={21} />
              </span>
              <p className="mt-1 text-[13px] font-semibold text-ink">Laboratory module disabled</p>
              <p className="max-w-sm text-[11.5px] leading-relaxed text-slate-500">
                Enable the lab module in clinic settings to record external prosthetic work.
              </p>
              <Link to="/admin/clinic" className="link mt-1 text-[12px] font-semibold">Open clinic settings</Link>
            </div>
          )
        ) : (
          <DataTable
            columns={labColumns}
            rows={labs.data || []}
            loading={labs.isLoading}
            error={labs.error}
            onRetry={labs.refetch}
            emptyTitle="No laboratories"
            emptyMessage="Add the dental laboratories your clinic works with."
            emptyAction={has('labs.manage') ? <Button size="sm" variant="secondary" icon={Plus} onClick={openNewLab}>New laboratory</Button> : null}
          />
        )}
      </div>

      <Modal
        open={orderOpen}
        onClose={() => !orderBusy && setOrderOpen(false)}
        title="New lab order"
        subtitle="Record the prosthetic work sent out and when it is expected back."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOrderOpen(false)} disabled={orderBusy}>Cancel</Button>
            <Button icon={ClipboardList} onClick={submitOrder} loading={orderBusy}>Create order</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <PatientPicker value={orderForm.patient} onChange={(p) => setOrderForm({ ...orderForm, patient: p })} required />
            <FormRow cols={2}>
              <Select label="Laboratory" required value={orderForm.laboratoryId} onChange={(e) => setOrderForm({ ...orderForm, laboratoryId: e.target.value })}>
                <option value="">Select laboratory</option>
                {activeLabs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
              <Input label="Tooth number" maxLength={3} value={orderForm.toothNumber} onChange={(e) => setOrderForm({ ...orderForm, toothNumber: e.target.value })} placeholder="e.g. 36" />
            </FormRow>
            <Input label="Work type" required list="lab-work-types" value={orderForm.workType} onChange={(e) => setOrderForm({ ...orderForm, workType: e.target.value })} placeholder="e.g. Zirconia crown, denture repair" hint="Pick a configured work type or type your own." />
            <datalist id="lab-work-types">
              {workTypes.map((w) => <option key={w} value={w} />)}
            </datalist>
          </div>

          <div className="rounded-lg border border-line bg-slate-50/60 p-3">
            <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-500">Scheduling &amp; cost</p>
            <div className="space-y-3">
              <FormRow cols={3}>
                <Input label="Sent date" type="date" value={orderForm.sentDate} onChange={(e) => setOrderForm({ ...orderForm, sentDate: e.target.value })} />
                <Input label="Expected date" type="date" value={orderForm.expectedDate} onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })} />
                <Input label="Lab charge (₹)" type="number" min="0" step="0.01" value={orderForm.charge} onChange={(e) => setOrderForm({ ...orderForm, charge: e.target.value })} />
              </FormRow>
              <Select label="Status" value={orderForm.status} onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}>
                {STATUSES.filter((s) => s !== 'fitted').map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </div>
          </div>

          {/* Visual VITA Classical Shade Palette */}
          <div className="rounded-xl border border-line bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sparkles size={13} className="text-amber-500" />
                VITA Classical Tooth Shade Selection
              </span>
              <span className="text-[10.5px] font-medium text-slate-500">Click to append shade to lab instructions</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VITA_SHADES.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    const append = `Shade: ${s.code} (${s.desc})`;
                    setOrderForm((f) => ({
                      ...f,
                      notes: f.notes ? `${f.notes}; ${append}` : append
                    }));
                    toast.success(`Shade ${s.code} added`);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs hover:border-amber-400 hover:bg-amber-50/50 transition cursor-pointer"
                  title={`${s.code} - ${s.desc}`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-2xs shrink-0"
                    style={{ backgroundColor: s.hex }}
                  />
                  <span>{s.code}</span>
                </button>
              ))}
            </div>

            {/* Prosthetic Impression & Occlusion Quick Specs */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-line">
              <div>
                <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Impression Taken:</span>
                <div className="flex flex-wrap gap-1">
                  {IMPRESSION_PRESETS.map((imp) => (
                    <button
                      key={imp}
                      type="button"
                      onClick={() => {
                        const append = `Impression: ${imp}`;
                        setOrderForm((f) => ({
                          ...f,
                          notes: f.notes ? `${f.notes}; ${append}` : append
                        }));
                      }}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-sky-300 hover:bg-sky-50 transition cursor-pointer"
                    >
                      + {imp.slice(0, 18)}…
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Occlusal Clearance:</span>
                <div className="flex flex-wrap gap-1">
                  {OCCLUSION_PRESETS.map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => {
                        const append = `Occlusion: ${occ}`;
                        setOrderForm((f) => ({
                          ...f,
                          notes: f.notes ? `${f.notes}; ${append}` : append
                        }));
                      }}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-sky-300 hover:bg-sky-50 transition cursor-pointer"
                    >
                      + {occ.slice(0, 18)}…
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Textarea label="Notes" rows={2} value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} placeholder="Shade, material, instructions to the laboratory…" />
          {orderError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{orderError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(editingOrder)}
        onClose={() => !updateBusy && setEditingOrder(null)}
        title={editingOrder ? `Update order ${editingOrder.orderNo}` : 'Update lab order'}
        subtitle={editingOrder ? `${editingOrder.patientName} · ${editingOrder.workType}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingOrder(null)} disabled={updateBusy}>Cancel</Button>
            <Button onClick={submitUpdate} loading={updateBusy}>Save update</Button>
          </>
        }
      >
        {editingOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 text-[11.5px] sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Laboratory</p>
                <p className="mt-0.5 font-medium text-ink">{editingOrder.laboratoryName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Work</p>
                <p className="mt-0.5 font-medium text-ink">{editingOrder.workType}{editingOrder.toothNumber ? ` · ${editingOrder.toothNumber}` : ''}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sent</p>
                <p className="mt-0.5 font-medium text-ink">{formatDate(editingOrder.sentDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Charge</p>
                <p className="mt-0.5 font-medium text-ink tabular-nums">{formatMoney(editingOrder.charge)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <FormRow cols={2}>
                <Select label="Status" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </Select>
                <Input label="Expected date" type="date" value={updateForm.expectedDate} onChange={(e) => setUpdateForm({ ...updateForm, expectedDate: e.target.value })} />
              </FormRow>
              {(updateForm.status === 'received' || updateForm.status === 'fitted') && (
                <Input
                  label="Delivered date"
                  type="date"
                  value={updateForm.deliveredDate}
                  onChange={(e) => setUpdateForm({ ...updateForm, deliveredDate: e.target.value })}
                  hint={updateForm.status === 'received' ? 'Defaults to today when marked received' : 'When the restoration was fitted'}
                />
              )}
              <Input label="Lab charge (₹)" type="number" min="0" step="0.01" value={updateForm.charge} onChange={(e) => setUpdateForm({ ...updateForm, charge: e.target.value })} />
              <Textarea label="Notes" rows={2} value={updateForm.notes} onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })} />
            </div>

            {updateError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{updateError}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={labOpen}
        onClose={() => !labBusy && setLabOpen(false)}
        title={editingLab ? `Edit ${editingLab.name}` : 'New laboratory'}
        subtitle="Laboratories are available when creating lab orders."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLabOpen(false)} disabled={labBusy}>Cancel</Button>
            <Button icon={FlaskConical} onClick={submitLab} loading={labBusy}>{editingLab ? 'Save changes' : 'Add laboratory'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow cols={2}>
            <Input label="Laboratory name" required value={labForm.name} onChange={(e) => setLabForm({ ...labForm, name: e.target.value })} />
            <Input label="Contact person" value={labForm.contactPerson} onChange={(e) => setLabForm({ ...labForm, contactPerson: e.target.value })} />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Phone" value={labForm.phone} onChange={(e) => setLabForm({ ...labForm, phone: e.target.value })} />
            <Input label="Email" type="email" value={labForm.email} onChange={(e) => setLabForm({ ...labForm, email: e.target.value })} />
          </FormRow>
          <Textarea label="Address" rows={2} value={labForm.address} onChange={(e) => setLabForm({ ...labForm, address: e.target.value })} />
          {editingLab && (
            <Checkbox label="Laboratory is active" checked={labForm.isActive} onChange={(e) => setLabForm({ ...labForm, isActive: e.target.checked })} />
          )}
          {labError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{labError}</p>}
        </div>
      </Modal>
    </div>
  );
}
