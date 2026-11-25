import { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export function Field({ label, error, hint, required, children, className = '', htmlFor }) {
  return (
    <div className={`field-group ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="label-base">
          <span className="label-dot" aria-hidden="true" />
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] font-medium leading-tight text-red-700">
          <AlertCircle size={12} className="mt-px shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] leading-tight text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, className = '', wrapperClass = '', id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={wrapperClass}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        className={`input-base ${error ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : ''} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, rows = 3, className = '', wrapperClass = '', id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={wrapperClass}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        className={`input-base resize-y ${error ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : ''} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, children, className = '', wrapperClass = '', id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={wrapperClass}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        className={`input-base pr-8 ${error ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-100' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, className = '', ...rest }, ref) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-ink ${className}`}>
      <input ref={ref} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#356aeb] transition-colors focus:ring-2 focus:ring-accent/25" {...rest} />
      <span>{label}</span>
    </label>
  );
});

export function FormRow({ children, cols = 2, className = '' }) {
  const grid = cols === 3 ? 'md:grid-cols-3' : cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-2';
  return <div className={`grid grid-cols-1 gap-x-4 gap-y-4 ${grid} ${className}`}>{children}</div>;
}
