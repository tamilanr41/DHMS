import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, UserCog, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(200),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, underscores or hyphens'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(200),
    confirmPassword: z.string().min(1, 'Confirm the password')
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match'
  });

export default function SetupPage({ status }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema), defaultValues: { fullName: '', username: '', password: '', confirmPassword: '' } });

  const submit = async (values) => {
    setFormError(null);
    try {
      await api.post('/setup', { fullName: values.fullName, username: values.username, password: values.password });
      setDone(true);
      toast.success('Administrator account created');
      await queryClient.invalidateQueries({ queryKey: ['license-status'] });
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(160deg,#f5f7fa_0%,#eef3f8_100%)] px-6 py-10">
      <div className="w-full max-w-[480px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy shadow-card">
            <Activity size={22} className="text-white" />
          </span>
          <div>
            <p className="text-base font-semibold text-navy">ZhanX DentalCare</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">First-time setup</p>
          </div>
        </div>

        <div className="card-base p-6">
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={24} />
              </div>
              <h1 className="mt-4 text-lg font-semibold text-navy">Setup complete</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in with the administrator account you just created.</p>
              <Button className="mt-5" onClick={() => queryClient.invalidateQueries({ queryKey: ['license-status'] })}>
                Continue to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <UserCog size={18} />
                </span>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-navy">Create the clinic administrator</h1>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {status?.license?.clinicName ? `${status.license.clinicName} is activated. ` : ''}
                    This account manages users, settings, backups and financial permissions.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4" noValidate>
                <Input label="Full name" required autoFocus autoComplete="name" placeholder="Dr. Arjun Mehta" error={errors.fullName?.message} {...register('fullName')} />
                <Input label="Username" required autoComplete="username" placeholder="admin" error={errors.username?.message} {...register('username')} />
                <Input
                  label="Password"
                  type="password"
                  required
                  autoComplete="new-password"
                  error={errors.password?.message}
                  hint="At least 8 characters with one letter and one number."
                  {...register('password')}
                />
                <Input label="Confirm password" type="password" required autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />

                {formError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                    <KeyRound size={14} className="mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" icon={ShieldCheck} loading={isSubmitting}>
                  Create administrator &amp; continue
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          ZhanX DentalCare is activated for {status?.license?.licenseId || 'this device'} · Device {status?.deviceId || '—'}
        </p>
      </div>
    </div>
  );
}
