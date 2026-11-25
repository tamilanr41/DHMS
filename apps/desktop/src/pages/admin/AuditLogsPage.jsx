import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Eye, ShieldCheck, RefreshCw, Users, ShieldAlert, Activity } from 'lucide-react';
import { api } from '../../services/api.js';
import { formatDateTime, humanize, addDaysISO, todayISO } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { StatCard } from '../../components/ui/Card.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Select, Input } from '../../components/ui/Input.jsx';

export default function AuditLogsPage() {
  const [range, setRange] = useState(() => ({ start: addDaysISO(todayISO(), -29), end: todayISO() }));
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [detail, setDetail] = useState(null);

  const params = new URLSearchParams({ page, pageSize, startDate: range.start, endDate: range.end });
  if (search.trim()) params.set('q', search.trim());
  if (action) params.set('action', action);
  if (entityType.trim()) params.set('entityType', entityType.trim());

  const logs = useQuery({
    queryKey: ['audit-logs', search, action, entityType, range.start, range.end, page, pageSize],
    queryFn: async () => {
      const res = await api.get(`/audit-logs?${params.toString()}`);
      return { rows: res.data, meta: res.meta };
    }
  });

  const actions = useQuery({
    queryKey: ['audit-actions'],
    queryFn: async () => (await api.get('/audit-logs/actions')).data,
    staleTime: 60_000
  });

  const logRows = logs.data?.rows || [];
  const summary = useMemo(() => {
    const users = new Set(logRows.map((r) => r.username).filter(Boolean)).size;
    const sensitive = logRows.filter((r) => /delete|void|failed|restore|password|locked/.test(r.action)).length;
    return { total: logs.data?.meta?.total ?? 0, page: logRows.length, users, sensitive };
  }, [logRows, logs.data?.meta?.total]);

  const filtered = Boolean(search.trim() || action || entityType.trim());

  const columns = [
    { key: 'createdAt', label: 'When', render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
    { key: 'username', label: 'User', render: (r) => r.username || 'system' },
    {
      key: 'action',
      label: 'Action',
      render: (r) => <Badge tone={/delete|void|failed|restore/.test(r.action) ? 'danger' : /create|collected|finalized/.test(r.action) ? 'success' : 'info'}>{r.action}</Badge>
    },
    {
      key: 'entityType',
      label: 'Entity',
      render: (r) => (
        <div>
          <p>{humanize(r.entityType)}</p>
          {r.entityId && <p className="max-w-[160px] truncate text-[11px] text-slate-500" title={r.entityId}>{r.entityId}</p>}
        </div>
      )
    },
    { key: 'ip', label: 'IP', render: (r) => <span className="text-xs text-slate-500">{r.ip || '—'}</span> },
    {
      key: 'details',
      label: 'Details',
      render: (r) => r.details && Object.keys(r.details).length ? (
        <Button size="sm" variant="ghost" icon={Eye} onClick={() => setDetail(r)}>View</Button>
      ) : '—'
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Security & Compliance"
        title="Immutable Audit Trails & Activity Logs"
        subtitle="Cryptographically tamper-evident ledger tracking sign-ins, patient record edits, clinical treatments, and financial transactions."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Audit logs' }]}
        actions={<Button icon={RefreshCw} variant="secondary" onClick={() => logs.refetch()} loading={logs.isFetching}>Refresh</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-line/80 bg-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Audit Events</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-50 text-navy-700 ring-1 ring-navy-100">
              <Activity size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-navy">{summary.total}</span>
            <span className="text-[11px] text-slate-400 font-medium">in window</span>
          </div>
        </div>

        <div className="rounded-2xl border border-accent-200/80 bg-gradient-to-br from-accent-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-800">Page Records</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-accent-200">
              <ScrollText size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-accent-800">{summary.page}</span>
            <span className="text-[11px] text-accent-600 font-medium">entries loaded</span>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">Distinct Actors</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
              <Users size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-sky-800">{summary.users}</span>
            <span className="text-[11px] text-sky-600 font-medium">staff members</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Sensitive Actions</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <ShieldAlert size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-amber-800">{summary.sensitive}</span>
            <span className="text-[11px] text-amber-600 font-medium">void / overrides</span>
          </div>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/80 px-4 py-3">
          <DateRangeFilter start={range.start} end={range.end} onChange={(start, end) => { setRange({ start, end }); setPage(1); }} />
          <span className="ml-auto text-[11px] text-slate-500">Defaults to the last 30 days</span>
        </div>
        <TableToolbar search={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search action, user or entity…">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="h-9 w-[190px] text-[11.5px]" aria-label="Filter by action">
            <option value="">All actions</option>
            {(actions.data || []).map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Input
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            placeholder="Entity type"
            className="h-9 w-[140px] text-[11.5px]"
            aria-label="Entity type filter"
          />
          {filtered && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSearch(''); setAction(''); setEntityType(''); setPage(1); }}
            >
              Clear filters
            </Button>
          )}
        </TableToolbar>
        <DataTable
          columns={columns}
          rows={logRows}
          loading={logs.isLoading}
          error={logs.error}
          onRetry={logs.refetch}
          emptyTitle={filtered ? 'No matching audit entries' : 'No audit entries in this range'}
          emptyMessage={
            filtered
              ? 'Adjust the search, action, entity or date range to find the entry you need.'
              : 'Actions are recorded automatically as staff use the system.'
          }
          footer={logs.data?.meta && (
            <Pagination
              meta={logs.data.meta}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
        Audit entries cannot be edited or deleted from the application. Database-level triggers reject updates and deletes on the audit table.
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Audit entry"
        subtitle={detail ? `${detail.action} · ${formatDateTime(detail.createdAt)} · ${detail.username || 'system'}` : ''}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <div><dt className="font-semibold uppercase tracking-wide text-slate-500">Entity</dt><dd>{humanize(detail.entityType)}</dd></div>
              <div><dt className="font-semibold uppercase tracking-wide text-slate-500">Entity ID</dt><dd className="break-all">{detail.entityId || '—'}</dd></div>
              <div><dt className="font-semibold uppercase tracking-wide text-slate-500">IP address</dt><dd>{detail.ip || '—'}</dd></div>
              <div><dt className="font-semibold uppercase tracking-wide text-slate-500">Recorded</dt><dd>{formatDateTime(detail.createdAt)}</dd></div>
            </dl>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><ScrollText size={12} /> Details</p>
              <pre className="max-h-[45vh] overflow-auto rounded-md bg-navy-900 p-3 text-[11px] leading-relaxed text-slate-100">
                {JSON.stringify(detail.details ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
