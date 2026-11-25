import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity, Upload, Copy, KeyRound, Info, LifeBuoy, ShieldCheck, CheckCircle2, XCircle,
  FileJson2, Lock, WifiOff, BadgeCheck
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';

const schema = z.object({
  clinicName: z.string().trim().min(2, 'Clinic name is required').max(200),
  dentistName: z.string().trim().min(2, 'Dentist name is required').max(200),
  address: z.string().trim().min(3, 'Clinic address is required').max(500),
  contactNumber: z.string().trim().min(6, 'Contact number is required').max(40)
});

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  }
}

function FieldRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 py-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="max-w-[65%] break-words text-right text-xs font-medium text-ink">{value || '—'}</span>
    </div>
  );
}

export default function ActivationPage({ status }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [licenseText, setLicenseText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(status?.message || null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { clinicName: '', dentistName: '', address: '', contactNumber: '' }
  });

  const deviceId = status?.deviceId || 'Unavailable';
  const support = status?.support || {};

  const copyDeviceId = async () => {
    if (!status?.deviceId) return toast.error('Device ID is not available on this computer.');
    const ok = await copyText(status.deviceId);
    ok ? toast.success('Device ID copied') : toast.error('Could not access the clipboard');
  };

  const inspect = async (text, label) => {
    setImporting(true);
    setError(null);
    setPreview(null);
    try {
      const res = await api.post('/license/inspect', { license: text });
      setPreview(res.data);
      if (!res.data.valid) setError(res.data.message);
      if (res.data.valid && res.data.license) {
        if (!getValues('clinicName')) setValue('clinicName', res.data.license.clinicName || '');
        if (!getValues('dentistName')) setValue('dentistName', res.data.license.dentistName || '');
      }
      if (res.data.valid) toast.success(label ? `${label} is valid for this computer` : 'License is valid for this computer');
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      setLicenseText(text);
      setFileName(file.name);
      setPasteOpen(false);
      await inspect(text, file.name);
    } catch {
      setError('The selected file could not be read.');
    }
  };

  const onPaste = (text) => {
    setLicenseText(text);
    setFileName(text.trim() ? 'Pasted license' : '');
    setPreview(null);
  };

  const submit = async (clinic) => {
    setError(null);
    if (!licenseText.trim()) {
      setError('Import the license file issued for this Device ID before activating.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/license/activate', { license: licenseText, clinic });
      toast.success(`Activated for ${res.data.license?.clinicName || clinic.clinicName}`);
      await queryClient.invalidateQueries({ queryKey: ['license-status'] });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const license = preview?.license;
  const reasonTone = status?.reason === 'LICENSE_MISSING' ? 'info' : 'danger';

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#12304f_0%,#0f2742_55%,#0a1b2e_100%)] px-10 py-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white">
              <Activity size={24} className="text-accent" />
            </span>
            <div>
              <p className="text-lg font-semibold leading-tight">ZhanX DentalCare</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Device activation</p>
            </div>
          </div>
          <h2 className="mt-12 max-w-sm text-2xl font-semibold leading-snug">This installation is licensed to a specific clinic computer.</h2>
          <ol className="mt-8 space-y-5 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">1</span>
              Send the Device ID below to your ZhanX Studio license administrator.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">2</span>
              You receive a signed license file for this exact device.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">3</span>
              Import the file, confirm your clinic details and activate.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">4</span>
              Create the clinic administrator account, then sign in.
            </li>
          </ol>
        </div>
        <div className="relative space-y-3 text-[11px] text-slate-400">
          <p className="flex items-center gap-2"><WifiOff size={13} /> Activation and daily operation need no internet.</p>
          <p className="flex items-center gap-2"><Lock size={13} /> The license is verified offline by your local clinic service.</p>
          <p className="flex items-center gap-2"><ShieldCheck size={13} /> Patient records are never exposed before activation.</p>
        </div>
      </aside>

      <main className="flex flex-1 justify-center overflow-y-auto px-6 py-8">
        <div className="w-full max-w-[600px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">ZhanX Studio</p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-navy">Activate ZhanX DentalCare</h1>
              <p className="mt-1 text-sm text-slate-500">Bind this installation to your clinic computer with a signed license.</p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status?.activated ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {status?.activated ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {status?.activated ? 'Activated' : 'Not activated'}
            </span>
          </div>

          {error && (
            <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${reasonTone === 'info' ? 'border-accent-200 bg-accent-50 text-accent-700' : 'border-red-200 bg-red-50 text-red-800'}`} role="alert">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="mt-4 rounded-xl border border-line bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Device ID</p>
                <p className="mt-1 select-all font-mono text-lg font-semibold tracking-[0.08em] text-navy">{deviceId}</p>
              </div>
              <Button variant="secondary" size="sm" icon={Copy} onClick={copyDeviceId} disabled={!status?.deviceId}>
                Copy Device ID
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              This identifier is derived from this Windows computer. Hardware changes or a Windows reinstall produce a new
              Device ID and require a fresh license from ZhanX Studio.
            </p>
          </section>

          <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Clinic name" required placeholder="Smile Dental Clinic" error={errors.clinicName?.message} {...register('clinicName')} />
              <Input label="Dentist name" required placeholder="Dr. Arjun Mehta" error={errors.dentistName?.message} {...register('dentistName')} />
            </div>
            <Textarea label="Clinic address" required rows={2} placeholder="Street, area, city, PIN" error={errors.address?.message} {...register('address')} />
            <Input label="Contact number" required placeholder="+91 98450 12345" error={errors.contactNumber?.message} {...register('contactNumber')} />

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-navy">License file</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">JSON license issued by ZhanX Studio for the Device ID above.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" icon={Upload} onClick={() => fileInput.current?.click()} loading={importing}>
                  Import License
                </Button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".json,.license,.txt,application/json,text/plain"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              {fileName && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-slate-50 px-2.5 py-2 text-xs">
                  <FileJson2 size={15} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-slate-600">{fileName}</span>
                  {preview && (
                    <span className={`flex items-center gap-1 font-semibold ${preview.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                      {preview.valid ? <BadgeCheck size={13} /> : <XCircle size={13} />}
                      {preview.valid ? 'Valid for this computer' : 'Rejected'}
                    </span>
                  )}
                </div>
              )}
              <button type="button" className="mt-2 text-[11px] font-medium text-accent hover:underline" onClick={() => setPasteOpen((v) => !v)}>
                {pasteOpen ? 'Hide paste box' : 'Or paste a license key'}
              </button>
              {pasteOpen && (
                <div className="mt-2">
                  <textarea
                    rows={4}
                    value={licenseText}
                    onChange={(e) => onPaste(e.target.value)}
                    placeholder='{"format":"zhanx-license/1", ...}'
                    className="input-base font-mono text-[11px]"
                    aria-label="License key"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button type="button" variant="secondary" size="sm" loading={importing} disabled={!licenseText.trim()} onClick={() => inspect(licenseText, 'Pasted license')}>
                      Check pasted license
                    </Button>
                  </div>
                </div>
              )}
              {license && (
                <div className="mt-3 rounded-md bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-800">
                  <p className="font-semibold">{license.licenseId}</p>
                  <p>{license.clinicName} · {license.licenseType}{license.expiresAt ? ` · expires ${String(license.expiresAt).slice(0, 10)}` : ' · perpetual'}</p>
                </div>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full" icon={KeyRound} loading={busy}>
              Activate ZhanX DentalCare
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" icon={Info} onClick={() => setInfoOpen(true)}>View license information</Button>
            <Button variant="ghost" size="sm" icon={LifeBuoy} onClick={() => setSupportOpen(true)}>Contact support</Button>
            <span className="ml-auto text-[11px] text-slate-400">{String(status?.deviceProtection || '').startsWith('dpapi') ? 'Device secret protected with Windows DPAPI' : 'Device identity stored locally'}</span>
          </div>
        </div>
      </main>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="License information"
        subtitle={preview?.valid ? 'Signature and device binding verified by the clinic service.' : 'Import a license file to inspect it.'}
        size="sm"
      >
        {license ? (
          <div>
            <FieldRow label="License ID" value={license.licenseId} />
            <FieldRow label="Product" value={license.productId} />
            <FieldRow label="Licensed device" value={license.deviceId} />
            <FieldRow label="Clinic" value={license.clinicName} />
            <FieldRow label="Dentist" value={license.dentistName} />
            <FieldRow label="Type" value={license.licenseType} />
            <FieldRow label="Issued" value={String(license.issuedAt || '').slice(0, 10)} />
            <FieldRow label="Expires" value={license.expiresAt ? String(license.expiresAt).slice(0, 10) : 'Perpetual (no expiry)'} />
            <FieldRow label="Features" value={license.features?.join(', ')} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">{error || 'No license has been imported yet.'}</p>
        )}
      </Modal>

      <Modal open={supportOpen} onClose={() => setSupportOpen(false)} title="Contact ZhanX Studio support" size="sm">
        <div className="space-y-3 text-sm text-slate-600">
          <p>Send your Device ID so a license can be issued for this computer.</p>
          <div className="rounded-md border border-line bg-slate-50 px-3 py-2 font-mono text-sm text-navy">{deviceId}</div>
          {support.email && <p>Email: <a className="link" href={`mailto:${support.email}?subject=ZhanX%20DentalCare%20activation%20${encodeURIComponent(deviceId)}`}>{support.email}</a></p>}
          {support.phone && <p>Phone: {support.phone}</p>}
          <p className="text-xs text-slate-500">Your clinic details and patient information are never sent with the Device ID.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" icon={Copy} onClick={copyDeviceId}>Copy Device ID</Button>
            <Button size="sm" onClick={() => setSupportOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
