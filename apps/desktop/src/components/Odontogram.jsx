import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CalendarCheck2, CheckCircle2, ClipboardList, History, Save, Stethoscope } from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from './ui/Toast.jsx';
import { formatDateTime, formatMoney, humanize } from '../utils/format.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import { Select, Textarea } from './ui/Input.jsx';
import { EmptyState, PageLoader, ErrorState } from './ui/States.jsx';
import { useClinic } from '../hooks/useClinic.js';

const ADULT = {
  upperRight: ['18', '17', '16', '15', '14', '13', '12', '11'],
  upperLeft: ['21', '22', '23', '24', '25', '26', '27', '28'],
  lowerRight: ['48', '47', '46', '45', '44', '43', '42', '41'],
  lowerLeft: ['31', '32', '33', '34', '35', '36', '37', '38']
};

const PRIMARY = {
  upperRight: ['55', '54', '53', '52', '51'],
  upperLeft: ['61', '62', '63', '64', '65'],
  lowerRight: ['85', '84', '83', '82', '81'],
  lowerLeft: ['71', '72', '73', '74', '75']
};

// Charts are always stored in FDI notation. Universal numbering is a display
// preference for clinics that use the 1-32 (or A-T) system.
const UNIVERSAL_PERMANENT = {
  18: '1', 17: '2', 16: '3', 15: '4', 14: '5', 13: '6', 12: '7', 11: '8',
  21: '9', 22: '10', 23: '11', 24: '12', 25: '13', 26: '14', 27: '15', 28: '16',
  38: '17', 37: '18', 36: '19', 35: '20', 34: '21', 33: '22', 32: '23', 31: '24',
  48: '25', 47: '26', 46: '27', 45: '28', 44: '29', 43: '30', 42: '31', 41: '32'
};

const UNIVERSAL_PRIMARY = {
  55: 'A', 54: 'B', 53: 'C', 52: 'D', 51: 'E',
  61: 'F', 62: 'G', 63: 'H', 64: 'I', 65: 'J',
  75: 'K', 74: 'L', 73: 'M', 72: 'N', 71: 'O',
  85: 'P', 84: 'Q', 83: 'R', 82: 'S', 81: 'T'
};

function toothDisplay(number, dentition, notation) {
  if (notation !== 'universal') return number;
  const map = dentition === 'permanent' ? UNIVERSAL_PERMANENT : UNIVERSAL_PRIMARY;
  return map[number] || number;
}

const PERMANENT_NAMES = {
  1: 'Central incisor',
  2: 'Lateral incisor',
  3: 'Canine',
  4: 'First premolar',
  5: 'Second premolar',
  6: 'First molar',
  7: 'Second molar',
  8: 'Third molar'
};

const PRIMARY_NAMES = {
  1: 'Central incisor',
  2: 'Lateral incisor',
  3: 'Canine',
  4: 'First primary molar',
  5: 'Second primary molar'
};

const TREATMENT_DOT = {
  proposed: 'bg-amber-400',
  accepted: 'bg-sky-500',
  in_progress: 'bg-violet-500',
  completed: 'bg-emerald-500'
};

const TREATMENT_LABEL = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed'
};

const PERIO_SITES = [
  { key: 'mb', label: 'MB' },
  { key: 'b', label: 'B' },
  { key: 'db', label: 'DB' },
  { key: 'ml', label: 'ML' },
  { key: 'l', label: 'L' },
  { key: 'dl', label: 'DL' }
];

const EMPTY_PERIO = {
  probingDepths: {},
  mobility: '0',
  furcation: 'none',
  bleedingOnProbing: false,
  suppuration: false,
  plaque: false,
  calculus: false,
  notes: ''
};

