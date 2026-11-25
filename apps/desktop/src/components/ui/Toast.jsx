import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, iconCls: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: AlertTriangle, iconCls: 'bg-red-50 text-red-600', bar: 'bg-red-500' },
  info: { icon: Info, iconCls: 'bg-accent-50 text-accent-600', bar: 'bg-accent' }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone, message, options = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-3), { id, tone, message, ...options }]);
      setTimeout(() => dismiss(id), options.duration || 4000);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      dismiss
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[340px] flex-col gap-2">
          {toasts.map((t) => {
            const meta = TONES[t.tone] || TONES.info;
            const Icon = meta.icon;
            return (
              <div key={t.id} className="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-xl border border-line/80 bg-white px-3.5 py-3 pr-8 text-[12.5px] text-ink shadow-pop animate-slide-up" role="status">
                <span className={`absolute inset-y-0 left-0 w-[3px] ${meta.bar}`} />
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.iconCls}`}>
                  <Icon size={14} />
                </span>
                <p className="flex-1 leading-snug">{t.message}</p>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="absolute right-2 top-2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink">
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
