import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Lock,
  ShieldCheck,
  Stethoscope,
  User,
  Workflow
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Logo from '../../components/ui/Logo.jsx';
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

const PILLARS = [
  { icon: Workflow, title: 'Clinical workflow', sub: 'Queue to consult' },
  { icon: Stethoscope, title: 'Patient records', sub: 'Complete history' },
  { icon: FlaskConical, title: 'Labs & reports', sub: 'Integrated results' },
  { icon: ShieldCheck, title: 'Role-based', sub: 'Audit-ready access' }
];

const HOSPITAL = {
  name: 'ZhanX DentalCare',
  systemName: 'ZHANX DENTALCARE MANAGEMENT SYSTEM',
  campus: 'Clinic Edition',
  version: '2.4.0',
  supportExtension: 'Ext. 200'
};

export default function SetupPage({ status }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { login } = useAuth();
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

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

      try {
        await login(values.username, values.password);
        await queryClient.invalidateQueries({ queryKey: ['license-status'] });
      } catch {
        await queryClient.invalidateQueries({ queryKey: ['license-status'] });
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create administrator account.');
    }
  };

  return (
    <main className="relative flex min-h-screen min-h-[100dvh] overflow-y-auto bg-[#0b1220] text-white font-sans selection:bg-teal-500 selection:text-white">
      {/* Background Image */}
      <img
        src="/bg_img.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />

      {/* Warm clinical overlays */}
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#0b1220]/95 via-[#0f172a]/80 to-[#0b1220]/50"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 tooth-mesh opacity-40"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1100px 600px at -10% -10%, rgba(59,130,246,0.26), transparent 60%), radial-gradient(900px 560px at 110% 115%, rgba(20,184,200,0.26), transparent 55%)'
        }}
        aria-hidden="true"
      />

      {/* Branding Section (Left) - Exact match with LoginPage */}
      <section className="relative hidden w-[45%] flex-col justify-between p-10 lg:flex xl:p-12 z-10">
        <div className="relative">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <span className="leading-tight">
              <span className="block font-display text-lg font-extrabold tracking-tight text-white">
                ZHANX{' '}
                <span className="bg-gradient-to-r from-accent-300 to-brand-300 bg-clip-text text-transparent">
                  DENTAL
                </span>
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-300">
                {HOSPITAL.name}
              </span>
            </span>
          </div>

          <div className="mt-12 max-w-md">
            <div className="mb-4">
              <img
                src={heroTooth}
                alt="Doccure 3D Mascot"
                className="size-24 object-contain animate-float-doccure drop-shadow-[0_15px_30px_rgba(20,184,200,0.4)]"
              />
            </div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Practice Credentials Setup
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] xl:text-5xl text-white">
              Better care,
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-white bg-clip-text text-transparent">
                organized simply.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-white/80">
              Your practice workspace is approved and ready. Create the primary administrator account to begin managing patients.
            </p>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-5">
            {PILLARS.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 ring-1 ring-white/10">
                  <item.icon className="h-[18px] w-[18px] text-accent-300" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold text-white">
                    {item.title}
                  </span>
                  <span className="block text-[11.5px] text-white/65">{item.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[12px] text-white/55">
          <span>
            Version {HOSPITAL.version} · {HOSPITAL.campus}
          </span>
          <span>Support {HOSPITAL.supportExtension}</span>
        </div>
      </section>

      {/* Form Section (Right) */}
      <section className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden z-10">
        <div className="my-auto w-full max-w-md">
          {/* Mobile Header */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold tracking-wide text-white">
                ZHANX <span className="text-accent-300">DENTAL</span>
              </p>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/65">
                {HOSPITAL.systemName}
              </p>
            </div>
          </div>

          {/* Form Card (Glassmorphic Transparent) */}
          <div className="relative rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] sm:p-8">
            {done ? (
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-xl">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h2 className="text-[25px] font-bold tracking-tight text-white">
                    Administrator Configured!
                  </h2>
                  <p className="mt-1 text-[13px] text-white/70">
                    Clinic account for <strong className="text-accent-300">{createdUser?.fullName || 'Chief Doctor'}</strong> has been created.
                  </p>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['license-status'] })}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-brand-400 to-accent-500 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-6px_rgba(20,184,200,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(20,184,200,0.6)] transition active:scale-[0.98] cursor-pointer"
                  >
                    <span>Launch Clinical Workspace</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-5">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300">
                    Clinic Authorization Approved
                  </p>
                  <h2 className="text-[26px] font-bold tracking-tight text-white">
                    Create Clinic Administrator
                  </h2>
                  <p className="mt-1 text-[13px] text-white/70">
                    Workspace for <strong className="text-accent-300">"{clinicName}"</strong> is active. Set up your login credentials.
                  </p>
                </div>

                <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
                  {/* Full Name */}
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-white/85">
                      Full Name (Doctor / Lead Clinician) *
                    </label>
                    <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                      <User className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                      <input
                        required
                        placeholder="Dr. Rajesh MDS"
                        className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[14px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                        {...register('fullName')}
                      />
                    </div>
                    {errors.fullName && <p className="mt-1 text-xs text-rose-400">{errors.fullName.message}</p>}
                  </div>

                  {/* Username */}
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-white/85">
                      Admin Username *
                    </label>
                    <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                      <User className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                      <input
                        required
                        autoComplete="username"
                        placeholder="e.g. dr.rajesh or admin"
                        className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[14px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none font-mono"
                        {...register('username')}
                      />
                    </div>
                    {errors.username && <p className="mt-1 text-xs text-rose-400">{errors.username.message}</p>}
                  </div>

                  {/* Role */}
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-white/85">
                      Staff Role *
                    </label>
                    <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                      <ShieldCheck className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                      <select
                        className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[13.5px] font-semibold text-accent-300 outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white"
                        {...register('roleCode')}
                      >
                        <option value="admin">Clinic Administrator &amp; Chief Doctor</option>
                        <option value="dentist">Associate Dentist</option>
                        <option value="receptionist">Practice Receptionist</option>
                      </select>
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-white/85">
                      Password *
                    </label>
                    <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                      <Lock className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[14px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="mr-2.5 flex items-center p-1 text-white/50 transition hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-white/85">
                      Confirm Password *
                    </label>
                    <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                      <Lock className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50" strokeWidth={1.8} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[14px] text-white placeholder:text-white/40 outline-none focus:ring-0 shadow-none"
                        {...register('confirmPassword')}
                      />
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-xs text-rose-400">{errors.confirmPassword.message}</p>}
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
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-400 via-brand-400 to-accent-500 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-6px_rgba(20,184,200,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(20,184,200,0.6)] transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck size={16} />
                      {isSubmitting ? 'Configuring Administrator...' : 'Create Administrator & Launch Workspace'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
