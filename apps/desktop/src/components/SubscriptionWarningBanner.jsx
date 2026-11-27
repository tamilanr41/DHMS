import React, { useState } from 'react';
import { AlertTriangle, Clock, ArrowRight, X, PhoneCall, MessageCircle } from 'lucide-react';
import { useAuth } from '../services/auth.jsx';

export default function SubscriptionWarningBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !user || !user.clinicId || !user.clinicValidUntil) {
    return null;
  }

  // Super admin doesn't need to see the banner
  if (user.role === 'admin' && !user.clinicId) {
    return null;
  }

  const validUntilDate = new Date(user.clinicValidUntil);
  const now = new Date();
  const diffMs = validUntilDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Only show warning when 7 or fewer days remaining and not yet expired
  if (daysRemaining > 7 || daysRemaining < 0) {
    return null;
  }

  const clinicLabel = user.clinicName || user.clinicCode || 'Your clinic';
  const whatsappMsg = encodeURIComponent(
    `Hello Zen Nova Solutions / Tamilan Admin, I would like to renew our ZhanX DentalCare SaaS subscription for ${clinicLabel} (Code: ${user.clinicCode || 'N/A'}).`
  );
  const whatsappUrl = `https://wa.me/919488348788?text=${whatsappMsg}`;

  const isToday = daysRemaining === 0;

  return (
    <div className="relative z-30 mx-3 mt-2 mb-1 overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-orange-500/10 px-4 py-3 shadow-xs backdrop-blur-md dark:border-amber-500/30 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-orange-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:bg-amber-500/30 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                <Clock className="h-3 w-3" />
                {isToday ? 'Expires Today' : `Expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Valid until {validUntilDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-700 sm:text-sm dark:text-slate-200">
              Your <strong>{clinicLabel}</strong> subscription is expiring soon. Please renew promptly to avoid any disruption to patient charts, appointments, and billing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-600 active:scale-95 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Renew Subscription</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Dismiss notice for this session"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
