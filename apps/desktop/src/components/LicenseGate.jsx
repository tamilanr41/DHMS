import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ShieldAlert, MessageCircle, PhoneCall, LogOut, KeyRound, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from '../services/auth.jsx';

/**
 * LicenseGate (Model B Multi-Tenant SaaS Gate)
 * Allows super-admins and active clinic workspaces to operate smoothly.
 * If a clinic's subscription expires, locks out access to clinical workflows
 * and displays a clean, direct renewal and support interface.
 */
export default function LicenseGate({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Always allow unauthenticated paths or the master platform portals
  const isBypassPath =
    location.pathname === '/login' ||
    location.pathname === '/super-admin' ||
    location.pathname === '/tamilan';

  if (isBypassPath) {
    return children;
  }

  // Master platform owner (no clinicId) has full unfettered access
  if (user?.role === 'admin' && !user?.clinicId) {
    return children;
  }

  // Check if clinic subscription has expired
  if (user?.clinicId && user?.clinicValidUntil) {
    const validUntilDate = new Date(user.clinicValidUntil);
    const isExpired = validUntilDate < new Date() || user.clinicStatus === 'expired' || user.clinicStatus === 'suspended';

    if (isExpired) {
      const clinicLabel = user.clinicName || user.clinicCode || 'Your Dental Practice';
      const whatsappMsg = encodeURIComponent(
        `Hello Zen Nova Solutions / Tamilan Admin, our clinic subscription for ${clinicLabel} (Code: ${user.clinicCode || 'N/A'}) has expired. We would like to renew our plan immediately.`
      );
      const whatsappUrl = `https://wa.me/919488348788?text=${whatsappMsg}`;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 font-sans text-slate-100">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
            {/* Ambient Red Glow */}
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
                  {validUntilDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </strong>
                . Access to patient records, dental charts, appointments, and billing is temporarily locked until renewal.
              </p>

              {user.clinicCode && (
                <div className="my-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                  <span>Clinic Identification Code: </span>
                  <code className="font-mono font-bold text-cyan-400">{user.clinicCode}</code>
                </div>
              )}

              {/* Renewal Options */}
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

              {/* Action utilities */}
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
                  <Link
                    to="/super-admin"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-cyan-400"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Super Admin</span>
                  </Link>

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

  return children;
}
