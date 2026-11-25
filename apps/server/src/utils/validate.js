import { ApiError } from './errors.js';

export function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.') || '(root)',
      message: i.message
    }));
    throw ApiError.unprocessable('Validation failed', details);
  }
  return result.data;
}

export function parsePagination(q, { defaultSize = 20, maxSize = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(q.pageSize, 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

export function paginatedMeta(total, page, pageSize) {
  const totalNum = Number(total);
  return {
    page,
    pageSize,
    total: totalNum,
    totalPages: Math.max(1, Math.ceil(totalNum / pageSize))
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateRange(q, { defaultDays = 30 } = {}) {
  const today = new Date();
  const end = q.endDate && ISO_DATE.test(q.endDate) ? q.endDate : formatDate(today);
  let start;
  if (q.startDate && ISO_DATE.test(q.startDate)) {
    start = q.startDate;
  } else {
    const s = new Date(today);
    s.setDate(s.getDate() - (defaultDays - 1));
    start = formatDate(s);
  }
  if (start > end) throw ApiError.badRequest('startDate must be on or before endDate');
  return { start, end };
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return formatDate(new Date());
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function docNumber(prefix, seqValue, year = new Date().getFullYear()) {
  return `${prefix}-${year}-${String(seqValue).padStart(5, '0')}`;
}
