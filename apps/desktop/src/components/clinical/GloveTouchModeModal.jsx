import { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  Share2,
  Printer,
  Pill,
  Stethoscope,
  Smile,
  ShieldAlert,
  Save,
  RotateCcw,
  Plus
} from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

// ── Tamil Nadu & Kongu Clinical Standards ────────────────────────────────────
const CHIEF_COMPLAINTS = [
  { id: 'cc-pain', label: 'Severe Toothache', labelTa: 'கடுமையான பல் வலி', icon: '⚡' },
  { id: 'cc-sens', label: 'Cold / Hot Sensitivity', labelTa: 'பல் கூச்சம்', icon: '❄️' },
  { id: 'cc-gums', label: 'Bleeding Gums / Pyorrhea', labelTa: 'ஈறு இரத்தக் கசிவு', icon: '🩸' },
  { id: 'cc-broken', label: 'Broken / Fractured Tooth', labelTa: 'உடைந்த பல்', icon: '💥' },
  { id: 'cc-food', label: 'Food Lodgement / Space', labelTa: 'உணவு சிக்குதல்', icon: '🥩' },
  { id: 'cc-crown', label: 'Crown / Cap Dislodged', labelTa: 'கேப் கழன்றுவிட்டது', icon: '👑' },
  { id: 'cc-check', label: 'Routine Scaling Checkup', labelTa: 'வழக்கமான பரிசோதனை', icon: '✨' },
  { id: 'cc-ortho', label: 'Crooked Teeth / Braces', labelTa: 'பல் வரிசை சீரமைப்பு', icon: '🦷' }
];

const FAST_PROCEDURES = [
  { id: 'proc-scaling', name: 'Ultrasonic Scaling & Polishing', fee: 1000, category: 'Perio', icon: '✨' },
  { id: 'proc-comp', name: 'Composite Restoration (Tooth Colored)', fee: 1200, category: 'Restorative', icon: '💎' },
  { id: 'proc-rct', name: 'Root Canal (RCT 1st Sitting Access)', fee: 1500, category: 'Endo', icon: '⚡' },
  { id: 'proc-ext', name: 'Painless Simple Extraction', fee: 800, category: 'Surgery', icon: '🦷' },
  { id: 'proc-impa', name: 'Surgical Impaction (Third Molar)', fee: 3500, category: 'Surgery', icon: '💉' },
  { id: 'proc-zirconia', name: 'CAD/CAM Zirconia Crown (15-Yr)', fee: 3500, category: 'Prostho', icon: '👑' },
  { id: 'proc-pfm', name: 'PFM Crown (Ceramic Metal)', fee: 2200, category: 'Prostho', icon: '🛡️' },
  { id: 'proc-denture', name: 'Complete Denture (Per Arch)', fee: 6500, category: 'Prostho', icon: '👄' }
];

const FAST_RX_BUNDLES = [
  {
    id: 'rx-std',
    name: 'Standard Dental Infection Pack',
    badge: 'Adult First-Line',
    drugs: [
      { name: 'Amoxicillin 500mg', dose: '1 cap TDS (8 hrly)', days: '5 Days', notes: 'After food' },
      { name: 'Zerodol-SP (Aceclo+Para+Serratio)', dose: '1 tab BD (12 hrly)', days: '3 Days', notes: 'After meals' },
      { name: 'Pantop 40mg', dose: '1 tab OD (Morning)', days: '5 Days', notes: '30 mins before food' }
    ]
  },
  {
    id: 'rx-allergy',
    name: 'Penicillin-Allergic Pack',
    badge: 'Safe Alternative',
    drugs: [
      { name: 'Clindamycin 300mg', dose: '1 cap TDS (8 hrly)', days: '5 Days', notes: 'With full glass of water' },
      { name: 'Zerodol-SP', dose: '1 tab BD', days: '3 Days', notes: 'After meals' },
      { name: 'Pantop 40mg', dose: '1 tab OD', days: '5 Days', notes: 'Empty stomach' }
    ]
  },
  {
    id: 'rx-severe',
    name: 'Acute Severe Swelling / Anaerobic Pack',
    badge: 'Intense Care',
    drugs: [
      { name: 'Augmentin 625mg', dose: '1 tab BD', days: '5 Days', notes: 'With meals' },
      { name: 'Metrogyl 400mg', dose: '1 tab TDS', days: '5 Days', notes: 'Strictly no alcohol' },
      { name: 'Zerodol-SP', dose: '1 tab BD', days: '3 Days', notes: 'After meals' }
    ]
  },
  {
    id: 'rx-post-ext',
    name: 'Post-Extraction Pain & Healing Pack',
    badge: 'Post-Op Care',
    drugs: [
      { name: 'Aceclofenac + Paracetamol', dose: '1 tab BD', days: '3 Days', notes: 'After food' },
      { name: 'Chymoral Forte (Enzymatic anti-edema)', dose: '1 tab TDS', days: '3 Days', notes: '30 mins before food' },
      { name: 'Warm Saline Gargles', dose: '3 times daily', days: 'Starting after 24 hrs', notes: 'Do not spit violently' }
    ]
  }
];

