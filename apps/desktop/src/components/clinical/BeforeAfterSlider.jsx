import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Sliders,
  Share2,
  Upload,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  Info,
  Phone
} from 'lucide-react';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

// ── High-Fidelity Dental Aesthetic Cases ─────────────────────────────────────
const CLINICAL_PRESETS = [
  {
    id: 'scaling-stains',
    title: 'Ultrasonic Scaling & Stain Removal',
    category: 'Periodontics',
    tag: 'Kongu / Erode Case Study',
    description: 'Heavy betel nut, tobacco, and supragingival calculus debridement with airflow polishing.',
    toothRange: '13-23 & 33-43 (Anteriors)',
    sittings: '1 Visit (45 mins)',
    shadeBefore: 'Severe Stains & Plaque',
    shadeAfter: 'Natural Bright Enamel',
    beforeSvgType: 'stains',
    afterSvgType: 'clean'
  },
  {
    id: 'laser-whitening',
    title: 'In-Office Diode Laser Teeth Whitening',
    category: 'Cosmetic Dentistry',
    tag: 'Smile Makeover',
    description: '35% Hydrogen Peroxide laser-activated power bleaching. 6 shades lighter on VITA scale.',
    toothRange: '14-24 & 34-44 (Smile Zone)',
    sittings: '1 Visit (60 mins)',
    shadeBefore: 'VITA A3.5 (Yellowish)',
    shadeAfter: 'VITA B1 (Bleached Pearl)',
    beforeSvgType: 'yellow',
    afterSvgType: 'bleach'
  },
  {
    id: 'zirconia-veneers',
    title: 'Zirconia Aesthetic Veneers & Diastema',
    category: 'Prosthodontics',
    tag: 'Premium Aesthetic',
    description: 'Midline diastema closure and incisal edge alignment with CAD/CAM multilayered zirconia veneers.',
    toothRange: '11, 21, 12, 22 (Maxillary Central)',
    sittings: '2 Visits (Prep & Bond)',
    shadeBefore: 'Gap & Chipped Incisal',
    shadeAfter: 'Uniform Symmetrical Smile',
    beforeSvgType: 'gap',
    afterSvgType: 'aligned'
  },
  {
    id: 'composite-restoration',
    title: 'Class IV Anterior Nano-Composite Restoration',
    category: 'Conservative Dentistry',
    tag: 'Biomimetic Layering',
    description: 'Trauma fracture repair of tooth 11 using enamel and dentin optical layering with micro-hybrid resin.',
    toothRange: 'Tooth 11 (Maxillary Incisor)',
    sittings: '1 Visit (30 mins)',
    shadeBefore: 'Fractured Angle (Tooth 11)',
    shadeAfter: 'Invisible Seamless Margin',
    beforeSvgType: 'fracture',
    afterSvgType: 'restored'
  }
];

