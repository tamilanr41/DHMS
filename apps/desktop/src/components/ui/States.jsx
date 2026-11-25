import { Loader2, Inbox, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from './Button.jsx';

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-accent ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[12.5px] text-slate-500">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-50 to-aqua-50 ring-1 ring-accent-100/70">
        <span className="absolute inset-0 rounded-full bg-accent-200/30 motion-safe:animate-ping-slow" />
        <Loader2 size={20} className="relative animate-spin text-accent" />
      </span>
      {label}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-gradient-to-b from-white to-accent-50/60 text-accent-500 shadow-[0_10px_24px_-18px_rgba(59,130,246,0.8)]">
        <Icon size={21} strokeWidth={1.9} />
      </span>
      <p className="mt-1 text-[13px] font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-[11.5px] leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-gradient-to-b from-red-50 to-white text-red-600 shadow-[0_10px_24px_-18px_rgba(220,38,38,0.8)]">
        <AlertTriangle size={20} />
      </span>
      <p className="mt-1 text-[13px] font-semibold text-ink">Could not load data</p>
      <p className="max-w-md text-[11.5px] leading-relaxed text-slate-500">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-2">
          Retry
        </Button>
      )}
    </div>
  );
}

export function PermissionDenied() {
  return (
    <div className="card-base mx-auto mt-10 max-w-lg overflow-hidden p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50 to-white text-amber-600">
        <ShieldAlert size={21} />
      </span>
      <p className="mt-3 text-base font-semibold text-navy">Access restricted</p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">Your role does not include permission for this area. Contact the clinic administrator if you need access.</p>
      <Link to="/" className="link mt-4 inline-block text-[13px] font-medium">Back to dashboard</Link>
    </div>
  );
}