const SHAPES = {
  incisor: {
    crown: 'M10 9 C10 4 13 2 18 2 C23 2 26 4 26 9 L25.2 19 C25 22.5 22 24.5 18 24.5 C14 24.5 11 22.5 10.8 19 Z',
    roots: ['M14 24 C14 34 13.5 44 18 51 C22.5 44 22 34 22 24 Z'],
    grooves: ['M18 5 L18 22', 'M13 12 Q18 10 23 12']
  },
  lateral: {
    crown: 'M11 9 C11 4.5 14 2 18 2 C22 2 25 4.5 25 9 L24.3 18.5 C24.1 22 21.5 24 18 24 C14.5 24 11.9 22 11.7 18.5 Z',
    roots: ['M14 23.5 C14 33 13.8 43 18 49.5 C22.2 43 22 33 22 23.5 Z'],
    grooves: ['M18 5 L18 21']
  },
  canine: {
    crown: 'M18 1.5 C23 4.5 26 8 26 12 L25.2 19 C25 22.5 22 24.5 18 24.5 C14 24.5 11 22.5 10.8 19 L10 12 C10 8 13 4.5 18 1.5 Z',
    roots: ['M14 24 C13.7 34 13 45 18 52 C23 45 22.3 34 22 24 Z'],
    grooves: ['M18 4 L18 22', 'M14 13 Q18 11 22 13']
  },
  premolar: {
    crown: 'M9 8.5 C10 4.5 12 3.5 14 5 C15.5 3 16.5 3 18 5 C19.5 3 20.5 3 22 5 C24 3.5 26 4.5 27 8.5 L26 19 C25.5 22.5 22.5 24.5 18 24.5 C13.5 24.5 10.5 22.5 10 19 Z',
    roots: [
      'M13 23.5 C12.6 33 13.3 43.5 16 49.5 C17.7 45.5 18 36 18 23.5 Z',
      'M22.8 23.5 C22.8 36 23.2 45.5 25 49.5 C27.7 43.5 28.4 33 28 23.5 Z'
    ],
    grooves: ['M18 5 L18 22', 'M11.5 14 Q18 10.5 24.5 14', 'M14.5 8 Q18 6 21.5 8']
  },
  molar: {
    crown: 'M7 9 C8 4 11 3 13 5.5 C14.5 3 16.5 3 18 5.5 C19.5 3 21.5 3 23 5.5 C25 3 28 4 29 9 L28 19.5 C27.5 23 24 25 18 25 C12 25 8.5 23 8 19.5 Z',
    roots: [
      'M11.5 24 C10.5 34 11.5 44.5 14.5 50.5 C16.5 46 17 37 17 24 Z',
      'M24.5 24 C24.5 37 25 46 27 50.5 C30 44.5 31 34 30 24 Z'
    ],
    grooves: ['M18 5 L18 23', 'M9 13.5 Q18 9.5 28 13.5', 'M12 7.5 Q18 5.5 24 7.5', 'M14 19.5 Q18 17 22 19.5']
  },
  primary: {
    crown: 'M8 9.5 C8.5 4.5 12 3 14 5.5 C15.5 3.5 16.5 3.5 18 5.5 C19.5 3.5 20.5 3.5 22 5.5 C24 3 27.5 4.5 28 9.5 L27 19 C26.5 22.5 23 24.5 18 24.5 C13 24.5 9.5 22.5 9 19 Z',
    roots: [
      'M12.5 23.5 C11.5 31 12.5 40 15.5 45 C17.2 41 17.5 33 17.5 23.5 Z',
      'M24 23.5 C24 33 24.4 41 26 45 C29 40 30 31 29 23.5 Z'
    ],
    grooves: ['M18 6 L18 22', 'M10 14 Q18 10 27 14', 'M13 8 Q18 6 23 8']
  }
};

function toothKind(number, dentition) {
  const position = Number(String(number)[1]);
  if (dentition === 'primary') {
    if (position <= 2) return 'incisor';
    if (position === 3) return 'canine';
    return 'primary';
  }
  if (position <= 1) return 'incisor';
  if (position === 2) return 'lateral';
  if (position === 3) return 'canine';
  if (position <= 5) return 'premolar';
  return 'molar';
}

function toothName(number, dentition) {
  const position = Number(String(number)[1]);
  const names = dentition === 'primary' ? PRIMARY_NAMES : PERMANENT_NAMES;
  return names[position] || 'Tooth';
}

