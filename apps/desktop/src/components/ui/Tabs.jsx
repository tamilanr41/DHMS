export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-slate-100 dark:border-slate-800 ${className}`} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`group relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-xs font-bold transition-all duration-200 focus-visible:outline-none ${
              active
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {active && (
              <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[#0a7f8b] to-[#14b8c8]" />
            )}
            {tab.icon ? <tab.icon size={15} className={active ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'} /> : null}
            {tab.label}
            {tab.count !== undefined && tab.count !== null ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black leading-tight transition-colors ${active ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-300' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
