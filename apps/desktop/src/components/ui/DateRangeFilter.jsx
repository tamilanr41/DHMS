import { todayISO, addDaysISO, monthStartISO } from '../../utils/format.js';

const PRESETS = [
  { key: 'today', label: 'Today', range: () => [todayISO(), todayISO()] },
  { key: 'yesterday', label: 'Yesterday', range: () => [addDaysISO(todayISO(), -1), addDaysISO(todayISO(), -1)] },
  { key: 'week', label: '7 days', range: () => [addDaysISO(todayISO(), -6), todayISO()] },
  { key: 'month', label: 'This month', range: () => [monthStartISO(), todayISO()] },
  { key: '30days', label: '30 days', range: () => [addDaysISO(todayISO(), -29), todayISO()] },
  { key: 'custom', label: 'Custom', range: null }
];

export default function DateRangeFilter({ start, end, onChange, className = '', allowPresets = true }) {
  const activePreset = PRESETS.find((p) => p.range && p.range()[0] === start && p.range()[1] === end)?.key || 'custom';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {allowPresets && (
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-slate-50/70 p-0.5" role="group" aria-label="Date range presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                activePreset === preset.key ? 'bg-white text-navy shadow-[0_1px_3px_rgba(15,42,71,0.12)]' : 'text-slate-500 hover:text-ink'
              }`}
              aria-pressed={activePreset === preset.key}
              onClick={() => {
                if (preset.range) {
                  const [s, e] = preset.range();
                  onChange(s, e);
                }
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label="Start date"
          value={start || ''}
          onChange={(e) => onChange(e.target.value, end)}
          className="input-base h-8 w-[130px] px-2 text-[11px]"
        />
        <span className="text-[11px] text-slate-400">to</span>
        <input
          type="date"
          aria-label="End date"
          value={end || ''}
          onChange={(e) => onChange(start, e.target.value)}
          className="input-base h-8 w-[130px] px-2 text-[11px]"
        />
      </div>
    </div>
  );
}