function ToothGlyph({ kind, color, selected, missing, conditionCode = '', conditionLabel = '' }) {
  const shape = SHAPES[kind] || SHAPES.molar;
  const stroke = selected ? '#0a7f8b' : color || '#94a3b8';

  const isCrown = conditionCode === 'crown' || conditionLabel.toLowerCase().includes('crown') || conditionLabel.toLowerCase().includes('cap');
  const isRct = conditionCode === 'root_canal' || conditionLabel.toLowerCase().includes('root canal') || conditionLabel.toLowerCase().includes('rct') || conditionLabel.toLowerCase().includes('endo');
  const isImplant = conditionCode === 'implant' || conditionLabel.toLowerCase().includes('implant');
  const isCaries = conditionCode === 'caries' || conditionLabel.toLowerCase().includes('caries') || conditionLabel.toLowerCase().includes('decay');
  const isRestoration = conditionCode === 'restoration' || conditionLabel.toLowerCase().includes('composite') || conditionLabel.toLowerCase().includes('filling');

  return (
    <svg viewBox="0 0 36 54" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        {/* Pearl Enamel 3D Luster Gradient */}
        <radialGradient id="pearlEnamel" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>

        {/* Selected Enamel Glow */}
        <radialGradient id="selectedEnamel" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="70%" stopColor="#ccfbf1" />
          <stop offset="100%" stopColor="#99f6e4" />
        </radialGradient>

        {/* Metallic Gold Crown Gradient */}
        <linearGradient id="crownGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Titanium Implant Gradient */}
        <linearGradient id="implantTi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* RCT Gutta-Percha Canal Glow */}
        <linearGradient id="rctCanal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="70%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>

      {/* Roots */}
      {!isImplant ? (
        shape.roots.map((d, idx) => (
          <path
            key={`root-${idx}`}
            d={d}
            fill="#f8fafc"
            stroke={stroke}
            strokeWidth={selected ? 1.6 : 1.2}
            strokeLinejoin="round"
          />
        ))
      ) : (
        /* Titanium Implant Screw Post */
        <g>
          <path
            d="M 14 24 L 14 48 C 14 51, 22 51, 22 48 L 22 24 Z"
            fill="url(#implantTi)"
            stroke="#1e293b"
            strokeWidth="1.2"
          />
          <line x1="12" y1="28" x2="24" y2="28" stroke="#f1f5f9" strokeWidth="1" />
          <line x1="12" y1="34" x2="24" y2="34" stroke="#f1f5f9" strokeWidth="1" />
          <line x1="13" y1="40" x2="23" y2="40" stroke="#f1f5f9" strokeWidth="1" />
          <line x1="14" y1="45" x2="22" y2="45" stroke="#f1f5f9" strokeWidth="1" />
        </g>
      )}

      {/* RCT Root Canal Gutta-Percha Fill Lines */}
      {isRct && (
        <g stroke="url(#rctCanal)" strokeWidth="2.2" strokeLinecap="round">
          <line x1="18" y1="22" x2="16" y2="48" />
          <line x1="18" y1="22" x2="24" y2="48" />
          <circle cx="16" cy="48" r="1.5" fill="#ef4444" />
          <circle cx="24" cy="48" r="1.5" fill="#ef4444" />
        </g>
      )}

      {/* Crown */}
      <path
        d={shape.crown}
        fill={
          isCrown
            ? 'url(#crownGold)'
            : color
            ? color
            : selected
            ? 'url(#selectedEnamel)'
            : 'url(#pearlEnamel)'
        }
        fillOpacity={isCrown ? 0.95 : color ? 0.35 : 1}
        stroke={isCrown ? '#a16207' : stroke}
        strokeWidth={selected || isCrown ? 1.8 : 1.25}
        strokeLinejoin="round"
      />

      {/* Crown Top Grooves */}
      {!isCrown && shape.grooves.map((d, idx) => (
        <path
          key={`groove-${idx}`}
          d={d}
          fill="none"
          stroke={selected ? '#0a7f8b' : color || '#94a3b8'}
          strokeWidth={0.85}
          strokeLinecap="round"
          opacity={0.65}
        />
      ))}

      {/* Gold Crown Band Accent */}
      {isCrown && (
        <path
          d="M 10 18 Q 18 16 26 18"
          stroke="#ca8a04"
          strokeWidth="1.8"
          fill="none"
        />
      )}

      {/* Caries Decay Pit */}
      {isCaries && (
        <g>
          <ellipse cx="18" cy="14" rx="4" ry="3" fill="#3f1a09" stroke="#78350f" strokeWidth="1" />
          <circle cx="17.5" cy="13.5" r="1.8" fill="#180408" />
        </g>
      )}

      {/* Composite Restoration Highlight */}
      {isRestoration && (
        <ellipse cx="18" cy="14" rx="4.5" ry="3.5" fill="#38bdf8" fillOpacity="0.7" stroke="#0284c7" strokeWidth="1" />
      )}

      {/* Missing Tooth Extraction Slash */}
      {missing && (
        <g stroke={color || '#ef4444'} strokeWidth={2} strokeLinecap="round" opacity={0.95}>
          <line x1="9" y1="7" x2="27" y2="25" />
          <line x1="27" y1="7" x2="9" y2="25" />
        </g>
      )}
    </svg>
  );
}

