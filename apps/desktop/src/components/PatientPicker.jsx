import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, UserRound } from 'lucide-react';
import { api } from '../services/api.js';
import { initials } from '../utils/format.js';
import PatientAvatar from './PatientAvatar.jsx';

export default function PatientPicker({ value, onChange, label = 'Patient', required = false, error, hint, autoFocus = false }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['patient-picker', debounced],
    queryFn: async () => (await api.get(`/patients/search?q=${encodeURIComponent(debounced)}`)).data,
    enabled: debounced.length >= 2
  });

  return (
    <div ref={ref} className="relative">
      <label className="label-base">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border-[1.5px] border-[#174a74] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,42,71,0.04)]">
          <PatientAvatar patient={value} size={36} className="rounded-xl shadow-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{value.fullName}</p>
            <p className="text-[11px] text-slate-500">{value.patientNo}{value.mobile ? ` · ${value.mobile}` : ''}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink" aria-label="Clear patient">
            <X size={15} />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              autoFocus={autoFocus}
              autoComplete="off"
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                setOpen(v.trim().length >= 2);
              }}
              onFocus={() => { if (q.trim().length >= 2) setOpen(true); }}
              placeholder="Search by name, patient ID or mobile…"
              className={`input-base pl-9 pr-8 ${error ? 'border-red-400' : ''}`}
              aria-label={label}
            />
            {isFetching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
          </div>
          {open && q.trim().length >= 2 && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-pop">
              {debounced.length < 2 ? (
                <p className="px-3 py-3 text-xs text-slate-500">Type at least 2 characters to search patients.</p>
              ) : data && data.length > 0 ? (
                <ul className="max-h-[260px] overflow-y-auto">
                  {data.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent-50"
                        onClick={() => {
                          onChange(p);
                          setOpen(false);
                          setQ('');
                        }}
                      >
                        <PatientAvatar patient={p} size={30} className="rounded-lg shadow-xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{p.fullName}</span>
                          <span className="block text-[11px] text-slate-500">{p.patientNo} · {p.mobile}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-3 text-xs text-slate-500">{isFetching ? 'Searching…' : 'No patients found. Register the patient first.'}</p>
              )}
            </div>
          )}
        </>
      )}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
