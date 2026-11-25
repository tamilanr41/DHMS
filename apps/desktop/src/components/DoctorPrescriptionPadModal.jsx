import { useEffect, useRef, useState } from 'react';
import {
  Pencil, Eraser, RotateCcw, Trash2, Printer, Download, Save,
  X, Check, AlertTriangle, Pill, Sparkles, ShieldCheck
} from 'lucide-react';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import { formatDate, todayISO } from '../utils/format.js';

const INK_COLORS = [
  { id: 'blue', label: 'Medical Blue', value: '#1d4ed8', ring: 'ring-blue-600' },
  { id: 'black', label: 'Midnight Black', value: '#0f172a', ring: 'ring-slate-900' },
  { id: 'red', label: 'Alert Red', value: '#dc2626', ring: 'ring-red-600' },
  { id: 'green', label: 'Clinical Green', value: '#15803d', ring: 'ring-emerald-600' }
];

const PEN_WIDTHS = [
  { id: 'fine', label: 'Fine', value: 1.8 },
  { id: 'normal', label: 'Normal', value: 3.0 },
  { id: 'bold', label: 'Bold', value: 5.0 }
];

const QUICK_RX_TEMPLATES = [
  {
    name: 'Extraction / Post-Op Pain',
    text: '1. Tab. Zerodol-P (Aceclofenac + Paracetamol) 1 tab BID x 3 days (after food)\n2. Cap. Amoxicillin 500mg 1 cap TID x 5 days\n3. Tab. Pan-40 1 tab OD before breakfast x 5 days\n4. Warm salt water rinse after 24 hours.'
  },
  {
    name: 'Acute Dental Abscess',
    text: '1. Tab. Augmentin 625mg 1 tab BID x 5 days (after food)\n2. Tab. Metrogyl 400mg 1 tab TID x 5 days\n3. Tab. Zerodol-SP 1 tab BID x 3 days\n4. Tab. Pan-40 1 tab OD x 5 days'
  },
  {
    name: 'Gingivitis & Scaling Care',
    text: '1. Hexidine 0.2% mouthwash 10ml rinse BID x 14 days\n2. Tab. Limcee 500mg chewable 1 tab OD x 15 days\n3. Gentle soft brushing technique instructed.'
  },
  {
    name: 'Oral Ulcer Relief',
    text: '1. Kenalog / Dologel CT paste apply TID on ulcers before meals x 5 days\n2. Cap. Becosules-Z 1 cap OD x 15 days'
  }
];

