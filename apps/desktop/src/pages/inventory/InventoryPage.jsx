import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Package, PackageX, CalendarClock, ArrowDownUp, History, Pencil, X, Truck
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDate, formatDateTime, formatMoney, humanize } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card, { StatCard } from '../../components/ui/Card.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea, FormRow, Checkbox } from '../../components/ui/Input.jsx';
import { EmptyState } from '../../components/ui/States.jsx';
import DoccureKpiCard from '../../components/ui/DoccureKpiCard.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const EMPTY_ITEM = {
  itemCode: '', name: '', category: '', brand: '', unit: 'pcs', batchNumber: '',
  purchasePrice: '', expiryDate: '', supplierId: '', minStock: '0', isActive: true
};
const EMPTY_MOVEMENT = { type: 'purchase', quantity: '', unitCost: '', reference: '', notes: '' };
const EMPTY_SUPPLIER = { name: '', contactPerson: '', phone: '', email: '', address: '', isActive: true };

export default function InventoryPage() {
  const { has } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('items');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const lowStock = params.get('lowStock') === 'true';
  const expiring = params.get('expiring') === 'true';

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [editingItem, setEditingItem] = useState(null);
  const [itemBusy, setItemBusy] = useState(false);
  const [itemError, setItemError] = useState(null);

  const [movementItem, setMovementItem] = useState(null);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT);
  const [movementBusy, setMovementBusy] = useState(false);
  const [movementError, setMovementError] = useState(null);

  const [historyItem, setHistoryItem] = useState(null);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [supplierError, setSupplierError] = useState(null);

  const itemParams = new URLSearchParams();
  if (search.trim()) itemParams.set('q', search.trim());
  if (lowStock) itemParams.set('lowStock', 'true');
  if (expiring) itemParams.set('expiring', 'true');
  if (includeInactive) itemParams.set('includeInactive', 'true');

  const items = useQuery({
    queryKey: ['inventory-items', search, lowStock, expiring, includeInactive],
    queryFn: async () => (await api.get(`/inventory/items?${itemParams.toString()}`)).data
  });

  const alerts = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => (await api.get('/inventory/alerts')).data
  });

  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data,
    enabled: tab === 'suppliers' || itemOpen
  });

  const movements = useQuery({
    queryKey: ['inventory-movements', historyItem?.id],
    queryFn: async () => (await api.get(`/inventory/items/${historyItem.id}/movements`)).data,
    enabled: Boolean(historyItem)
  });

  useEffect(() => {
    if (lowStock || expiring) setTab('items');
  }, [lowStock, expiring]);

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete('lowStock');
    next.delete('expiring');
    setParams(next, { replace: true });
  };

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM);
    setItemError(null);
    setItemOpen(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      itemCode: item.itemCode || '',
      name: item.name,
      category: item.category,
      brand: item.brand || '',
      unit: item.unit,
      batchNumber: item.batchNumber || '',
      purchasePrice: String(item.purchasePrice ?? ''),
      expiryDate: item.expiryDate ? String(item.expiryDate).slice(0, 10) : '',
      supplierId: item.supplierId || '',
      minStock: String(item.minStock ?? 0),
      isActive: item.isActive
    });
    setItemError(null);
    setItemOpen(true);
  };

  const submitItem = async () => {
    setItemError(null);
    if (itemForm.name.trim().length < 2) return setItemError('Item name is required.');
    if (!itemForm.category.trim()) return setItemError('Category is required.');
    if (!itemForm.unit.trim()) return setItemError('Unit is required.');
    if (itemForm.purchasePrice === '' || Number(itemForm.purchasePrice) < 0) return setItemError('Enter a valid purchase price.');

    setItemBusy(true);
    const payload = {
      itemCode: itemForm.itemCode || null,
      name: itemForm.name.trim(),
      category: itemForm.category.trim(),
      brand: itemForm.brand || null,
      unit: itemForm.unit.trim(),
      batchNumber: itemForm.batchNumber || null,
      purchasePrice: Number(itemForm.purchasePrice),
      expiryDate: itemForm.expiryDate || null,
      supplierId: itemForm.supplierId || null,
      minStock: Number(itemForm.minStock || 0),
      isActive: itemForm.isActive
    };
    try {
      if (editingItem) {
        await api.patch(`/inventory/items/${editingItem.id}`, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await api.post('/inventory/items', payload);
        toast.success(`${payload.name} added to inventory`);
      }
      setItemOpen(false);
      invalidateInventory();
    } catch (err) {
      setItemError(err.message);
    } finally {
      setItemBusy(false);
    }
  };

  const openMovement = (item, type = 'purchase') => {
    setMovementItem(item);
    setMovementForm({ ...EMPTY_MOVEMENT, type });
    setMovementError(null);
  };

  const submitMovement = async () => {
    setMovementError(null);
    const qty = Number(movementForm.quantity);
    if (!Number.isFinite(qty) || qty === 0) return setMovementError('Enter a non-zero quantity.');
    if (movementForm.type !== 'adjustment' && qty < 0) return setMovementError('Quantity must be positive; the movement type decides the direction.');
    if (movementForm.type === 'adjustment' && !movementForm.notes.trim()) return setMovementError('Adjustments require a note explaining the correction.');
    setMovementBusy(true);
    try {
      await api.post(`/inventory/items/${movementItem.id}/movements`, {
        type: movementForm.type,
        quantity: qty,
        unitCost: movementForm.unitCost === '' ? undefined : Number(movementForm.unitCost),
        reference: movementForm.reference || null,
        notes: movementForm.notes || null
      });
      toast.success(`Stock updated for ${movementItem.name}`);
      setMovementItem(null);
      invalidateInventory();
    } catch (err) {
      setMovementError(err.message);
    } finally {
      setMovementBusy(false);
    }
  };

  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm(EMPTY_SUPPLIER);
    setSupplierError(null);
    setSupplierOpen(true);
  };

  const openEditSupplier = (s) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      isActive: s.isActive
    });
    setSupplierError(null);
    setSupplierOpen(true);
  };

  const submitSupplier = async () => {
    setSupplierError(null);
    if (supplierForm.name.trim().length < 2) return setSupplierError('Supplier name is required.');
    setSupplierBusy(true);
    const payload = {
      name: supplierForm.name.trim(),
      contactPerson: supplierForm.contactPerson || null,
      phone: supplierForm.phone || null,
      email: supplierForm.email || null,
      address: supplierForm.address || null,
      isActive: supplierForm.isActive
    };
    try {
      if (editingSupplier) await api.patch(`/suppliers/${editingSupplier.id}`, payload);
      else await api.post('/suppliers', payload);
      toast.success(`Supplier ${payload.name} saved`);
      setSupplierOpen(false);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      invalidateInventory();
    } catch (err) {
      setSupplierError(err.message);
    } finally {
      setSupplierBusy(false);
    }
  };

  const itemColumns = [
    {
      key: 'name',
      label: 'Item',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.name}</p>
          <p className="text-xs text-slate-500">{r.itemCode || 'No code'} · {r.brand || r.category}</p>
        </div>
      )
    },
    { key: 'category', label: 'Category' },
    {
      key: 'quantity',
      label: 'In stock',
      align: 'right',
      render: (r) => (
        <div>
          <span className={`font-semibold ${r.isLowStock ? 'text-red-700' : 'text-ink'}`}>{Number(r.quantity)}</span>
          <span className="ml-1 text-xs text-slate-500">{r.unit}</span>
          <p className="text-[11px] text-slate-500">min {Number(r.minStock)}</p>
        </div>
      )
    },
    { key: 'purchasePrice', label: 'Unit cost', align: 'right', render: (r) => formatMoney(r.purchasePrice) },
    {
      key: 'expiryDate',
      label: 'Expiry',
      render: (r) => (r.expiryDate ? (
        <span className={r.isExpiring ? 'font-medium text-amber-700' : ''}>{formatDate(r.expiryDate)}</span>
      ) : '—')
    },
    { key: 'supplierName', label: 'Supplier', render: (r) => r.supplierName || '—' },
    {
      key: 'flags',
      label: 'Status',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.isLowStock && <Badge tone="danger" status="low">Low stock</Badge>}
          {r.isExpiring && <Badge tone="warn" status="expiring">Expiring</Badge>}
          {!r.isActive && <Badge tone="neutral">Inactive</Badge>}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" icon={History} onClick={() => setHistoryItem(r)}>History</Button>
          {has('inventory.manage') && (
            <>
              <Button size="sm" variant="ghost" icon={ArrowDownUp} onClick={() => openMovement(r)}>Stock</Button>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditItem(r)}>Edit</Button>
            </>
          )}
        </div>
      )
    }
  ];

  const supplierColumns = [
    { key: 'name', label: 'Supplier', render: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: 'contactPerson', label: 'Contact', render: (r) => r.contactPerson || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(has('inventory.manage') ? [{
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditSupplier(r)}>Edit</Button>
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
              <Package size={14} className="stroke-[2.5]" />
              CLINICAL SUPPLIES &amp; PHARMACY STOCK
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Dental Consumables &amp; Stock Control
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-teal-50/90 leading-relaxed">
              Manage dental composites, anesthetic cartridges, sterilization pouches, batch expiries, reorder triggers, and supplier vendor networks.
            </p>
          </div>
          {has('inventory.manage') && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openNewSupplier}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-black text-white hover:bg-white/25 backdrop-blur-sm transition border border-white/20 cursor-pointer shadow-xs"
              >
                <Truck size={14} />
                New Supplier
              </button>
              <button
                type="button"
                onClick={openNewItem}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-[#0a7f8b] shadow-lg hover:bg-teal-50 hover:shadow-xl transition cursor-pointer"
              >
                <Plus size={16} className="stroke-[3]" />
                New Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards: Strictly Matches Waiting Queue Screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <DoccureKpiCard
          title="ITEMS TRACKED"
          value={items.data?.length ?? 0}
          subtitle="consumables"
          icon={Package}
          variant="teal"
        />
        <DoccureKpiCard
          title="LOW STOCK REORDERS"
          value={alerts.data?.lowStock?.length ?? 0}
          subtitle="below min limit"
          icon={PackageX}
          variant="rose"
        />
        <DoccureKpiCard
          title="EXPIRING IN 60D"
          value={alerts.data?.expiring?.length ?? 0}
          subtitle="batches alert"
          icon={CalendarClock}
          variant="amber"
        />
        <DoccureKpiCard
          title="TOTAL STOCK VALUE"
          value={formatMoney((items.data || []).reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.purchasePrice || 0), 0))}
          subtitle="asset value"
          icon={ArrowDownUp}
          variant="emerald"
          hasDot
        />
      </div>

      <div className="card-base">
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { value: 'items', label: 'Items', count: items.data?.length },
              { value: 'alerts', label: 'Alerts', count: (alerts.data?.lowStock?.length || 0) + (alerts.data?.expiring?.length || 0) },
              { value: 'suppliers', label: 'Suppliers', count: suppliers.data?.length }
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {tab === 'items' && (
          <>
            <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search item, category, code or brand…">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="h-3.5 w-3.5 rounded border-line text-accent" />
                Include inactive
              </label>
              {(lowStock || expiring) && (
                <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] text-accent-700">
                  {lowStock ? 'Low stock' : 'Expiring'} <X size={11} />
                </button>
              )}
            </TableToolbar>
            <DataTable
              columns={itemColumns}
              rows={items.data || []}
              loading={items.isLoading}
              error={items.error}
              onRetry={items.refetch}
              emptyTitle="No inventory items"
              emptyMessage={lowStock || expiring ? 'No items match this alert filter.' : 'Add consumables to start tracking stock.'}
              emptyAction={has('inventory.manage') ? <Button size="sm" variant="secondary" icon={Plus} onClick={openNewItem}>New item</Button> : null}
            />
          </>
        )}

        {tab === 'alerts' && (
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            <Card title="Low stock" subtitle="Reorder these items" noBody>
              {(alerts.data?.lowStock || []).length === 0 ? (
                <EmptyState title="Stock levels healthy" message="All items are above their minimum levels." icon={Package} />
              ) : (
                <ul className="divide-y divide-line">
                  {alerts.data.lowStock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                        <p className="text-xs text-slate-500">{Number(item.quantity)} {item.unit} left · minimum {Number(item.min_stock)}</p>
                      </div>
                      {has('inventory.manage') && (
                        <Button size="sm" variant="subtle" icon={ArrowDownUp} onClick={() => openMovement({ ...item, minStock: item.min_stock, unit: item.unit }, 'purchase')}>Receive</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Expiring stock" subtitle="Within 60 days" noBody>
              {(alerts.data?.expiring || []).length === 0 ? (
                <EmptyState title="Nothing expiring" message="No batches are nearing expiry within the next 60 days." icon={CalendarClock} />
              ) : (
                <ul className="divide-y divide-line">
                  {alerts.data.expiring.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                        <p className="text-xs text-slate-500">Batch {item.batch_number || '—'} · expires {formatDate(item.expiry_date)} · {Number(item.quantity)} {item.unit}</p>
                      </div>
                      <Badge tone="warn" status="expiring">Expiring</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {tab === 'suppliers' && (
          <DataTable
            columns={supplierColumns}
            rows={suppliers.data || []}
            loading={suppliers.isLoading}
            error={suppliers.error}
            onRetry={suppliers.refetch}
            emptyTitle="No suppliers yet"
            emptyMessage="Add the vendors you purchase consumables from."
            emptyAction={has('inventory.manage') ? <Button size="sm" variant="secondary" icon={Plus} onClick={openNewSupplier}>New supplier</Button> : null}
          />
        )}
      </div>

      <Modal
        open={itemOpen}
        onClose={() => !itemBusy && setItemOpen(false)}
        title={editingItem ? `Edit ${editingItem.name}` : 'New inventory item'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setItemOpen(false)} disabled={itemBusy}>Cancel</Button>
            <Button icon={Package} onClick={submitItem} loading={itemBusy}>{editingItem ? 'Save changes' : 'Add item'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow cols={2}>
            <Input label="Item name" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            <Input label="Item code" value={itemForm.itemCode} onChange={(e) => setItemForm({ ...itemForm, itemCode: e.target.value })} placeholder="Optional" />
          </FormRow>
          <FormRow cols={3}>
            <Input label="Category" required value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="e.g. Anesthetics" />
            <Input label="Brand" value={itemForm.brand} onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })} />
            <Input label="Unit" required value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="pcs / box / ml" />
          </FormRow>
          <FormRow cols={3}>
            <Input label="Unit cost (₹)" type="number" min="0" step="0.01" value={itemForm.purchasePrice} onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })} />
            <Input label="Minimum stock" type="number" min="0" step="0.001" value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: e.target.value })} />
            <Input label="Expiry date" type="date" value={itemForm.expiryDate} onChange={(e) => setItemForm({ ...itemForm, expiryDate: e.target.value })} />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Batch number" value={itemForm.batchNumber} onChange={(e) => setItemForm({ ...itemForm, batchNumber: e.target.value })} />
            <Select label="Supplier" value={itemForm.supplierId} onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}>
              <option value="">No supplier</option>
              {(suppliers.data || []).filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormRow>
          {editingItem && (
            <Checkbox label="Item is active" checked={itemForm.isActive} onChange={(e) => setItemForm({ ...itemForm, isActive: e.target.checked })} />
          )}
          <p className="text-[11px] text-slate-500">Opening quantity is set through a stock movement after the item is created.</p>
          {itemError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{itemError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(movementItem)}
        onClose={() => !movementBusy && setMovementItem(null)}
        title={movementItem ? `Stock movement · ${movementItem.name}` : 'Stock movement'}
        subtitle={movementItem ? `Current balance ${Number(movementItem.quantity)} ${movementItem.unit}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMovementItem(null)} disabled={movementBusy}>Cancel</Button>
            <Button icon={ArrowDownUp} onClick={submitMovement} loading={movementBusy}>Record movement</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow cols={2}>
            <Select label="Movement type" value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}>
              <option value="purchase">Purchase (add stock)</option>
              <option value="consumption">Consumption (remove stock)</option>
              <option value="adjustment">Adjustment (+/− correction)</option>
            </Select>
            <Input
              label={movementForm.type === 'adjustment' ? 'Quantity (negative to reduce)' : 'Quantity'}
              type="number"
              step="0.001"
              value={movementForm.quantity}
              onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
            />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Unit cost (₹)" type="number" min="0" step="0.01" value={movementForm.unitCost} onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })} placeholder="Optional" />
            <Input label="Reference" value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} placeholder="Bill / requisition no" />
          </FormRow>
          <Textarea
            label={movementForm.type === 'adjustment' ? 'Notes (required)' : 'Notes'}
            required={movementForm.type === 'adjustment'}
            rows={3}
            value={movementForm.notes}
            onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
          />
          {movementError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{movementError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        title={historyItem ? `Stock history · ${historyItem.name}` : 'Stock history'}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setHistoryItem(null)}>Close</Button>}
      >
        {movements.isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading movements…</p>
        ) : movements.error ? (
          <p className="py-6 text-center text-sm text-red-700">{movements.error.message}</p>
        ) : (movements.data || []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No stock movements recorded for this item.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Change</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.map((m) => (
                  <tr key={m.id}>
                    <td className="table-cell px-3">{formatDateTime(m.created_at)}</td>
                    <td className="table-cell px-3"><Badge status={m.movement_type}>{humanize(m.movement_type)}</Badge></td>
                    <td className={`table-cell px-3 text-right font-medium ${Number(m.quantity_change) < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {Number(m.quantity_change) > 0 ? '+' : ''}{Number(m.quantity_change)}
                    </td>
                    <td className="table-cell px-3 text-right">{Number(m.balance_after)}</td>
                    <td className="table-cell px-3">{m.reference || m.notes || '—'}</td>
                    <td className="table-cell px-3">{m.performed_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={supplierOpen}
        onClose={() => !supplierBusy && setSupplierOpen(false)}
        title={editingSupplier ? `Edit ${editingSupplier.name}` : 'New supplier'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSupplierOpen(false)} disabled={supplierBusy}>Cancel</Button>
            <Button icon={Truck} onClick={submitSupplier} loading={supplierBusy}>{editingSupplier ? 'Save changes' : 'Add supplier'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow cols={2}>
            <Input label="Supplier name" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            <Input label="Contact person" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            <Input label="Email" type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
          </FormRow>
          <Textarea label="Address" rows={2} value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
          {editingSupplier && (
            <Checkbox label="Supplier is active" checked={supplierForm.isActive} onChange={(e) => setSupplierForm({ ...supplierForm, isActive: e.target.checked })} />
          )}
          {supplierError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{supplierError}</p>}
        </div>
      </Modal>
    </div>
  );
}