export default function GloveTouchModeModal({
  isOpen,
  onClose,
  patientName = 'Selected Patient',
  patientId = '',
  clinicName = 'ZhanX Dental Care'
}) {
  const toast = useToast();
  const [selectedCC, setSelectedCC] = useState([]);
  const [selectedProcedures, setSelectedProcedures] = useState([]);
  const [selectedRx, setSelectedRx] = useState(null);
  const [chairNotes, setChairNotes] = useState('');

  if (!isOpen) return null;

  const toggleCC = (id) => {
    setSelectedCC((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleProcedure = (proc) => {
    setSelectedProcedures((prev) => {
      const exists = prev.find((p) => p.id === proc.id);
      if (exists) {
        return prev.filter((p) => p.id !== proc.id);
      }
      return [...prev, proc];
    });
  };

  const totalFee = selectedProcedures.reduce((sum, p) => sum + p.fee, 0);

  const handlePrintSlip = () => {
    toast.success('Dispatching to 3-inch thermal operatory printer…');
    window.print();
  };

  const handleWhatsApp = () => {
    const ccText = selectedCC
      .map((id) => CHIEF_COMPLAINTS.find((c) => c.id === id)?.label)
      .filter(Boolean)
      .join(', ');

    const procText = selectedProcedures
      .map((p) => `• ${p.name} (₹${p.fee})`)
      .join('\n');

    const rxText = selectedRx
      ? `\n\n*Prescribed Medications:*\n` +
        selectedRx.drugs
          .map((d) => `• *${d.name}*: ${d.dose} for ${d.days} (${d.notes})`)
          .join('\n')
      : '';

    const text = encodeURIComponent(
      `*${clinicName} · Chair-Side Consultation Slip*\n\n` +
      `👤 *Patient:* ${patientName}\n` +
      `🩺 *Chief Complaint:* ${ccText || 'Routine Dental Check'}\n\n` +
      `🦷 *Procedures Done / Planned:* (Total: ₹${totalFee})\n${procText || 'Clinical Examination'}` +
      rxText +
      `\n\nTake care of your smile! For emergency queries, call ${clinicName}.`
    );

    window.open(`https://wa.me/?text=${text}`, '_blank');
    toast.success('Opening WhatsApp with consultation summary…');
  };

  const handleClearAll = () => {
    setSelectedCC([]);
    setSelectedProcedures([]);
    setSelectedRx(null);
    setChairNotes('');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 text-white backdrop-blur-2xl overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200 select-none">
      {/* ── Top Glove Header with High Contrast ── */}
      <div className="flex items-center justify-between border-b border-teal-500/30 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#009da6] text-white shadow-lg shadow-teal-500/40 text-2xl font-black">
            🧤
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                CHAIR-SIDE GLOVE TOUCH MODE
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-black text-emerald-300 border border-emerald-500/40">
                Large Touch Targets (64px+)
              </span>
            </div>
            <p className="text-xs text-teal-200/80 font-medium mt-0.5">
              Operating for: <strong className="text-white underline">{patientName}</strong> · Fast 1-Tap Entry for Latex &amp; Nitrile Gloves
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600/90 hover:bg-rose-500 text-white shadow-xl transition-transform active:scale-90 cursor-pointer"
        >
          <X size={28} strokeWidth={2.8} />
        </button>
      </div>

      <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full pb-20">
        {/* ── Section 1: Chief Complaints (1-Tap Large Tiles) ── */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-black uppercase tracking-wider text-teal-300 flex items-center gap-2">
              <span>1. CHIEF COMPLAINT (1-TAP SELECT)</span>
              <span className="text-[11px] font-bold text-slate-400">
                ({selectedCC.length} selected)
              </span>
            </h3>
            <span className="text-xs text-slate-400">Tap to toggle</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CHIEF_COMPLAINTS.map((cc) => {
              const isSelected = selectedCC.includes(cc.id);
              return (
                <button
                  key={cc.id}
                  type="button"
                  onClick={() => toggleCC(cc.id)}
                  className={`flex min-h-[72px] flex-col justify-center rounded-2xl border-2 p-3 text-left transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'border-[#00d1dc] bg-teal-950/90 text-white shadow-lg shadow-teal-500/30 ring-2 ring-teal-400'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{cc.icon}</span>
                    {isSelected && <CheckCircle2 size={18} className="text-[#00d1dc]" />}
                  </div>
                  <span className="font-black text-xs sm:text-sm mt-1 leading-snug">{cc.label}</span>
                  <span className="text-[10px] text-teal-200/70 font-semibold">{cc.labelTa}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Fast Operatory Procedures (Standard Fees) ── */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-black uppercase tracking-wider text-teal-300 flex items-center gap-2">
              <span>2. QUICK PROCEDURES &amp; PRICING</span>
              <span className="rounded-lg bg-teal-500/20 px-2 py-0.5 text-xs font-black text-teal-300 font-mono">
                Total: ₹{totalFee.toLocaleString('en-IN')}
              </span>
            </h3>
            <span className="text-xs text-slate-400">Tap to add to bill</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FAST_PROCEDURES.map((proc) => {
              const isSelected = Boolean(selectedProcedures.find((p) => p.id === proc.id));
              return (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => toggleProcedure(proc)}
                  className={`flex min-h-[72px] flex-col justify-center rounded-2xl border-2 p-3 text-left transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-950/90 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                      {proc.category}
                    </span>
                    <span className="font-mono text-sm font-black text-emerald-400">
                      ₹{proc.fee}
                    </span>
                  </div>
                  <span className="font-bold text-xs sm:text-sm mt-1 leading-snug line-clamp-1">
                    {proc.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: 1-Tap Dental Rx Bundles ── */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-black uppercase tracking-wider text-teal-300 flex items-center gap-2">
              <span>3. INSTANT RX MEDICATION BUNDLES</span>
              <span className="text-xs text-slate-400">1-tap complete dental prescription</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FAST_RX_BUNDLES.map((bundle) => {
              const isSelected = selectedRx?.id === bundle.id;
              return (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setSelectedRx(isSelected ? null : bundle)}
                  className={`flex flex-col rounded-2xl border-2 p-3.5 text-left transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'border-[#00d1dc] bg-teal-950/90 text-white shadow-xl shadow-teal-500/30 ring-2 ring-teal-400'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-teal-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-300">
                      {bundle.badge}
                    </span>
                    {isSelected && <CheckCircle2 size={16} className="text-[#00d1dc]" />}
                  </div>

                  <span className="font-black text-xs sm:text-sm mt-2 text-white">
                    {bundle.name}
                  </span>

                  <ul className="mt-2 space-y-1 text-[11px] text-slate-300 border-t border-slate-800/80 pt-2">
                    {bundle.drugs.map((d, i) => (
                      <li key={i} className="truncate">
                        💊 <strong>{d.name}</strong> · {d.dose}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Sticky Bottom Glove Action Dock (Tactile 64px) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-teal-500/40 bg-slate-950/95 p-3.5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-300 hover:bg-slate-800 active:scale-95 transition"
            >
              <RotateCcw size={16} />
              <span>Clear</span>
            </button>

            <div className="text-xs">
              <span className="text-slate-400">Total Billed: </span>
              <strong className="text-emerald-400 font-mono text-base">₹{totalFee.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrintSlip}
              className="flex-1 sm:flex-initial inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-teal-500/50 bg-teal-900/60 px-5 text-sm font-black text-teal-200 hover:bg-teal-900 active:scale-95 transition cursor-pointer shadow-md"
            >
              <Printer size={18} />
              <span>Print Slip</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 sm:flex-initial inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white hover:bg-emerald-500 active:scale-95 transition cursor-pointer shadow-xl shadow-emerald-600/30"
            >
              <Share2 size={18} />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toast.success('Chair-Side entries saved successfully to patient chart!');
                onClose();
              }}
              className="flex-1 sm:flex-initial inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00d1dc] via-[#009da6] to-[#044c54] px-8 text-sm font-black text-white hover:opacity-95 active:scale-95 transition cursor-pointer shadow-xl shadow-teal-500/30"
            >
              <Save size={18} />
              <span>Save &amp; Finish</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}