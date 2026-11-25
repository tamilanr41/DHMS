import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, ServerOff } from 'lucide-react';
import { api } from '../services/api.js';
import { useLicenseStatus } from '../hooks/useLicenseStatus.js';
import { getClientDeviceFingerprint, getClientDeviceInfo } from '../services/deviceFingerprint.js';
import ActivationPage from '../pages/auth/ActivationPage.jsx';
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

export default function LicenseGate({ children }) {
  const location = useLocation();
  const [deviceInfo, setDeviceInfo] = useState(null);

  // Always allow Tamilan Super Admin console without gate locking
  if (location.pathname === '/tamilan') {
    return children;
  }

  // Load client device fingerprint
  useEffect(() => {
    getClientDeviceFingerprint().then((fingerprint) => {
      const meta = getClientDeviceInfo();
      setDeviceInfo({ fingerprint, ...meta });
    });
  }, []);

  // 1. Device Seat / System Lock Verification via Tamilan API
  const deviceQuery = useQuery({
    queryKey: ['tamilan-device-verify', deviceInfo?.fingerprint],
    queryFn: async () => {
      if (!deviceInfo?.fingerprint) return null;
      return (
        await api.post('/tamilan/device/verify', {
          deviceFingerprint: deviceInfo.fingerprint,
          deviceName: deviceInfo.deviceName,
          osPlatform: deviceInfo.osPlatform,
          browserInfo: deviceInfo.browserInfo
        })
      ).data;
    },
    enabled: Boolean(deviceInfo?.fingerprint),
    staleTime: 30_000
  });

  // 2. Local fallback license status
  const { data, isLoading, error, refetch, isFetching } = useLicenseStatus();

  if (isLoading || (deviceInfo && deviceQuery.isLoading)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b14]/90 backdrop-blur-xl">
        <ZhaWaterLoader
          progress={50}
          autoAnimate
          statusText="Checking Tamilan cloud license & authorized system…"
          tamilStatusText="கணினி மற்றும் உரிமம் சரிபார்க்கப்படுகிறது…"
        />
      </div>
    );
  }

  if (error) {
    return (
      <BootScreen>
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
            <ServerOff size={20} />
          </div>
          <h1 className="text-lg font-semibold text-navy">Cannot reach the clinic server</h1>
          <p className="text-sm text-slate-500">{error.message}</p>
          <p className="text-xs text-slate-400">
            Make sure the ZhanX clinic service is running on the server PC, then retry. The application cannot verify
            its licence while the local service is offline.
          </p>
          <Button icon={RefreshCw} onClick={() => refetch()} loading={isFetching}>
            Retry connection
          </Button>
        </div>
      </BootScreen>
    );
  }

  // Check Tamilan Cloud Seat Lock / Approval Status first
  if (deviceQuery.data && !deviceQuery.data.allowed) {
    return (
      <TamilanApprovalGate
        verification={deviceQuery.data}
        onRetry={() => deviceQuery.refetch()}
      />
    );
  }

  if (!data?.activated) return <ActivationPage status={data} />;
  if (data.setupRequired) return <SetupPage status={data} />;
  return children;
}
