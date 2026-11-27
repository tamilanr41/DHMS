import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Loader2,
  Lock,
  ServerCog,
  ShieldCheck,
  Stethoscope,
  User,
  Wifi,
  WifiOff,
  Workflow
} from 'lucide-react';
import { api, getServerBase } from '../../services/api.js';
import { useAuth } from '../../services/auth.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Logo from '../../components/ui/Logo.jsx';
import ZhaWaterLoader from '../../components/ui/ZhaWaterLoader.jsx';
import heroTooth from '../../assets/dental/hero-tooth.svg';

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
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
  supportEmail: 'helpdesk@zhanx.example',
  supportExtension: 'Ext. 200'
};

function ServerSettingsModal({ open, onClose }) {
  const [url, setUrl] = useState(() => window.zhanx?.getServerUrl?.() || 'http://127.0.0.1:4000');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const test = async () => {
    setTesting(true);
    setError(null);
    setResult(null);
    try {
      if (window.zhanx?.testConnection) {
        const res = await window.zhanx.testConnection(url);
        setResult(res);
      } else {
        const base = url.replace(/\/+$/, '').replace(/\/api$/, '');
        const started = Date.now();
        const res = await fetch(`${base}/api/health`);
        setResult({ ok: res.ok, status: res.status, latencyMs: Date.now() - started, base });
      }
    } catch {
      setResult({ ok: false, error: 'Cannot reach server' });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setError(null);
    try {
      if (window.zhanx?.setServerUrl) {
        await window.zhanx.setServerUrl(url);
        onClose();
        window.location.reload();
      } else {
        setError('Server address can only be changed from the desktop application.');
      }
    } catch (err) {
      setError(err.message || 'Could not save server address');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Server connection" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Enter the LAN address of the clinic server. Example:{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">http://192.168.1.100:4000</code>
        </p>
        <Input
          label="Server address"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.100:4000"
        />
        {result && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs ${
              result.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {result.ok
              ? `Connected to ${result.base} in ${result.latencyMs} ms`
              : `${result.error || `Server responded with status ${result.status}`}. Check the address and Windows Firewall.`}
          </div>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          <Button variant="secondary" onClick={test} loading={testing} icon={Wifi}>
            Test connection
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!window.zhanx?.setServerUrl}>
              Save &amp; reconnect
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [serverState, setServerState] = useState({ status: 'checking' });
  const [formError, setFormError] = useState(null);

  // Tamil letter "ழ" water filling loading states
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginProgress, setLoginProgress] = useState(0);
  const [loginStatusText, setLoginStatusText] = useState('Verifying credentials…');
  const [tamilStatusText, setTamilStatusText] = useState('பயனாளர் சரிபார்ப்பு…');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  const checkServer = async () => {
    setServerState({ status: 'checking' });
    try {
      await api.get('/health');
      setServerState({ status: 'online' });
    } catch {
      setServerState({ status: 'offline' });
    }
  };

  useEffect(() => {
    checkServer();
  }, []);

  const onSubmit = async (values) => {
    setFormError(null);
    setLoggingIn(true);
    setLoginProgress(6);
    setLoginStatusText('Verifying credentials…');
    setTamilStatusText('பயனாளர் கணக்கு சரிபார்ப்பு…');

    // Smooth, serene fluid rise of water inside 'ழ'
    let current = 6;
    const interval = setInterval(() => {
      current = Math.min(84, current + 1.6);
      setLoginProgress(current);
      if (current >= 60) {
        setLoginStatusText('Connecting clinic database…');
        setTamilStatusText('மருத்துவமனை தரவுத்தள ஒருங்கிணைப்பு…');
      } else if (current >= 30) {
        setLoginStatusText('Securing staff access & encryption keys…');
        setTamilStatusText('பாதுகாப்பான பணியாளர் அமர்வு துவக்கம்…');
      }
    }, 50);

    try {
      await login(values.username, values.password);
      clearInterval(interval);
      // Fluid smooth finish to 100%
      let finishP = Math.max(current, 84);
      const finishTimer = setInterval(() => {
        finishP += 3.2;
        if (finishP >= 100) {
          finishP = 100;
          clearInterval(finishTimer);
          setLoginProgress(100);
          setLoginStatusText('Access granted! Opening workspace…');
          setTamilStatusText('அனுமதி வழங்கப்பட்டது! நல்வரவு…');
          setTimeout(() => {
            const dest = location.state?.from || '/';
            navigate(dest, { replace: true });
          }, 650);
        } else {
          setLoginProgress(finishP);
        }
      }, 40);
    } catch (err) {
      clearInterval(interval);
      setLoggingIn(false);
      setLoginProgress(0);
      setFormError(err.message || 'Unable to sign in. Please verify your credentials.');
    }
  };

  const triggerPreview = () => {
    setLoggingIn(true);
    setLoginProgress(4);
    setLoginStatusText('Simulating clinical login…');
    setTamilStatusText('தமிழ் எழுத்து "ழ" நீர் நிரப்பும் அனிமேஷன்…');
    let p = 4;
    const t = setInterval(() => {
      p += 1.4;
      setLoginProgress(Math.min(100, p));
      if (p >= 70) {
        setLoginStatusText('Finalizing workspace…');
        setTamilStatusText('பணியிடம் ஆயத்தப்படுத்துதல்…');
      } else if (p >= 35) {
        setLoginStatusText('Water filling Tamil letter ழ…');
        setTamilStatusText('தமிழ் எழுத்து "ழ"-வில் நீர் நிறைகிறது…');
      }
      if (p >= 100) {
        clearInterval(t);
        setLoginStatusText('Access granted! Welcome to ZhanX…');
        setTamilStatusText('அனுமதி வழங்கப்பட்டது! நல்வரவு…');
        setTimeout(() => {
          setLoggingIn(false);
          setLoginProgress(0);
        }, 1100);
      }
    }, 42);
  };

  return (
    <main className="relative flex min-h-screen min-h-[100dvh] overflow-y-auto bg-[#0b1220] text-white selection:bg-teal-500 selection:text-white">
      {/* Background Image */}
      <img
        src="/bg_img.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />

      {/* Warm clinical overlays — deep evergreen with a coral horizon */}
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#0b1220]/95 via-[#0f172a]/80 to-[#0b1220]/45"
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
            'radial-gradient(1100px 600px at -10% -10%, rgba(59,130,246,0.26), transparent 60%), radial-gradient(900px 560px at 110% 115%, rgba(59,130,246,0.26), transparent 55%)'
        }}
        aria-hidden="true"
      />

      {/* Branding Section (Left) */}
      <section className="relative hidden w-[46%] flex-col justify-between p-10 lg:flex xl:p-12 z-10">
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

          <div className="mt-14 max-w-md">
            <div className="mb-4">
              <img
                src={heroTooth}
                alt="Doccure 3D Mascot"
                className="size-24 object-contain animate-float-doccure drop-shadow-[0_15px_30px_rgba(20,184,200,0.4)]"
              />
            </div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Clinic Management System
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] xl:text-5xl text-white">
              Better care,
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-white bg-clip-text text-transparent">
                organized simply.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
              Patient records, appointments, billing, and clinical workflows in one
              secure workspace for your clinic team.
            </p>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-6">
            {PILLARS.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 ring-1 ring-white/10">
                  <item.icon className="h-[18px] w-[18px] text-accent-300" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[13.5px] font-semibold text-white">
                    {item.title}
                  </span>
                  <span className="block text-[12px] text-white/65">{item.sub}</span>
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
      <section className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-10 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden z-10">
        <div className="my-auto w-full max-w-md">
          {/* Mobile Header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
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
            <div className="mb-6">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-300">
                Secure staff access
              </p>
              <h2 className="text-[27px] font-bold tracking-tight text-white">
                Welcome back
              </h2>
              <p className="mt-1.5 text-[13.5px] text-white/70">
                Sign in to your ZhanX HospitalOS account
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-1.5 block text-[12.5px] font-semibold text-white/85"
                >
                  Username
                </label>
                <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                  <User
                    className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="Enter your username"
                    className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[14px] text-white placeholder:text-white/40 outline-none focus:border-0 focus:outline-none focus:ring-0 shadow-none"
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p className="mt-1 text-xs text-rose-400">{errors.username.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[12.5px] font-semibold text-white/85"
                >
                  Password
                </label>
                <div className="flex items-center rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md transition-all duration-200 focus-within:border-accent-300 focus-within:bg-white/[0.12]">
                  <Lock
                    className="ml-3.5 h-[17px] w-[17px] shrink-0 text-white/50"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full flex-1 border-0 bg-transparent px-2.5 py-[13px] text-[14px] text-white placeholder:text-white/40 outline-none focus:border-0 focus:outline-none focus:ring-0 shadow-none"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="mr-2.5 flex items-center p-1 text-white/50 transition hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <Eye className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
                )}
              </div>

              {/* Error Message */}
              {formError && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 backdrop-blur-md px-3.5 py-2.5 text-[13px] font-medium text-rose-200"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </p>
              )}

              {/* Remember me and Forgot Password */}
              <div className="flex items-center justify-between pt-1 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/75">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-[15px] w-[15px] cursor-pointer rounded border-white/30 bg-white/10 text-brand-500 focus:ring-brand-400 accent-brand-500"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="font-semibold text-accent-300 transition hover:text-brand-200 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || loggingIn}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_24px_-4px_rgba(59,130,246,0.65)] hover:shadow-[0_10px_28px_-4px_rgba(59,130,246,0.8)] transition-all active:translate-y-0 disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting || loggingIn ? (
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 text-xs font-black text-cyan-200 animate-pulse">
                      ழ
                    </span>
                    <span>Signing in…</span>
                  </span>
                ) : (
                  <>
                    Sign In{' '}
                    <ArrowRight
                      className="h-[17px] w-[17px]"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3.5 text-xs text-white/40">
              <div className="h-px flex-1 bg-white/15" />
              or
              <div className="h-px flex-1 bg-white/15" />
            </div>

            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] hover:border-white/30 py-3 text-[13.5px] font-semibold text-white/90 backdrop-blur-sm transition-all cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-accent-300" strokeWidth={1.8} aria-hidden="true" />
              Contact Helpdesk
            </button>

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent-400/20 bg-accent-500/10 backdrop-blur-md p-3.5">
              <ShieldCheck
                className="mt-0.5 h-[19px] w-[19px] shrink-0 text-accent-300"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <div>
                <p className="text-[13px] font-semibold text-white">Secure sign-in</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/70">
                  Patient records are protected with role-based, audit-ready security.
                </p>
              </div>
            </div>

            {/* Server connection indicator for clinic LAN & Animation Preview */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[12px]">
              <span
                className={`flex items-center gap-1.5 ${
                  serverState.status === 'online'
                    ? 'text-emerald-400 font-medium'
                    : serverState.status === 'offline'
                    ? 'text-rose-400 font-medium'
                    : 'text-white/50'
                }`}
              >
                {serverState.status === 'online' ? <Wifi size={13} /> : <WifiOff size={13} />}
                {serverState.status === 'online'
                  ? 'Clinic server online'
                  : serverState.status === 'offline'
                  ? 'Server unreachable'
                  : 'Checking server…'}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={triggerPreview}
                  className="flex items-center gap-1 font-medium text-sky-300 hover:text-sky-200 cursor-pointer transition hover:underline"
                  title="தமிழ் 'ழ' அனிமேஷனைப் பார்க்க (Preview 'ழ' Water Fill Animation)"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-sky-400/20 text-[10px] font-black text-sky-200">
                    ழ
                  </span>
                  <span>'ழ' Animation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setServerOpen(true)}
                  className="flex items-center gap-1 text-white/60 hover:text-accent-300 cursor-pointer"
                >
                  <ServerCog size={13} /> Server
                </button>
              </div>
            </div>
          </div>

          {/* Footer Copyright */}
          <p className="mt-8 text-center text-[12px] leading-relaxed text-white/55">
            © {new Date().getFullYear()} {HOSPITAL.name} · {HOSPITAL.systemName}
            <br />
            Authorized personnel only. All access is logged and audited.
          </p>
        </div>
      </section>

      {/* Forgot Password / Helpdesk Dialog */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset password"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-600">
            For security reasons, {HOSPITAL.name} credentials are managed by the IT
            administration team. Contact the helpdesk to reset your password or unlock your
            account.
          </p>
          <dl className="space-y-2 rounded-xl bg-ink-50 p-4 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Helpdesk</dt>
              <dd className="font-semibold text-ink-800">{HOSPITAL.supportExtension}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-semibold text-brand-700">{HOSPITAL.supportEmail}</dd>
            </div>
          </dl>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setForgotOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Server Settings Dialog */}
      <ServerSettingsModal open={serverOpen} onClose={() => setServerOpen(false)} />

      {/* Tamil Letter "ழ" (Zha) Water-Filling Loading Animation Screen */}
      {loggingIn && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/85 backdrop-blur-2xl transition-all duration-300"
        >
          <ZhaWaterLoader
            progress={loginProgress}
            statusText={loginStatusText}
            tamilStatusText={tamilStatusText}
          />
        </div>
      )}
    </main>
  );
}
