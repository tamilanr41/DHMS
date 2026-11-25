import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  UserCog,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Stethoscope,
  Building2,
  User,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(200),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, underscores or hyphens'),
    roleCode: z.string().default('admin'),
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
  const { login } = useAuth();
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);

  const clinicName = status?.license?.clinicName || status?.clinicName || 'Your Dental Practice';
  const defaultDoctor = status?.license?.dentistName || status?.dentistName || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: defaultDoctor,
      username: '',
      roleCode: 'admin',
      password: '',
      confirmPassword: ''
    }
  });

  const submit = async (values) => {
    setFormError(null);
    try {
      const clinicCode =
        status?.clinicCode ||
        (typeof window !== 'undefined' ? localStorage.getItem('zhanx_my_clinic_code') : null);

      const res = await api.post('/setup', {
        clinicCode: clinicCode || undefined,
        clinicId: status?.clinicId || undefined,
        fullName: values.fullName,
        username: values.username,
        roleCode: values.roleCode,
        password: values.password
      });

      const user = res?.data || res;
      setCreatedUser(user);
      setDone(true);
      toast.success('Clinic administrator created successfully!');

      // Attempt automatic sign-in
      try {
        await login(values.username, values.password);
        await queryClient.invalidateQueries({ queryKey: ['license-status'] });
      } catch {
        // Fallback to manual sign-in button if auto-login encounters session lock
        await queryClient.invalidateQueries({ queryKey: ['license-status'] });
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create administrator account.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#070e17] px-4 py-8 text-slate-100 font-sans selection:bg-teal-500 selection:text-white overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[140px]" />

      <div className="relative w-full max-w-[500px] overflow-hidden rounded-[28px] border border-slate-700/60 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-[#0b1622]/95 p-7 sm:p-9 shadow-[0_25px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        {/* Background tooth watermark */}
        <div className="pointer-events-none absolute right-2 top-8 opacity-[0.035]">
          <img src={heroTooth} alt="" className="h-64 translate-x-8 -translate-y-8 select-none" />
        </div>

        {/* Brand Bar */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#009da6] to-[#0d7d87] text-white shadow-lg shadow-teal-500/20">
              <Stethoscope size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white">ZhanX DentalCare</span>
              <p className="text-[11px] font-medium text-slate-400">Clinic Administrator Setup</p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[10.5px] font-bold text-emerald-300">
            APPROVED &amp; ACTIVE
          </span>
        </div>

        {done ? (
          <div className="relative z-10 py-6 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-xl">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Clinic Workspace Initialized!</h1>
              <p className="mt-1 text-xs text-slate-400">
                Administrator account for <strong className="text-teal-300">{createdUser?.fullName || 'Chief Doctor'}</strong> has been configured.
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['license-status'] })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#009da6] to-[#08636d] py-3.5 text-xs font-black text-white hover:from-[#02b3bd] hover:to-[#0c909c] transition shadow-lg shadow-teal-500/25 active:scale-[0.98] cursor-pointer"
              >
                <span>Launch Clinical Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 mt-6 space-y-5">
            <div>
              <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-bold text-teal-300 border border-teal-500/20">
                INITIAL CLINIC CREDENTIALS
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
                Create Clinic Administrator
              </h1>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Your clinic workspace <strong className="text-teal-300">"{clinicName}"</strong> is approved. Set up your administrator credentials to manage patients, appointments, and staff.
              </p>
            </div>

            <form onSubmit={handleSubmit(submit)} className="space-y-3.5 text-left text-xs" noValidate>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Full Name (Doctor / Lead Clinician) *</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    required
                    placeholder="Dr. Rajesh MDS"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-10 pr-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:border-[#009da6] focus:outline-none"
                    {...register('fullName')}
                  />
                </div>
                {errors.fullName && <p className="mt-1 text-[11px] text-rose-400">{errors.fullName.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Admin Username *</label>
                  <input
                    required
                    autoComplete="username"
                    placeholder="e.g. dr.rajesh or admin"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:border-[#009da6] focus:outline-none font-mono"
                    {...register('username')}
                  />
                  {errors.username && <p className="mt-1 text-[11px] text-rose-400">{errors.username.message}</p>}
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Staff Role *</label>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-xs font-bold text-teal-300 focus:border-[#009da6] focus:outline-none cursor-pointer"
                    {...register('roleCode')}
                  >
                    <option value="admin">Clinic Administrator &amp; Chief Doctor</option>
                    <option value="dentist">Associate Dentist</option>
                    <option value="receptionist">Practice Receptionist</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Create Password *</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:border-[#009da6] focus:outline-none"
                    {...register('password')}
                  />
                  {errors.password && <p className="mt-1 text-[11px] text-rose-400">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:border-[#009da6] focus:outline-none"
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && <p className="mt-1 text-[11px] text-rose-400">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <KeyRound size={14} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#009da6] to-[#08636d] py-3.5 text-xs font-black text-white hover:from-[#02b3bd] hover:to-[#0c909c] transition shadow-lg shadow-teal-500/25 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={16} />
                  {isSubmitting ? 'Configuring Clinic...' : 'Create Administrator & Launch Workspace'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