export default function DoctorPrescriptionPadModal({
  isOpen,
  onClose,
  patient,
  dentistName = 'Dr. Sarah Jenkins',
  dentistRegNo = 'TN-DENT-2024-8841',
  dentistDegree = 'BDS, MDS (Oral & Maxillofacial Surgery)',
  onSavePrescription,
  initialNotes = ''
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [color, setColor] = useState(INK_COLORS[0].value);
  const [width, setWidth] = useState(PEN_WIDTHS[1].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeHistory, setStrokeHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [printedDate] = useState(todayISO());
  const [rxNotes, setRxNotes] = useState(initialNotes);
  const [followUpDays, setFollowUpDays] = useState('5');
  const [showTemplates, setShowTemplates] = useState(false);

  // Set up canvas sizing for high-DPI (iPad Retina / 4K touchscreens)
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Save blank canvas state in history
    saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setStrokeHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      return [...next, dataUrl];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    const targetData = strokeHistory[nextIdx];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = targetData;
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
      setHistoryIndex(nextIdx);
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    saveState();
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoords(e);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = width * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
    }

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
    saveState();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const handwritingPng = canvas ? canvas.toDataURL('image/png') : null;
    if (onSavePrescription) {
      onSavePrescription({
        notes: rxNotes,
        handwritingData: handwritingPng,
        followUpDays
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/75 p-2 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative flex max-h-[96vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Top Control Bar */}
        <header className="flex flex-wrap items-center justify-between border-b border-slate-700/80 bg-slate-950/80 px-4 py-3 text-white rounded-t-3xl gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-md">
              <Pencil size={18} />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Doctor Stylus Prescription Pad</h2>
              <p className="text-[11px] text-slate-400">Authentic clinic letterhead with tablet pen handwriting</p>
            </div>
          </div>

          {/* Pen / Stylus Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Ink Colors */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2 py-1">
              {INK_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => { setColor(c.value); setTool('pen'); }}
                  className={`h-6 w-6 rounded-full transition-transform hover:scale-110 cursor-pointer ${
                    color === c.value && tool === 'pen' ? `ring-2 ring-white scale-110 ${c.ring}` : 'opacity-80'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 p-0.5">
              {PEN_WIDTHS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWidth(w.value)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    width === w.value ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {/* Tools (Pen / Eraser / Undo / Clear) */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setTool('pen')}
                title="Pen Mode"
                className={`flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer ${
                  tool === 'pen' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                title="Eraser"
                className={`flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer ${
                  tool === 'eraser' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eraser size={14} />
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={historyIndex <= 0}
                title="Undo last stroke"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                title="Clear all handwriting"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-950 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <Button
              size="sm"
              variant="subtle"
              icon={Sparkles}
              className="text-white bg-slate-800 border-slate-700 hover:bg-slate-700"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              Rx Chips
            </Button>

            <Button size="sm" variant="secondary" icon={Printer} onClick={handlePrint} className="bg-slate-800 text-white border-slate-700">
              Print
            </Button>
            <Button size="sm" variant="primary" icon={Save} onClick={handleSave}>
              Save Prescription
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Quick Dental Rx Templates Bar (Collapsible) */}
        {showTemplates && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/60 bg-slate-950/60 px-4 py-2 text-xs">
            <span className="font-semibold text-slate-400">1-Click Prescriptions:</span>
            {QUICK_RX_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setRxNotes((prev) => (prev ? `${prev}\n\n${t.text}` : t.text))}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-accent hover:text-white transition cursor-pointer"
              >
                + {t.name}
              </button>
            ))}
          </div>
        )}

        {/* The Printable Medical Prescription Stationery Pad */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-900/60 flex justify-center">
          <div
            id="prescription-print-sheet"
            ref={containerRef}
            className="relative flex flex-col justify-between w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-xl text-slate-800 min-h-[750px]"
          >
            {/* Authentic Clinic Header */}
            <div>
              <div className="flex items-start justify-between border-b-2 border-navy-900 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white font-black text-xl shadow-md">
                    ZX
                  </div>
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-navy-950">
                      ZhanX Dental Care &amp; Speciality Clinic
                    </h1>
                    <p className="text-[11.5px] font-semibold text-slate-600">
                      Center for Advanced Oral Surgery, Implantology &amp; Aesthetic Dentistry
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">
                      Reg. No: <strong className="text-navy-900">{dentistRegNo}</strong> · NABH Accredited Dental Practice
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-600 leading-tight">
                  <p className="font-bold text-navy-950">{dentistName}</p>
                  <p className="text-[10px] text-slate-500">{dentistDegree}</p>
                  <p className="mt-1 font-mono text-[10px]">📞 +91 98400 12345 / 044-28114400</p>
                  <p className="text-[9.5px] text-slate-400">124, Cathedral Road, Chennai - 600086</p>
                </div>
              </div>

              {/* Patient Identification Banner */}
              <div className="mt-3 flex flex-wrap items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs border border-slate-200">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Patient Name:</span>
                    <p className="font-bold text-navy-900 text-[13px]">{patient?.fullName || 'Walk-in Consultation'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">UHID / File:</span>
                    <p className="font-mono font-semibold text-slate-700">{patient?.patientNo || 'P-NEW'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Age / Gender:</span>
                    <p className="font-semibold text-slate-700">{patient?.age ? `${patient.age} yrs` : '—'} · {patient?.gender || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {patient?.allergies && (
                    <div className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 border border-rose-200 font-bold text-[10.5px]">
                      ⚠️ Allergy: {patient.allergies}
                    </div>
                  )}
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Date:</span>
                    <p className="font-semibold font-mono text-slate-800">{formatDate(printedDate)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prescription Body with ℞ Watermark & Tablet Canvas */}
            <div className="relative my-4 flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/30 overflow-hidden min-h-[380px]">
              {/* Huge Classic ℞ Watermark */}
              <div className="pointer-events-none absolute left-6 top-4 select-none text-7xl font-serif font-black text-slate-200/50">
                ℞
              </div>

              {/* Structured text notes (if any) */}
              {rxNotes && (
                <div className="p-5 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-none">
                  {rxNotes}
                </div>
              )}

              {/* Touch & Stylus Canvas */}
              <canvas
                ref={canvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                style={{ touchAction: 'none' }}
              />

              {/* Stylus Guidance Overlay Hint */}
              {strokeHistory.length <= 1 && !rxNotes && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Pencil size={24} className="mb-2 text-slate-300 animate-bounce" />
                  <p className="font-semibold text-slate-500">Stylus / Finger Handwriting Active</p>
                  <p className="text-[11px] text-slate-400">Write freely with your tablet stylus, Apple Pencil, or mouse</p>
                </div>
              )}
            </div>

            {/* Authentic Clinical Footer & Signature */}
            <div className="border-t-2 border-slate-200 pt-3 text-[11px]">
              <div className="flex items-end justify-between">
                <div className="max-w-md space-y-1 text-[10px] text-slate-500">
                  <p className="font-semibold text-slate-700">Clinical Advice &amp; Warnings:</p>
                  <p>• Take full course of antibiotics as prescribed. Do not stop midway.</p>
                  <p>• Avoid hard, crunchy or very hot food for 24 hours following procedure.</p>
                  <p>• In case of severe pain, bleeding, or rash, contact clinic emergency immediately.</p>
                  <p className="font-mono text-slate-400">Next Review: Within {followUpDays} days</p>
                </div>

                <div className="text-center min-w-[160px]">
                  <div className="h-10 flex items-end justify-center">
                    <span className="font-serif italic font-bold text-navy-900 text-sm">
                      {dentistName.split(' ')[1] || dentistName}
                    </span>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="font-bold text-navy-950 text-xs">{dentistName}</p>
                    <p className="text-[9.5px] text-slate-500">Authorized Signature &amp; Stamp</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-1.5">
                <span>ZHANX-RX-DIGITAL-SIGN · AUTHENTIC ELECTRONIC DENTAL RECORD</span>
                <span>VALID FOR PHARMACY DISPENSING</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
