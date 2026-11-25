import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, ShieldCheck, RotateCcw, AlertTriangle, RefreshCw, HardDrive, Activity } from 'lucide-react';
import { api, downloadBlob } from '../../services/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDateTime, humanize } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { StatCard } from '../../components/ui/Card.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BackupsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [restored, setRestored] = useState(null);

  const backups = useQuery({
    queryKey: ['backups'],
    queryFn: async () => (await api.get('/backups')).data,
    refetchInterval: (query) => (query.state.data || []).some((b) => b.status === 'running') ? 4000 : false
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['backups'] });

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await api.post('/backups', {});
      toast.success(`Backup ${res.data.fileName} created`);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const verify = async (backup) => {
    setBusyId(backup.id);
    try {
      const res = await api.post(`/backups/${backup.id}/verify`, {});
      if (res.data.ok) {
        const extra = res.data.isFullSet
          ? ` · Full clinic set (DB + ${res.data.filesCount || 0} media files verified)`
          : ' · Database archive verified';
        toast.success(`Backup verified · ${res.data.entries} entries readable${extra}`);
      } else {
        toast.error('Backup could not be verified');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const download = async (backup) => {
    setBusyId(backup.id);
    try {
      await downloadBlob(`/backups/${backup.id}/download`, backup.fileName);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const submitRestore = async () => {
    setRestoreError(null);
    if (confirmation !== 'RESTORE') return setRestoreError('Type RESTORE exactly to confirm.');
    setRestoring(true);
    try {
      const res = await api.post(`/backups/${restoreTarget.id}/restore`, { confirmation });
      setRestored(res.data);
      setRestoreTarget(null);
      setConfirmation('');
      invalidate();
      queryClient.invalidateQueries();
    } catch (err) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const rows = backups.data || [];
  const lastSuccess = rows.find((b) => b.status === 'success');

  const summary = useMemo(() => {
    const success = rows.filter((b) => b.status === 'success');
    const failed = rows.filter((b) => b.status === 'failed').length;
    const running = rows.filter((b) => b.status === 'running').length;
    const totalBytes = success.reduce((sum, b) => sum + Number(b.sizeBytes || 0), 0);
    return { total: rows.length, success: success.length, failed, running, totalBytes };
  }, [rows]);

  const columns = [
    {
      key: 'fileName',
      label: 'Backup',
      render: (b) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{b.fileName}</p>
          <p className="max-w-[280px] truncate text-xs text-slate-500" title={b.filePath}>{b.filePath}</p>
        </div>
      )
    },
    { key: 'type', label: 'Type', render: (b) => <Badge tone={b.type === 'scheduled' ? 'accent' : b.type === 'pre_restore' ? 'warn' : 'neutral'}>{humanize(b.type)}</Badge> },
    { key: 'sizeBytes', label: 'Size', align: 'right', render: (b) => formatBytes(b.sizeBytes) },
    {
      key: 'startedAt',
      label: 'Created',
      render: (b) => (
        <div>
          <p>{formatDateTime(b.startedAt)}</p>
          <p className="text-xs text-slate-500">{b.createdByName || 'Server schedule'}</p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (b) => (
        <div>
          <Badge tone={b.status === 'success' ? 'success' : b.status === 'running' ? 'warn' : 'danger'}>{humanize(b.status)}</Badge>
          {b.error && <p className="mt-1 max-w-[200px] truncate text-[11px] text-red-700" title={b.error}>{b.error}</p>}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (b) => b.status === 'success' ? (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" icon={ShieldCheck} loading={busyId === b.id} onClick={() => verify(b)}>Verify</Button>
          <Button size="sm" variant="ghost" icon={Download} loading={busyId === b.id} onClick={() => download(b)}>Download</Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { setRestoreTarget(b); setConfirmation(''); setRestoreError(null); }}>Restore</Button>
        </div>
      ) : null
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Data Security & DR"
        title="PostgreSQL Automated Backups & Disaster Recovery"
        subtitle="Manage encrypted database snapshots, verify archive integrity via pg_restore, and conduct point-in-time restores."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Backup & restore' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={RefreshCw} onClick={() => backups.refetch()} loading={backups.isFetching}>Refresh</Button>
            <Button icon={DatabaseBackup} onClick={createBackup} loading={creating}>Create backup now</Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Last Backup</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              <Activity size={16} />
            </span>
          </div>
          <div className="mt-2 flex flex-col">
            <span className="text-sm font-black text-emerald-950 truncate">
              {lastSuccess ? formatDateTime(lastSuccess.startedAt) : 'None yet'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium truncate mt-0.5">
              {lastSuccess ? lastSuccess.fileName : 'Manual snapshot recommended'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line/80 bg-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Verified Snapshots</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-50 text-navy-700 ring-1 ring-navy-100">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-navy">{summary.success}</span>
            <span className="text-[11px] text-slate-400 font-medium">of {summary.total} total</span>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/40 to-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">Archive Storage</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
              <HardDrive size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-sky-800">{formatBytes(summary.totalBytes)}</span>
            <span className="text-[11px] text-sky-600 font-medium">on disk</span>
          </div>
        </div>

        <div className="rounded-2xl border border-line/80 bg-white p-3.5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Failed / Running</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-slate-800">{summary.failed} / {summary.running}</span>
            <span className="text-[11px] text-slate-400 font-medium">status check</span>
          </div>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          loading={backups.isLoading}
          error={backups.error}
          onRetry={backups.refetch}
          emptyTitle="No backups yet"
          emptyMessage="Create a backup now, or let the scheduled job run on the server."
          emptyAction={<Button size="sm" variant="secondary" icon={DatabaseBackup} onClick={createBackup} loading={creating}>Create backup now</Button>}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>{summary.total} backup{summary.total === 1 ? '' : 's'} in history</span>
              <span className="hidden sm:inline">Running backups refresh automatically every few seconds</span>
            </div>
          }
        />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-500">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
        Uninstalling the client never deletes the clinic database or these backup files. Store a copy off the server machine for disaster recovery.
      </div>

      <Modal
        open={Boolean(restoreTarget)}
        onClose={() => !restoring && setRestoreTarget(null)}
        title="Restore database"
        subtitle={restoreTarget ? restoreTarget.fileName : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoreTarget(null)} disabled={restoring}>Cancel</Button>
            <Button variant="danger" icon={RotateCcw} onClick={submitRestore} loading={restoring} disabled={confirmation !== 'RESTORE'}>Restore database</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <p className="font-semibold">This replaces all live clinic data.</p>
            <p className="mt-1">Every patient, appointment, invoice and user account will be restored to the state captured in this backup. A pre-restore backup is created automatically so you can go back.</p>
          </div>
          <p className="text-xs text-slate-600">All staff must be signed out. You may need to sign in again after the restore completes.</p>
          <Input
            label="Type RESTORE to confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
            placeholder="RESTORE"
          />
          {restoreError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{restoreError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(restored)}
        onClose={() => setRestored(null)}
        title="Restore completed"
        footer={<Button onClick={() => window.location.reload()}>Reload application</Button>}
      >
        <div className="space-y-2 text-sm text-slate-700">
          <p>Database restored from <span className="font-medium">{restored?.restored}</span>.</p>
          <p className="text-xs text-slate-500">A safety backup was taken first: {restored?.preRestoreBackup}</p>
          <p className="text-xs text-slate-500">Reload the application and sign in again to continue.</p>
        </div>
      </Modal>
    </div>
  );
}
