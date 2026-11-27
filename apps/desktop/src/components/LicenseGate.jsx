import { useEffect, useState, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  MessageCircle,
  PhoneCall,
  LogOut,
  KeyRound,
  RefreshCw,
  ServerOff,
  Activity
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { useLicenseStatus } from '../hooks/useLicenseStatus.js';
import { getClientDeviceFingerprint, getClientDeviceInfo } from '../services/deviceFingerprint.js';
import SetupPage from '../pages/auth/SetupPage.jsx';
import TamilanApprovalGate from './TamilanApprovalGate.jsx';
import Button from './ui/Button.jsx';
import ZhaWaterLoader from './ui/ZhaWaterLoader.jsx';

function BootScreen({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy shadow-card">
        <Activity size={24} className="text-white" />
      </span>
      {children}
    </div>
  );
}

/**
 * LicenseGate (Model B Multi-Tenant SaaS Gate)
 * 1. Allows Master Super Admin (/super-admin, /tamilan) without friction.
 * 2. Unregistered / Pending clinics see the Tamilan Approval Gate (Register & Wait for Approval).
 * 3. Once approved by Tamilan Admin, opens SetupPage (if first time) or LoginPage.
 * 4. Active clinics operate with isolated data and tenant branding.
 * 5. Expired clinic subscriptions are gracefully locked out with renewal options.
 */
export default function LicenseGate({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [clinicCodeState, setClinicCodeState] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('zhanx_my_clinic_code') : null)
  );

  // Load client device fingerprint
  useEffect(() => {
    getClientDeviceFingerprint().then((fingerprint) => {
      const meta = getClientDeviceInfo();
      setDeviceInfo({ fingerprint, ...meta });
    });
  }, []);

  const isSuperAdminPortal =
    location.pathname === '/super-admin' || location.pathname === '/tamilan';

  const safeClinicCode = typeof clinicCodeState === 'string' ? clinicCodeState : null;

  const deviceQuery = useQuery({
    queryKey: ['tamilan-device-verify', deviceInfo?.fingerprint, safeClinicCode],
    queryFn: async () => {
      if (!deviceInfo?.fingerprint) return null;
      const activeCode =
        (typeof window !== 'undefined' ? localStorage.getItem('zhanx_my_clinic_code') : null) ||
        safeClinicCode;
      const res = await api.post('/tamilan/device/verify', {
        clinicCode: activeCode || undefined,
        deviceFingerprint: deviceInfo.fingerprint,
        deviceName: deviceInfo.deviceName,
        osPlatform: deviceInfo.osPlatform,
        browserInfo: deviceInfo.browserInfo
      });
      return (res?.data?.allowed !== undefined ? res.data : res) ?? null;
    },
    enabled: Boolean(deviceInfo?.fingerprint) && !isSuperAdminPortal,
    staleTime: 5_000
  });

  // 2. License Status
  const { data, isLoading, error, refetch, isFetching } = useLicenseStatus();

  const handleRetry = useCallback(
    (newCode) => {
      if (typeof newCode === 'string') {
        setClinicCodeState(newCode);
      } else if (newCode === null) {
        setClinicCodeState(null);
      }
      deviceQuery.refetch();
      refetch();
    },
    [deviceQuery, refetch]
  );

  // Always allow Tamilan Super Admin portal without gate locking
  if (isSuperAdminPortal) {
    return children;
  }

  // Master platform owner (admin with no clinicId) has full unfettered access
  if (user?.role === 'admin' && !user?.clinicId) {
    return children;
  }

  // Check if clinic subscription has expired for logged-in user
  if (user?.clinicId && user?.clinicValidUntil) {
    const validUntilDate = new Date(user.clinicValidUntil);
    const isExpired =
      validUntilDate < new Date() ||
      user.clinicStatus === 'expired' ||
      user.clinicStatus === 'suspended';

    if (isExpired) {
      const clinicLabel = user.clinicName || user.clinicCode || 'Your Dental Practice';
      const whatsappMsg = encodeURIComponent(
        `Hello Zen Nova Solutions / Tamilan Admin, our clinic subscription for ${clinicLabel} (Code: ${user.clinicCode || 'N/A'}) has expired. We would like to renew our plan immediately.`
      );
      const whatsappUrl = `https://wa.me/919488348788?text=${whatsappMsg}`;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 font-sans text-slate-100">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-red-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-amber-600/15 blur-3xl" />

            <div className="relative text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 shadow-lg shadow-red-500/20">
                <ShieldAlert className="h-8 w-8 text-white" />
              </div>

              <span className="inline-block rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
                Subscription Expired
              </span>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
                {clinicLabel}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                The software subscription for this clinic workspace ended on{' '}
                <strong className="text-slate-200">
                  {validUntilDate.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </strong>
                . Access to patient records, dental charts, appointments, and billing is temporarily locked until renewal.
              </p>

              {user.clinicCode && (
                <div className="my-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                  <span>Clinic Identification Code: </span>
                  <code className="font-mono font-bold text-cyan-400">{user.clinicCode}</code>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 active:scale-98"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Renew via WhatsApp (+91 94883 48788)</span>
                </a>

                <a
                  href="tel:+919488348788"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Call Zen Nova Support</span>
                </a>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-check License</span>
                </button>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-red-400"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // If already logged in to an active session, render children
  if (user) {
    return children;
  }

  // Initial loading indicator before data arrives
  const isInitialLoading =
    (isLoading && !data) ||
    (Boolean(deviceInfo) && deviceQuery.isLoading && !deviceQuery.data);

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b14]/90 backdrop-blur-xl">
        <ZhaWaterLoader
          progress={50}
          autoAnimate
          statusText="Checking clinic workstation authorization…"
          tamilStatusText="கணினி மற்றும் உரிமம் சரிபார்க்கப்படுகிறது…"
        />
      </div>
    );
  }

  if (error && !deviceQuery.data) {
    return (
      <BootScreen>
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
            <ServerOff size={20} />
          </div>
          <h1 className="text-lg font-semibold text-navy">Cannot reach the clinic server</h1>
          <p className="text-sm text-slate-500">{error.message}</p>
          <p className="text-xs text-slate-400">
            Make sure the ZhanX clinic service is running on the server, then retry.
          </p>
          <Button icon={RefreshCw} onClick={handleRetry} loading={isFetching}>
            Retry connection
          </Button>
        </div>
      </BootScreen>
    );
  }

  // 1. Check Cloud Approval Status & Registration Gate
  if (!deviceQuery.data || !deviceQuery.data.allowed) {
    return (
      <TamilanApprovalGate
        verification={deviceQuery.data || { allowed: false, reason: 'REGISTER_REQUIRED' }}
        onRetry={handleRetry}
      />
    );
  }

  // 2. Initial Setup if clinic is active but no admin user created yet
  if (data?.setupRequired) {
    return (
      <SetupPage
        status={{
          ...data,
          clinicId: deviceQuery.data?.clinic?.id || data?.clinicId,
          clinicCode: deviceQuery.data?.clinic?.clinic_code || data?.clinicCode,
          clinicName: deviceQuery.data?.clinic?.clinic_name || data?.license?.clinicName,
          dentistName: deviceQuery.data?.clinic?.doctor_name || data?.license?.dentistName
        }}
      />
    );
  }

  // 3. Approved & Initialized -> Render Login / Clinic App!
  return children;
}