function Tooth({ number, upper, dentition, record, treatments, selected, onSelect, notation = 'fdi' }) {
  const kind = toothKind(number, dentition);
  const color = record?.conditionColor;
  const conditionCode = record?.conditionCode || '';
  const conditionLabel = record?.conditionLabel || 'No finding recorded';
  const treatmentSummary = treatments.length ? ` · ${treatments.length} treatment item${treatments.length === 1 ? '' : 's'}` : '';
  const missing = ['missing', 'extraction_required'].includes(record?.conditionCode);
  const display = toothDisplay(number, dentition, notation);
  return (
    <button
      type="button"
      onClick={() => onSelect(number)}
      aria-pressed={selected}
      aria-label={`Tooth ${display}${notation === 'universal' ? ` (FDI ${number})` : ''}, ${toothName(number, dentition)}, ${conditionLabel}${treatmentSummary}`}
      title={`${display}${notation === 'universal' ? ` (FDI ${number})` : ''} · ${toothName(number, dentition)}\n${conditionLabel}${treatments.length ? `\n${treatments.map((t) => `${t.treatmentName} (${TREATMENT_LABEL[t.status] || t.status})`).join('\n')}` : ''}`}
      className={`group relative flex w-[clamp(42px,3.1vw,48px)] shrink-0 flex-col items-center rounded-xl border px-1 pb-1 pt-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a7f8b]/40 ${
        selected
          ? 'border-[#0a7f8b] bg-teal-50/80 shadow-md ring-2 ring-[#0a7f8b]/30'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#0a7f8b]/50 hover:shadow-xs dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <span className={`text-[10px] font-bold leading-4 tabular-nums ${selected ? 'text-[#0a7f8b] font-black' : 'text-slate-500'}`}>{display}</span>
      <span className={`block h-[46px] w-[34px] ${upper ? 'rotate-180' : ''}`}>
        <ToothGlyph
          kind={kind}
          color={color}
          selected={selected}
          missing={missing}
          conditionCode={conditionCode}
          conditionLabel={conditionLabel}
        />
      </span>
      <span className="mt-0.5 h-1 w-7 rounded-full" style={{ backgroundColor: color || '#e2e8f0' }} />
      {treatments.length > 0 && (
        <span className="absolute right-0.5 top-0.5 flex flex-col gap-[2px]">
          {treatments.slice(0, 3).map((t) => (
            <span key={t.id} className={`h-1.5 w-1.5 rounded-full ring-1 ring-white ${TREATMENT_DOT[t.status] || 'bg-slate-400'}`} />
          ))}
        </span>
      )}
    </button>
  );
}

function Quadrant({ teeth, upper, dentition, records, treatments, selected, onSelect, label, sublabel, notation }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <span className="text-[9px] text-slate-400">{sublabel}</span>
      </div>
      <div className="flex gap-0.5">
        {teeth.map((number) => (
          <Tooth
            key={number}
            number={number}
            upper={upper}
            dentition={dentition}
            record={records.get(number)}
            treatments={treatments.get(number) || []}
            selected={selected === number}
            onSelect={onSelect}
            notation={notation}
          />
        ))}
      </div>
    </div>
  );
}

export default function Odontogram({ patientId, canEdit = false, consultationId = null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const clinic = useClinic();
  const perioEnabled = clinic.data?.periodontalChartingEnabled !== false;
  const toothNotation = clinic.data?.toothNumbering || 'fdi';
  const [dentition, setDentition] = useState('permanent');
  const [selected, setSelected] = useState(null);
  const [conditionCode, setConditionCode] = useState('');
  const [surface, setSurface] = useState('');
  const [notes, setNotes] = useState('');
  const [perio, setPerio] = useState(EMPTY_PERIO);

  const conditionsQuery = useQuery({
    queryKey: ['tooth-conditions'],
    queryFn: async () => (await api.get('/dental-chart/conditions')).data,
    staleTime: 10 * 60_000
  });

  const chartQuery = useQuery({
    queryKey: ['dental-chart', patientId],
    queryFn: async () => (await api.get(`/dental-chart/patients/${patientId}`)).data,
    enabled: Boolean(patientId)
  });

  const historyQuery = useQuery({
    queryKey: ['tooth-history', patientId, selected],
    queryFn: async () => (await api.get(`/dental-chart/patients/${patientId}/teeth/${selected}/history`)).data,
    enabled: Boolean(patientId && selected)
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post(`/dental-chart/patients/${patientId}`, payload),
    onSuccess: () => {
      toast.success(`Tooth ${selected} finding recorded`);
      queryClient.invalidateQueries({ queryKey: ['dental-chart', patientId] });
      queryClient.invalidateQueries({ queryKey: ['tooth-history', patientId, selected] });
      setNotes('');
      setSurface('');
    },
    onError: (err) => toast.error(err.message)
  });

  const perioMutation = useMutation({
    mutationFn: (payload) => api.post(`/dental-chart/patients/${patientId}/periodontal`, payload),
    onSuccess: () => {
      toast.success(`Periodontal chart saved for tooth ${selected}`);
      queryClient.invalidateQueries({ queryKey: ['dental-chart', patientId] });
    },
    onError: (err) => toast.error(err.message)
  });

  const records = useMemo(() => {
    const list = dentition === 'permanent' ? chartQuery.data?.permanent || [] : chartQuery.data?.primary || [];
    return new Map(list.map((r) => [r.toothNumber, r]));
  }, [chartQuery.data, dentition]);

  const treatments = useMemo(() => {
    const map = new Map();
    (chartQuery.data?.treatments || []).forEach((t) => {
      if (!map.has(t.toothNumber)) map.set(t.toothNumber, []);
      map.get(t.toothNumber).push(t);
    });
    return map;
  }, [chartQuery.data]);

  const allTreatments = chartQuery.data?.treatments || [];
  const dentitionTreatments = allTreatments.filter((t) => t.dentition === dentition);
  const proposedCount = dentitionTreatments.filter((t) => ['proposed', 'accepted'].includes(t.status)).length;
  const completedCount = dentitionTreatments.filter((t) => t.status === 'completed').length;

  const conditions = (conditionsQuery.data || []).filter((c) => c.applies_to === 'both' || c.applies_to === dentition);
  const currentRecord = selected ? records.get(selected) : null;
  const selectedTreatments = selected ? treatments.get(selected) || [] : [];
  const teeth = dentition === 'permanent' ? ADULT : PRIMARY;
  const perioList = chartQuery.data?.periodontal || [];
  const currentPerio = selected ? perioList.find((p) => p.toothNumber === selected && p.dentition === dentition) : null;

  const selectTooth = (tooth) => {
    setSelected(tooth);
    const rec = records.get(tooth);
    setConditionCode(rec?.conditionCode || '');
    setSurface(rec?.surface || '');
    setNotes('');
    const perioRec = perioList.find((p) => p.toothNumber === tooth && p.dentition === dentition);
    setPerio(perioRec ? {
      probingDepths: perioRec.probingDepths || {},
      mobility: String(perioRec.mobility ?? 0),
      furcation: perioRec.furcation || 'none',
      bleedingOnProbing: Boolean(perioRec.bleedingOnProbing),
      suppuration: Boolean(perioRec.suppuration),
      plaque: Boolean(perioRec.plaque),
      calculus: Boolean(perioRec.calculus),
      notes: perioRec.notes || ''
    } : EMPTY_PERIO);
  };

  const setPerioField = (key, value) => setPerio((p) => ({ ...p, [key]: value }));
  const setDepth = (site, value) => setPerio((p) => ({ ...p, probingDepths: { ...p.probingDepths, [site]: value } }));

  const savePerio = () => {
    const depths = Object.fromEntries(
      Object.entries(perio.probingDepths)
        .filter(([, v]) => v !== '' && v != null && !Number.isNaN(Number(v)))
        .map(([k, v]) => [k, Number(v)])
    );
    perioMutation.mutate({
      toothNumber: selected,
      dentition,
      probingDepths: depths,
      mobility: Number(perio.mobility || 0),
      furcation: perio.furcation,
      bleedingOnProbing: perio.bleedingOnProbing,
      suppuration: perio.suppuration,
      plaque: perio.plaque,
      calculus: perio.calculus,
      notes: perio.notes || null,
      consultationId
    });
  };

  if (chartQuery.isLoading) return <PageLoader label="Loading dental chart…" />;
  if (chartQuery.error) return <ErrorState error={chartQuery.error} onRetry={() => chartQuery.refetch()} />;

  const achieved = records.size;

  return (
    <div className="grid grid-cols-1 gap-4 min-[1440px]:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-1">
              {[
                { key: 'permanent', label: 'Permanent Arches' },
                { key: 'primary', label: 'Primary (Deciduous)' }
              ].map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setDentition(d.key);
                    setSelected(null);
                  }}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    dentition === d.key ? 'bg-[#0a7f8b] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <span className="text-[10.5px] text-slate-500">{toothNotation === 'universal' ? 'Universal' : 'FDI'} notation · {dentition === 'permanent' ? '32 permanent teeth' : '20 primary teeth'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
            <span><strong className="font-semibold text-ink">{achieved}</strong>/{Object.values(teeth).flat().length} charted</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><strong className="font-semibold text-ink">{proposedCount}</strong> proposed</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><strong className="font-semibold text-ink">{completedCount}</strong> completed</span>
          </div>
        </div>

        <div className="overflow-x-auto bg-[radial-gradient(circle_at_center,rgba(219,234,254,0.35),transparent_62%)] px-3 py-4">
          <div className="mx-auto min-w-[720px] max-w-[880px]">
            <div className="flex items-start justify-center gap-3">
              <Quadrant
                teeth={teeth.upperRight}
                upper
                dentition={dentition}
                records={records}
                treatments={treatments}
                selected={selected}
                onSelect={selectTooth}
                notation={toothNotation}
                label="Upper right"
                sublabel={dentition === 'permanent' ? (toothNotation === 'universal' ? 'Q1 · 1–8' : 'Q1 · 18–11') : (toothNotation === 'universal' ? 'Q5 · A–E' : 'Q5 · 55–51')}
              />
              <div className="mt-[26px] flex h-[78px] w-3 shrink-0 flex-col items-center justify-between">
                <span className="h-full w-px bg-gradient-to-b from-transparent via-line to-transparent" />
              </div>
              <Quadrant
                teeth={teeth.upperLeft}
                upper
                dentition={dentition}
                records={records}
                treatments={treatments}
                selected={selected}
                onSelect={selectTooth}
                notation={toothNotation}
                label="Upper left"
                sublabel={dentition === 'permanent' ? (toothNotation === 'universal' ? 'Q2 · 9–16' : 'Q2 · 21–28') : (toothNotation === 'universal' ? 'Q6 · F–J' : 'Q6 · 61–65')}
              />
            </div>

            <div className="relative my-2.5 flex items-center gap-2">
              <span className="h-px flex-1 bg-line" />
              <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Occlusal plane</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex items-start justify-center gap-3">
              <Quadrant
                teeth={teeth.lowerRight}
                dentition={dentition}
                records={records}
                treatments={treatments}
                selected={selected}
                onSelect={selectTooth}
                notation={toothNotation}
                label="Lower right"
                sublabel={dentition === 'permanent' ? (toothNotation === 'universal' ? 'Q4 · 25–32' : 'Q4 · 48–41') : (toothNotation === 'universal' ? 'Q8 · P–T' : 'Q8 · 85–81')}
              />
              <div className="mt-[26px] flex h-[78px] w-3 shrink-0 flex-col items-center justify-between">
                <span className="h-full w-px bg-gradient-to-b from-transparent via-line to-transparent" />
              </div>
              <Quadrant
                teeth={teeth.lowerLeft}
                dentition={dentition}
                records={records}
                treatments={treatments}
                selected={selected}
                onSelect={selectTooth}
                notation={toothNotation}
                label="Lower left"
                sublabel={dentition === 'permanent' ? (toothNotation === 'universal' ? 'Q3 · 17–24' : 'Q3 · 31–38') : (toothNotation === 'universal' ? 'Q7 · K–O' : 'Q7 · 71–75')}
              />
            </div>
          </div>
        </div>

        {/* Live Treatment Cost Estimator Banner */}
        <div className="border-t border-teal-500/20 bg-gradient-to-r from-teal-500/10 via-slate-50 to-emerald-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 dark:from-teal-950/40 dark:to-emerald-950/40">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009da6] text-white text-xs font-black">
              ₹
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Live Treatment Plan Estimator
              </p>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                {dentitionTreatments.length} procedure item{dentitionTreatments.length === 1 ? '' : 's'} linked · Total Est:{' '}
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatMoney(dentitionTreatments.reduce((acc, t) => acc + (Number(t.total) || 0), 0))}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/treatment-plans?patientId=${patientId}`}
              className="inline-flex items-center gap-1 rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-xs font-bold text-white transition shadow-2xs"
            >
              <span>View Treatment Plans</span>
              <span className="text-[10px]">➜</span>
            </Link>
            <Link
              to={`/invoices/new?patientId=${patientId}`}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition shadow-2xs"
            >
              <span>Instant Invoice</span>
              <span className="text-[10px]">➜</span>
            </Link>
          </div>
        </div>

        <div className="border-t border-line/80 bg-slate-50/35 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">Condition legend</p>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" /> Not recorded
                </span>
                {(conditionsQuery.data || []).map((c) => (
                  <span key={c.code} className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-sm border border-black/10" style={{ backgroundColor: c.color }} /> {c.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-[180px]">
              <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">Treatment markers</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {Object.entries(TREATMENT_LABEL).map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${TREATMENT_DOT[key]}`} /> {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/50 dark:bg-slate-850">
            {selected ? (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {dentition === 'permanent' ? 'Permanent' : 'Primary'} · Tooth {toothDisplay(selected, dentition, toothNotation)}
                  </p>
                  <h3 className="mt-0.5 text-base font-black text-slate-900 dark:text-white">{toothName(selected, dentition)}</h3>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800" aria-label="Clear tooth selection">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tooth Inspector</p>
                <h3 className="mt-0.5 text-base font-black text-slate-900 dark:text-white">Select a Tooth</h3>
              </>
            )}
          </div>

          {!selected ? (
            <div className="px-4 py-4">
              <p className="text-[11.5px] leading-relaxed text-slate-500">
                Choose a tooth from the odontogram to review its diagnosis, linked treatment and clinical history. Use Tab and Enter to navigate the chart by keyboard.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line/80 bg-slate-50/60 p-2.5">
                  <p className="text-[9.5px] uppercase tracking-wide text-slate-400">Charted teeth</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{achieved}</p>
                </div>
                <div className="rounded-lg border border-line/80 bg-slate-50/60 p-2.5">
                  <p className="text-[9.5px] uppercase tracking-wide text-slate-400">Treatment items</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{dentitionTreatments.length}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3">
              <div className="rounded-lg border border-line/80 bg-slate-50/55 p-3">
                {currentRecord ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: currentRecord.conditionColor }} />
                      <p className="text-[13px] font-semibold text-ink">{currentRecord.conditionLabel}</p>
                      {currentRecord.surface && <span className="rounded border border-line bg-white px-1.5 py-px text-[9.5px] font-medium text-slate-500">{humanize(currentRecord.surface)}</span>}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-slate-500">
                      <CalendarCheck2 size={11} />
                      {formatDateTime(currentRecord.recordedAt)}{currentRecord.recordedByName ? ` · ${currentRecord.recordedByName}` : ''}
                    </p>
                    {currentRecord.notes && <p className="mt-1.5 border-t border-line/70 pt-1.5 text-[11.5px] leading-relaxed text-slate-600">{currentRecord.notes}</p>}
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                    <CheckCircle2 size={13} className="text-slate-400" /> No finding recorded for this tooth.
                  </p>
                )}
              </div>

              {selectedTreatments.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"><ClipboardList size={12} /> Linked treatment</p>
                  <ul className="space-y-1.5">
                    {selectedTreatments.map((t) => (
                      <li key={t.id} className="rounded-lg border border-line/80 bg-white px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11.5px] font-medium text-ink">{t.treatmentName}</p>
                          <Badge status={t.status} className="!px-1.5 !py-0 !text-[9px]" />
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
                          <Link to={`/treatment-plans/${t.planId}`} className="font-medium text-accent hover:underline">{t.planNo}</Link>
                          <span>·</span>
                          <span>{formatMoney(t.total)}</span>
                          {t.completedAt && <><span>·</span><span>Completed {formatDateTime(t.completedAt)}</span></>}
                        </p>
                        {t.notes && <p className="mt-1 text-[10.5px] text-slate-500">{t.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canEdit ? (
                <form
                  className="mt-3 space-y-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!conditionCode) {
                      toast.error('Select a tooth condition');
                      return;
                    }
                    saveMutation.mutate({
                      toothNumber: selected,
                      dentition,
                      conditionCode,
                      surface: surface || null,
                      notes: notes || null,
                      consultationId
                    });
                  }}
                >
                  <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span className="flex items-center gap-1"><Stethoscope size={12} /> Quick Dental Condition</span>
                  </div>

                  {/* 1-Click Visual Dental Condition Palette */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {conditions.slice(0, 8).map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setConditionCode(c.code)}
                        className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-[11px] font-medium text-left transition cursor-pointer ${
                          conditionCode === c.code
                            ? 'border-accent bg-accent-50 text-accent-800 shadow-2xs ring-1 ring-accent'
                            : 'border-line bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-xs shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>

                  <Select label="All Conditions" value={conditionCode} onChange={(e) => setConditionCode(e.target.value)} required>
                    <option value="">Select condition…</option>
                    {conditions.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </Select>

                  {/* 1-Click Surface Shortcut Pills */}
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">Tooth Surface</label>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {[
                        { key: 'occlusal', label: 'O (Occlusal)' },
                        { key: 'mesial', label: 'M (Mesial)' },
                        { key: 'distal', label: 'D (Distal)' },
                        { key: 'buccal', label: 'B (Buccal)' },
                        { key: 'lingual', label: 'L (Lingual)' },
                        { key: 'incisal', label: 'I (Incisal)' },
                        { key: 'mo', label: 'MO' },
                        { key: 'do', label: 'DO' },
                        { key: 'mod', label: 'MOD' },
                        { key: 'ob', label: 'OB' }
                      ].map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setSurface(surface === s.key ? '' : s.key)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase transition cursor-pointer ${
                            surface === s.key
                              ? 'bg-teal-700 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                    <Select value={surface} onChange={(e) => setSurface(e.target.value)}>
                      <option value="">Full Tooth / Not specified</option>
                      {['mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal', 'cervical'].map((s) => (
                        <option key={s} value={s}>{humanize(s)} surface</option>
                      ))}
                    </Select>
                  </div>
                  <Textarea label="Clinical note" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note for this finding" />
                  <Button type="submit" size="sm" className="w-full" icon={Save} loading={saveMutation.isPending}>
                    Save finding
                  </Button>
                  <p className="text-[9.5px] leading-relaxed text-slate-500">
                    Saving supersedes the current finding. Earlier records remain available in tooth history and are never overwritten.
                  </p>
                </form>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-800">
                  <AlertCircle size={12} /> Chart editing requires dentist authorization.
                </p>
              )}

              {perioEnabled && (
                <div className="mt-3 rounded-lg border border-line/80 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Periodontal chart</p>
                    {currentPerio && <span className="text-[9px] text-slate-400">Updated {formatDateTime(currentPerio.recordedAt)}</span>}
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {PERIO_SITES.map((site) => (
                      <label key={site.key} className="block">
                        <span className="mb-0.5 block text-center text-[9px] font-medium uppercase tracking-wide text-slate-400">{site.label} depth</span>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          inputMode="numeric"
                          value={perio.probingDepths?.[site.key] ?? ''}
                          onChange={(e) => setDepth(site.key, e.target.value)}
                          disabled={!canEdit}
                          placeholder="mm"
                          className="input-base h-8 px-1 text-center text-[11px]"
                          aria-label={`${site.label} probing depth`}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-400">Mobility</span>
                      <select value={perio.mobility} onChange={(e) => setPerioField('mobility', e.target.value)} disabled={!canEdit} className="input-base h-8 text-[11px]" aria-label="Mobility">
                        <option value="0">Grade 0 — normal</option>
                        <option value="1">Grade I — slight</option>
                        <option value="2">Grade II — moderate</option>
                        <option value="3">Grade III — severe</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-400">Furcation</span>
                      <select value={perio.furcation} onChange={(e) => setPerioField('furcation', e.target.value)} disabled={!canEdit} className="input-base h-8 text-[11px]" aria-label="Furcation">
                        <option value="none">None</option>
                        <option value="class_i">Class I</option>
                        <option value="class_ii">Class II</option>
                        <option value="class_iii">Class III</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                    {[
                      ['bleedingOnProbing', 'Bleeding on probing'],
                      ['suppuration', 'Suppuration'],
                      ['plaque', 'Plaque'],
                      ['calculus', 'Calculus']
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={Boolean(perio[key])}
                          onChange={(e) => setPerioField(key, e.target.checked)}
                          disabled={!canEdit}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2288d4]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={perio.notes || ''}
                    onChange={(e) => setPerioField('notes', e.target.value)}
                    disabled={!canEdit}
                    placeholder="Gingival margin, recession or other perio notes"
                    className="input-base mt-2 resize-y text-[11px]"
                    aria-label="Periodontal notes"
                  />

                  {canEdit ? (
                    <Button type="button" size="sm" className="mt-2 w-full" icon={Save} loading={perioMutation.isPending} onClick={savePerio}>
                      Save periodontal chart
                    </Button>
                  ) : (
                    <p className="mt-2 text-[9.5px] text-slate-500">Read-only. Periodontal charting requires chart-edit authorization.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="card-base overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line/80 px-4 py-2.5">
              <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-navy">
                <History size={13} /> Tooth history
              </h3>
              <span className="text-[9.5px] text-slate-400">{historyQuery.data?.length || 0} records</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto px-4 py-3">
              {historyQuery.isLoading ? (
                <p className="text-[11px] text-slate-500">Loading history…</p>
              ) : (historyQuery.data || []).length === 0 ? (
                <p className="text-[11px] text-slate-500">No history for this tooth.</p>
              ) : (
                <ol className="space-y-2.5 border-l border-line pl-3">
                  {historyQuery.data.map((h) => (
                    <li key={h.id} className="relative">
                      <span className={`absolute -left-[17px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white ${h.isCurrent ? 'bg-accent' : 'bg-slate-300'}`} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[11.5px] font-medium text-ink">{h.conditionLabel}</p>
                        {h.isCurrent && <span className="rounded bg-accent-50 px-1 py-px text-[8.5px] font-semibold uppercase tracking-wide text-accent-700">Current</span>}
                        {h.surface && <span className="text-[9px] text-slate-400">{humanize(h.surface)}</span>}
                      </div>
                      <p className="text-[9.5px] text-slate-500">{formatDateTime(h.recordedAt)}{h.recordedByName ? ` · ${h.recordedByName}` : ''}</p>
                      {h.notes && <p className="text-[10.5px] leading-snug text-slate-600">{h.notes}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        {!selected && achieved === 0 && dentitionTreatments.length === 0 && (
          <EmptyState title="Chart is empty" message="Record the first finding on a tooth to begin the dental chart." />
        )}
      </aside>
    </div>
  );
}
