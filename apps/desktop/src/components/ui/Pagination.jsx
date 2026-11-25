import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './Button.jsx';

export default function Pagination({ meta, onPageChange, pageSize, onPageSizeChange }) {
  if (!meta) return null;
  const { page = 1, totalPages = 1, total = 0, pageSize: metaPageSize } = meta;
  const size = pageSize || metaPageSize || 20;
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500">
      <span>
        {total === 0 ? 'No records' : <>Showing <span className="font-medium text-slate-700">{from}–{to}</span> of <span className="font-medium text-slate-700">{total}</span></>}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={size}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-line bg-white px-1.5 text-[11px] text-slate-600 focus:border-accent focus:outline-none"
            aria-label="Rows per page"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
        <span className="tabular-nums">Page {page} of {Math.max(totalPages, 1)}</span>
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous page" size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          <IconButton icon={ChevronRight} label="Next page" size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} />
        </div>
      </div>
    </div>
  );
}
