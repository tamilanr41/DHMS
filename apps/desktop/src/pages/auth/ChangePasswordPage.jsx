import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, Lock, Eye, EyeOff, Sparkles, Activity } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import Button from '../../components/ui/Button.jsx';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm the new password')
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' });

export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });

  const onSubmit = async (values) => {
    setError(null);
    try {
      await api.post('/auth/change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
      await logout();
      navigate('/login', { replace: true, state: { notice: 'Password updated successfully. Please sign in with your new credentials.' } });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-4 text-white">
      {/* Background radial gradients */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(1100px 600px at 10% 10%, rgba(51,142,255,0.25), transparent 60%), radial-gradient(900px 560px at 90% 90%, rgba(21,90,225,0.28), transparent 55%)'
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-8 shadow-2xl backdrop-blur-2xl">
        <div className="mb-6 flex items-center gap-3.5 border-b border-white/10 pb-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/20 to-brand-600/30 text-brand-300 ring-1 ring-white/20 shadow-inner">
            <KeyRound size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Update Security Password</h1>
            <p className="mt-0.5 text-xs text-white/60">
              {user?.mustChangePassword
                ? 'Your account requires an immediate password update.'
                : `Active session: ${user?.fullName || 'Staff User'}`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Current Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/80">
              Current Password
            </label>
            <div className="flex items-center rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-md transition-colors focus-within:border-brand-400 focus-within:bg-white/[0.12] focus-within:ring-2 focus-within:ring-brand-400/30">
              <Lock className="ml-3.5 h-4 w-4 text-white/40" />
              <input
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter current password"
                className="w-full flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="mr-3 text-white/40 hover:text-white transition-colors"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.currentPassword && <p className="mt-1 text-xs text-rose-400">{errors.currentPassword.message}</p>}
          </div>

          {/* New Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/80">
              New Password
            </label>
            <div className="flex items-center rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-md transition-colors focus-within:border-brand-400 focus-within:bg-white/[0.12] focus-within:ring-2 focus-within:ring-brand-400/30">
              <Lock className="ml-3.5 h-4 w-4 text-white/40" />
              <input
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 8 characters (letters & numbers)"
                className="w-full flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="mr-3 text-white/40 hover:text-white transition-colors"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1 text-xs text-rose-400">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/80">
              Confirm New Password
            </label>
            <div className="flex items-center rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-md transition-colors focus-within:border-brand-400 focus-within:bg-white/[0.12] focus-within:ring-2 focus-within:ring-brand-400/30">
              <Lock className="ml-3.5 h-4 w-4 text-white/40" />
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                className="w-full flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="mr-3 text-white/40 hover:text-white transition-colors"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-rose-400">{errors.confirmPassword.message}</p>}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck size={18} />
            {isSubmitting ? 'Updating...' : 'Save New Password'}
          </button>

          <p className="text-center text-[11px] text-white/40">
            All active clinic sessions will be terminated and re-authenticated.
          </p>
        </form>
      </div>
    </div>
  );
}
