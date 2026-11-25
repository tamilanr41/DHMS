import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { EmptyState, ErrorState } from './States.jsx';

function SkeletonRows({ columns, rows = 6 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="table-head">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-2.5">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-line/80">
              {columns.map((col, c) => (
                <td key={col.key} className="px-3 py-3.5">
                  <span className={`block h-3.5 animate-pulse rounded bg-slate-100 ${c === 0 ? 'w-36' : c === columns.length - 1 ? 'w-16' : 'w-24'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataTable({
  columns,
  rows = [],
  loading = false,
  error,
  onRetry,
  emptyTitle,
  emptyMessage,
  emptyAction,
  onRowClick,
  rowKey = 'id',
  sort,
  onSortChange,
  footer,
  className = ''
}) {
  if (loading) return <div className={className}><SkeletonRows columns={columns} /></div>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!rows.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  const toggleSort = (col) => {
    if (!col.sortable || !onSortChange) return;
    const key = col.sortKey || col.key;
    if (sort?.key === key) onSortChange({ key, order: sort.order === 'asc' ? 'desc' : 'asc' });
    else onSortChange({ key, order: 'asc' });
  };

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="table-head">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`sticky top-0 z-[1] whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400 backdrop-blur ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer select-none transition-colors hover:text-teal-700 dark:hover:text-teal-400' : ''} ${col.headerClassName || ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => toggleSort(col)}
                  aria-sort={col.sortable ? (sort?.key === (col.sortKey || col.key) ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  <span className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    {col.label}
                    {col.sortable &&
                      (sort?.key === (col.sortKey || col.key) ? (
                        sort.order === 'asc' ? <ArrowUp size={12} className="text-teal-600" /> : <ArrowDown size={12} className="text-teal-600" />
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-30" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] ?? `row-${rowIndex}`)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                className={`${onRowClick ? 'cursor-pointer focus-visible:bg-teal-50/60' : ''} border-t border-slate-100 dark:border-slate-800/80 transition-colors hover:bg-teal-50/40 dark:hover:bg-slate-800/50 ${onRowClick ? 'hover:bg-teal-50/50' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 text-xs text-slate-800 dark:text-slate-200 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 px-5 py-3.5">{footer}</div>}
    </div>
  );
}

export function TableToolbar({ search, onSearchChange, placeholder = 'Search…', children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
      {onSearchChange && (
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="input-base h-9 pl-8 text-[12.5px]"
            aria-label={placeholder}
          />
        </div>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