// ── Stylized Clinical Smile Visualizer SVG ──────────────────────────────────
function ClinicalSmileArt({ variant = 'clean', isAfter = false }) {
  const isDarkEnamel = variant === 'yellow' || variant === 'stains';
  const enamelColor = variant === 'bleach'
    ? '#ffffff'
    : variant === 'clean' || variant === 'aligned' || variant === 'restored'
    ? '#f8fafc'
    : variant === 'yellow'
    ? '#fef08a'
    : '#fde047';

  const gumColor = variant === 'stains' ? '#f472b6' : '#fda4af';

  return (
    <svg viewBox="0 0 400 240" className="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`enamelGlow-${variant}-${isAfter}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={variant === 'bleach' ? 0.95 : 0.6} />
          <stop offset="100%" stopColor={enamelColor} />
        </radialGradient>
        <linearGradient id={`gumGrad-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gumColor} />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      {/* Oral Cavity Background */}
      <rect width="400" height="240" fill="#180408" />

      {/* Gingiva / Upper Gums */}
      <path
        d="M 20 60 C 80 40, 140 35, 200 35 C 260 35, 320 40, 380 60 C 380 85, 360 90, 340 85 C 310 75, 280 80, 250 82 C 220 85, 180 85, 150 82 C 120 80, 90 75, 60 85 C 40 90, 20 85, 20 60 Z"
        fill={`url(#gumGrad-${variant})`}
      />

      {/* Upper Arch Teeth (13, 12, 11, 21, 22, 23) */}
      <g>
        {/* Tooth 13 (Canine) */}
        <path
          d="M 50 80 C 65 78, 80 82, 85 110 C 80 135, 65 145, 55 135 C 45 125, 45 95, 50 80 Z"
          fill={`url(#enamelGlow-${variant}-${isAfter})`}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />

        {/* Tooth 12 (Lateral Incisor) */}
        <path
          d="M 85 82 C 100 80, 120 82, 125 115 C 125 142, 105 146, 92 144 C 80 142, 80 110, 85 82 Z"
          fill={`url(#enamelGlow-${variant}-${isAfter})`}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />

        {/* Tooth 11 (Maxillary Central Incisor) */}
        {variant === 'gap' ? (
          // Midline Gap before treatment
          <path
            d="M 127 82 C 145 80, 180 80, 185 115 C 185 152, 165 158, 145 158 C 128 158, 122 135, 127 82 Z"
            fill={`url(#enamelGlow-${variant}-${isAfter})`}
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
        ) : variant === 'fracture' ? (
          // Broken Incisal Angle before treatment
          <path
            d="M 127 82 C 145 80, 190 80, 195 115 L 180 138 L 160 132 L 135 158 C 128 158, 122 135, 127 82 Z"
            fill={`url(#enamelGlow-${variant}-${isAfter})`}
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
        ) : (
          // Perfect / Restored Central 11
          <path
            d="M 127 82 C 145 80, 193 80, 198 115 C 198 155, 185 160, 162 160 C 138 160, 125 152, 127 82 Z"
            fill={`url(#enamelGlow-${variant}-${isAfter})`}
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
        )}

        {/* Tooth 21 (Maxillary Central Incisor) */}
        {variant === 'gap' ? (
          // Separated 21 before diastema closure
          <path
            d="M 215 82 C 220 80, 255 80, 273 82 C 278 135, 272 158, 255 158 C 235 158, 215 152, 215 115 Z"
            fill={`url(#enamelGlow-${variant}-${isAfter})`}
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
        ) : (
          // Perfectly aligned 21
          <path
            d="M 202 82 C 207 80, 255 80, 273 82 C 275 152, 262 160, 238 160 C 215 160, 202 155, 202 115 Z"
            fill={`url(#enamelGlow-${variant}-${isAfter})`}
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
        )}

        {/* Tooth 22 (Lateral Incisor) */}
        <path
          d="M 275 82 C 280 82, 300 80, 315 82 C 320 110, 320 142, 308 144 C 295 146, 275 142, 275 115 Z"
          fill={`url(#enamelGlow-${variant}-${isAfter})`}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />

        {/* Tooth 23 (Canine) */}
        <path
          d="M 315 80 C 320 82, 335 78, 350 80 C 355 95, 355 125, 345 135 C 335 145, 320 135, 315 110 Z"
          fill={`url(#enamelGlow-${variant}-${isAfter})`}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />
      </g>

      {/* Stains & Tartar Calculus Texture (Only for 'stains' variant) */}
      {variant === 'stains' && (
        <g opacity="0.85">
          {/* Supragingival calculus bands along gumline */}
          <path
            d="M 70 88 Q 95 96 125 90 Q 165 96 200 90 Q 240 96 280 90 Q 315 96 335 88"
            stroke="#78350f"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Deep dark brown tobacco/pan specks */}
          <circle cx="160" cy="115" r="4" fill="#451a03" />
          <circle cx="170" cy="125" r="5" fill="#713f12" />
          <circle cx="230" cy="118" r="4.5" fill="#451a03" />
          <circle cx="240" cy="130" r="3.5" fill="#78350f" />
          <circle cx="105" cy="110" r="3" fill="#713f12" />
          <circle cx="295" cy="112" r="3.5" fill="#451a03" />
        </g>
      )}

      {/* Sparkling Highlight Stars on clean/bleach finish */}
      {(variant === 'bleach' || variant === 'aligned' || variant === 'restored' || isAfter) && (
        <g fill="#38bdf8" opacity="0.9">
          <path d="M 175 105 L 178 112 L 185 115 L 178 118 L 175 125 L 172 118 L 165 115 L 172 112 Z" />
          <path d="M 245 125 L 247 130 L 252 132 L 247 134 L 245 139 L 243 134 L 238 132 L 243 130 Z" />
        </g>
      )}

      {/* Lower Lip Arch Framing */}
      <path
        d="M 10 160 C 100 220, 300 220, 390 160 C 350 235, 50 235, 10 160 Z"
        fill="#e11d48"
        opacity="0.95"
      />
    </svg>
  );
}

export default function BeforeAfterSlider({ patientName = 'Selected Patient', clinicName = 'ZhanX Dental Care' }) {
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const [customBeforeImg, setCustomBeforeImg] = useState(null);
  const [customAfterImg, setCustomAfterImg] = useState(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const containerRef = useRef(null);

  const activePreset = CLINICAL_PRESETS[activePresetIndex];

  // Dragging slider logic
  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pos);
  }, []);

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  // Image upload handlers
  const handleUploadBefore = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBeforeImg(url);
    }
  };

  const handleUploadAfter = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomAfterImg(url);
    }
  };

  // WhatsApp share generator
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello ${patientName}!\n\nHere is your Clinical Before & After Smile Transformation from *${clinicName}*:\n\n` +
      `✨ *Procedure:* ${activePreset.title}\n` +
      `🦷 *Teeth Treated:* ${activePreset.toothRange}\n` +
      `⏱️ *Time/Sittings:* ${activePreset.sittings}\n` +
      `🌟 *Initial Shade:* ${activePreset.shadeBefore}\n` +
      `💎 *Final Smile:* ${activePreset.shadeAfter}\n\n` +
      `Thank you for trusting ${clinicName} with your healthy smile! Remember to follow your post-op care advice.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 3000);
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-[#009da6] dark:bg-teal-500/20 dark:text-teal-300">
            <Sliders size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Before &amp; After Smile Comparison
              </h3>
              <Badge variant="teal" size="sm">
                Aesthetic Studio
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive split-slider for patient consultation &amp; aesthetic case acceptance.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Upload Buttons */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition">
            <Upload size={14} className="text-teal-600 dark:text-teal-400" />
            <span>Upload Pre-Op</span>
            <input type="file" accept="image/*" onChange={handleUploadBefore} className="hidden" />
          </label>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition">
            <Upload size={14} className="text-teal-600 dark:text-teal-400" />
            <span>Upload Post-Op</span>
            <input type="file" accept="image/*" onChange={handleUploadAfter} className="hidden" />
          </label>

          {/* Share to WhatsApp */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
          >
            <Share2 size={14} />
            <span>{shareSuccess ? 'Opening WhatsApp…' : 'Share on WhatsApp'}</span>
          </button>
        </div>
      </div>

      {/* Presets Carousel Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CLINICAL_PRESETS.map((preset, idx) => {
          const isActive = activePresetIndex === idx;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setActivePresetIndex(idx);
                setCustomBeforeImg(null);
                setCustomAfterImg(null);
              }}
              className={`shrink-0 rounded-2xl border px-3.5 py-2 text-left transition cursor-pointer ${
                isActive
                  ? 'border-[#009da6] bg-teal-500/10 text-[#009da6] dark:bg-teal-500/20 dark:text-teal-300 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-black">
                <span>{preset.title}</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {preset.category} · {preset.sittings}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Interactive Split Slider Display ──────────────────────────────── */}
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg dark:border-slate-700">
        <div
          ref={containerRef}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
          className="relative h-72 sm:h-96 w-full cursor-ew-resize overflow-hidden select-none"
        >
          {/* AFTER (Right / Full layer underneath) */}
          <div className="absolute inset-0 h-full w-full">
            {customAfterImg ? (
              <img src={customAfterImg} alt="After Treatment" className="h-full w-full object-cover" />
            ) : (
              <ClinicalSmileArt variant={activePreset.afterSvgType} isAfter={true} />
            )}

            {/* After Watermark Label */}
            <div className="absolute top-4 right-4 rounded-xl bg-emerald-600/90 px-3 py-1 text-xs font-black tracking-wider text-white shadow-md backdrop-blur-md">
              AFTER · POST-OP
            </div>
          </div>

          {/* BEFORE (Left / Clipped overlay) */}
          <div
            className="absolute inset-0 h-full overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <div className="absolute inset-0 h-full w-[100vw] max-w-3xl">
              {customBeforeImg ? (
                <img src={customBeforeImg} alt="Before Treatment" className="h-full w-full object-cover" />
              ) : (
                <ClinicalSmileArt variant={activePreset.beforeSvgType} isAfter={false} />
              )}
            </div>

            {/* Before Watermark Label */}
            <div className="absolute top-4 left-4 rounded-xl bg-slate-900/90 px-3 py-1 text-xs font-black tracking-wider text-amber-300 shadow-md backdrop-blur-md">
              BEFORE · PRE-OP
            </div>
          </div>

          {/* Draggable Divider Handle */}
          <div
            className="absolute top-0 bottom-0 z-20 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)] cursor-ew-resize"
            style={{ left: `${sliderPos}%` }}
          >
            {/* Center Floating Puck */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#009da6] text-white shadow-xl hover:scale-110 active:scale-95 transition-transform">
              <div className="flex items-center gap-0.5">
                <ChevronLeft size={14} strokeWidth={3} />
                <ChevronRight size={14} strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>

        {/* Drag Instruction Banner */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-4 py-2 text-[11px] font-bold text-slate-400">
          <span>👈 Drag center slider to compare pre vs post-op smile</span>
          <span className="text-teal-400 font-mono font-black">{Math.round(sliderPos)}% Reveal</span>
        </div>
      </div>

      {/* Case Details Summary Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-850/60 text-xs">
        <div>
          <span className="text-[10.5px] font-bold uppercase text-slate-400">Treatment Plan</span>
          <p className="font-black text-slate-900 dark:text-white mt-0.5">{activePreset.title}</p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold uppercase text-slate-400">Teeth Involved</span>
          <p className="font-black text-[#009da6] dark:text-teal-300 mt-0.5">{activePreset.toothRange}</p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold uppercase text-slate-400">Pre-Op Shade</span>
          <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">{activePreset.shadeBefore}</p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold uppercase text-slate-400">Post-Op Result</span>
          <p className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activePreset.shadeAfter}</p>
        </div>
      </div>
    </div>
  );
}