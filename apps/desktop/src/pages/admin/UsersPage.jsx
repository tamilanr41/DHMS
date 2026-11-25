import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog, KeyRound, Pencil, ShieldCheck, UserX, UserCheck, RefreshCw, Users, Stethoscope, Shield, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { formatDateTime, initials } from '../../utils/format.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable, { TableToolbar } from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Input, Select, FormRow, Checkbox } from '../../components/ui/Input.jsx';

const EMPTY_CREATE = { username: '', fullName: '', password: '', roleCode: 'receptionist', phone: '', email: '' };

export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState(null);

  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState(null);

  const [confirmUser, setConfirmUser] = useState(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const listParams = new URLSearchParams({ page, pageSize });
  if (search.trim()) listParams.set('q', search.trim());
  if (roleFilter) listParams.set('roleCode', roleFilter);
  if (activeFilter) listParams.set('isActive', activeFilter);

  const users = useQuery({
    queryKey: ['users', search, roleFilter, activeFilter, page, pageSize],
    queryFn: async () => {
      const res = await api.get(`/users?${listParams.toString()}`);
      return { rows: res.data, meta: res.meta };
    }
  });

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/users/roles')).data,
    staleTime: 10 * 60_000
  });

  const pageRows = users.data?.rows || [];
  const summary = useMemo(() => {
    const active = pageRows.filter((u) => u.isActive).length;
    const due = pageRows.filter((u) => u.mustChangePassword).length;
    return {
      total: users.data?.meta?.total ?? 0,
      active,
      inactive: pageRows.length - active,
      roles: roles.data?.length ?? 0,
      due
    };
  }, [pageRows, users.data?.meta?.total, roles.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateError(null);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setCreateError(null);
    if (createForm.username.trim().length < 3) return setCreateError('Username must be at least 3 characters.');
    if (createForm.fullName.trim().length < 2) return setCreateError('Full name is required.');
    if (createForm.password.length < 8) return setCreateError('Password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(createForm.password) || !/\d/.test(createForm.password)) return setCreateError('Password must include letters and numbers.');

    setCreateBusy(true);
    try {
      await api.post('/users', {
        username: createForm.username.trim(),
        fullName: createForm.fullName.trim(),
        password: createForm.password,
        roleCode: createForm.roleCode,
        phone: createForm.phone || null,
        email: createForm.email || null
      });
      toast.success(`${createForm.fullName} created. They must change the password at first sign-in.`);
      setCreateOpen(false);
      invalidate();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateBusy(false);
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({
      fullName: u.fullName,
      roleCode: u.role,
      phone: u.phone || '',
      email: u.email || '',
      isActive: u.isActive
    });
    setEditError(null);
  };

  const submitEdit = async () => {
    setEditError(null);
    if (editForm.fullName.trim().length < 2) return setEditError('Full name is required.');
    setEditBusy(true);
    try {
      await api.patch(`/users/${editUser.id}`, {
        fullName: editForm.fullName.trim(),
        roleCode: editForm.roleCode,
        phone: editForm.phone || null,
        email: editForm.email || null,
        isActive: editForm.isActive
      });
      toast.success(`${editForm.fullName} updated`);
      setEditUser(null);
      invalidate();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  };

  const toggleActive = async (u) => {
    setToggleBusy(true);
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(`${u.fullName} ${u.isActive ? 'deactivated' : 'reactivated'}`);
      setConfirmUser(null);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToggleBusy(false);
    }
  };

  const openReset = (u) => {
    setResetUser(u);
    setResetPassword('');
    setResetConfirm('');
    setResetError(null);
  };

  const submitReset = async () => {
    setResetError(null);
    if (resetPassword.length < 8) return setResetError('Password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(resetPassword) || !/\d/.test(resetPassword)) return setResetError('Password must include letters and numbers.');
    if (resetPassword !== resetConfirm) return setResetError('Passwords do not match.');
    setResetBusy(true);
    try {
      await api.post(`/users/${resetUser.id}/reset-password`, { newPassword: resetPassword });
      toast.success(`Password reset for ${resetUser.fullName}. All their sessions were signed out.`);
      setResetUser(null);
      invalidate();
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetBusy(false);
    }
  };

  const columns = [
    {
      key: 'fullName',
      label: 'Staff Member',
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-50 to-accent-50 text-[10.5px] font-bold text-navy-800 ring-1 ring-navy-100 shadow-xs">
            {initials(u.fullName)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">
              {u.fullName}
              {u.id === user.id && <span className="ml-1.5 rounded-full bg-accent-50 px-1.5 py-0.2 text-[10px] font-bold text-accent-700">You</span>}
            </p>
            <p className="text-[10.5px] font-mono text-slate-400">@{u.username}</p>
          </div>
        </div>
      )
    },
    {
      key: 'roleName',
      label: 'Security Role',
      render: (u) => {
        const r = String(u.roleCode || '').toLowerCase();
        const isDentist = r.includes('dentist');
        const isAdmin = r.includes('admin');
        const isRecept = r.includes('reception');
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            isAdmin ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' :
            isDentist ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-200' :
            isRecept ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-200' :
            'bg-slate-100 text-slate-700'
          }`}>
            {isDentist && <Stethoscope size={11} />}
            {isAdmin && <Shield size={11} />}
            {u.roleName}
          </span>
        );
      }
    },
    { key: 'phone', label: 'Contact', render: (u) => <div><p className="text-xs text-slate-700 font-medium">{u.phone || '—'}</p>{u.email && <p className="text-[11px] text-slate-400">{u.email}</p>}</div> },
    {
      key: 'status',
      label: 'Access Status',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>
          {u.mustChangePassword && <Badge tone="warn">Password Reset Required</Badge>}
        </div>
      )
    },
    { key: 'lastLoginAt', label: 'Last Activity', render: (u) => <span className="text-xs text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(u)}>Edit</Button>
          <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => openReset(u)}>Reset</Button>
          {u.id !== user.id && (
            <Button
              size="sm"
              variant="ghost"
              icon={u.isActive ? UserX : UserCheck}
              onClick={() => (u.isActive ? setConfirmUser(u) : toggleActive(u))}
            >
              {u.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Access Control"
        title="Staff Directory & Role-Based Permissions"
        subtitle="Manage clinical staff accounts, dentist privileges, receptionist access, and enforce password security."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Users & roles' }]}
        actions={<Button icon={Plus} onClick={openCreate}>New user</Button>}
      />

      {/* Doccure Dental Staff & Roles Command Strip */}
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Staff Accounts</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14b8c8] to-[#0a7f8b] text-white shadow-md">
              <Users size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">{summary.total}</span>
            <span className="text-xs text-slate-400 font-bold">registered</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Active Staff</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md">
              <UserCheck size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{summary.active}</span>
            <span className="text-xs text-emerald-600 font-bold">ready to sign in</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">System Roles</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <ShieldCheck size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-purple-600 dark:text-purple-400">{summary.roles}</span>
            <span className="text-xs text-purple-600 font-bold">RBAC profiles</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_12px_30px_-14px_rgba(10,127,139,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Password Rotations</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md">
              <KeyRound size={18} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-amber-600 dark:text-amber-400">{summary.due}</span>
            <span className="text-xs text-amber-600 font-bold">change required</span>
          </div>
        </div>
      </div>

      <div className="card-base">
        <TableToolbar search={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by name or username…">
          <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="h-9 w-[140px] text-[11.5px]" aria-label="Filter by role">
            <option value="">All roles</option>
            {(roles.data || []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </Select>
          <Select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }} className="h-9 w-[125px] text-[11.5px]" aria-label="Filter by account status">
            <option value="">Any status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => users.refetch()} loading={users.isFetching} aria-label="Refresh users">
            Refresh
          </Button>
        </TableToolbar>
        <DataTable
          columns={columns}
          rows={pageRows}
          loading={users.isLoading}
          error={users.error}
          onRetry={users.refetch}
          emptyTitle={search || roleFilter || activeFilter ? 'No matching users' : 'No users found'}
          emptyMessage={
            search || roleFilter || activeFilter
              ? 'Adjust the search, role or status filter to find the account you need.'
              : 'Create staff accounts so each person signs in with their own role.'
          }
          emptyAction={!search && !roleFilter && !activeFilter ? <Button size="sm" variant="secondary" icon={Plus} onClick={openCreate}>New user</Button> : null}
          footer={users.data?.meta && (
            <Pagination
              meta={users.data.meta}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
        Every API request checks the signed-in role's permissions. Hiding a menu item is only cosmetic — the backend rejects unauthorized actions.
      </div>

      <Modal
        open={createOpen}
        onClose={() => !createBusy && setCreateOpen(false)}
        title="New user"
        subtitle="The user must set a new password at first sign-in."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createBusy}>Cancel</Button>
            <Button icon={UserCog} onClick={submitCreate} loading={createBusy}>Create user</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormRow cols={2}>
            <Input label="Full name" required value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} />
            <Input label="Username" required value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} hint="Letters, numbers, dot, dash, underscore" />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Temporary password" type="password" required value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} hint="8+ characters with letters and numbers" autoComplete="new-password" />
            <Select label="Role" value={createForm.roleCode} onChange={(e) => setCreateForm({ ...createForm, roleCode: e.target.value })}>
              {(roles.data || []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </Select>
          </FormRow>
          <FormRow cols={2}>
            <Input label="Phone" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
            <Input label="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          </FormRow>
          {createError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{createError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(editUser)}
        onClose={() => !editBusy && setEditUser(null)}
        title={editUser ? `Edit ${editUser.fullName}` : 'Edit user'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)} disabled={editBusy}>Cancel</Button>
            <Button onClick={submitEdit} loading={editBusy}>Save changes</Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-3">
            <FormRow cols={2}>
              <Input label="Full name" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
              <Select label="Role" value={editForm.roleCode} onChange={(e) => setEditForm({ ...editForm, roleCode: e.target.value })}>
                {(roles.data || []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
              </Select>
            </FormRow>
            <FormRow cols={2}>
              <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </FormRow>
            <Checkbox
              label="Account is active"
              checked={editForm.isActive}
              disabled={editUser?.id === user.id}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
            />
            {editUser?.id === user.id && <p className="text-[11px] text-slate-500">You cannot deactivate your own account.</p>}
            {editError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{editError}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(resetUser)}
        onClose={() => !resetBusy && setResetUser(null)}
        title={resetUser ? `Reset password · ${resetUser.fullName}` : 'Reset password'}
        subtitle="All of this user's sessions will be signed out."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetUser(null)} disabled={resetBusy}>Cancel</Button>
            <Button icon={KeyRound} onClick={submitReset} loading={resetBusy}>Reset password</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="New password" type="password" required value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} hint="8+ characters with letters and numbers" autoComplete="new-password" />
          <Input label="Confirm password" type="password" required value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} autoComplete="new-password" />
          <p className="text-[11px] text-slate-500">The user will be required to choose a new password again at next sign-in.</p>
          {resetError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{resetError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmUser)}
        onClose={() => !toggleBusy && setConfirmUser(null)}
        onConfirm={() => toggleActive(confirmUser)}
        loading={toggleBusy}
        title="Deactivate user"
        confirmLabel="Deactivate user"
        message={confirmUser ? `${confirmUser.fullName} will be signed out immediately and will not be able to sign in until reactivated. Their clinical and financial records are kept.` : ''}
      />
    </div>
  );
}
