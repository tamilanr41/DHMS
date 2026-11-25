export function formatMoney(value, { withSymbol = true } = {}) {
  const n = Number(value ?? 0);
  const formatted = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
  return withSymbol ? `₹${formatted}` : formatted;
}

export function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value, fallback = '—') {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(value) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthStartISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export const STATUS_META = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  checked_in: { label: 'Checked in', tone: 'warn' },
  waiting: { label: 'Waiting', tone: 'warn' },
  in_consultation: { label: 'In consultation', tone: 'accent' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'No show', tone: 'danger' },
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'info' },
  partially_paid: { label: 'Partially paid', tone: 'warn' },
  paid: { label: 'Paid', tone: 'success' },
  void: { label: 'Void', tone: 'danger' },
  amended: { label: 'Amended', tone: 'warn' },
  proposed: { label: 'Proposed', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'accent' },
  partially_completed: { label: 'Partially completed', tone: 'warn' },
  created: { label: 'Created', tone: 'neutral' },
  sent_to_lab: { label: 'Sent to lab', tone: 'info' },
  received: { label: 'Received', tone: 'success' },
  fitted: { label: 'Fitted', tone: 'success' },
  success: { label: 'Success', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  running: { label: 'Running', tone: 'warn' },
  purchase: { label: 'Purchase', tone: 'success' },
  consumption: { label: 'Consumption', tone: 'warn' },
  adjustment: { label: 'Adjustment', tone: 'neutral' },
  current: { label: 'Current', tone: 'success' },
  historical: { label: 'Historical', tone: 'neutral' }
};

export function humanize(value) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  other: 'Other'
};

export function formatPaymentMethod(method) {
  if (!method) return '—';
  return PAYMENT_METHOD_LABELS[String(method).toLowerCase()] || humanize(method);
}

export function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
