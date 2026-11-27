import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  X,
  Send,
  HelpCircle,
  BookOpen,
  Pill,
  Zap,
  ArrowRight,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  UserPlus,
  Calendar,
  FileText,
  Clock,
  Layers,
  HeartPulse,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Smile
} from 'lucide-react';
import { useAuth } from '../../services/auth.jsx';

// ── Robot Mascot SVG Component ───────────────────────────────────────────────
function DentalRobotAvatar({ isListening = false, isSpeaking = false, size = 48, className = '' }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none transition-transform duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="robotBody" x1="10" y1="20" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00c0cb" />
            <stop offset="0.5" stopColor="#0a7f8b" />
            <stop offset="1" stopColor="#064349" />
          </linearGradient>
          <linearGradient id="robotEar" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#38e1ea" />
            <stop offset="1" stopColor="#02535a" />
          </linearGradient>
          <linearGradient id="toothGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#e2f7f9" />
            <stop offset="1" stopColor="#b6e7eb" />
          </linearGradient>
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Head Antenna */}
        <line x1="50" y1="24" x2="50" y2="10" stroke="#009da6" strokeWidth="4" strokeLinecap="round" />
        <circle
          cx="50"
          cy="8"
          r="6"
          fill={isListening ? '#ef4444' : '#22d3ee'}
          filter="url(#glowFilter)"
          className={isListening ? 'animate-ping' : ''}
        />
        <circle cx="50" cy="8" r="4" fill="#ffffff" />

        {/* Head Chassis */}
        <rect x="18" y="24" width="64" height="52" rx="22" fill="url(#robotBody)" stroke="#ffffff" strokeWidth="2.5" />

        {/* Ears */}
        <rect x="12" y="42" width="7" height="16" rx="3.5" fill="url(#robotEar)" stroke="#ffffff" strokeWidth="1.5" />
        <rect x="81" y="42" width="7" height="16" rx="3.5" fill="url(#robotEar)" stroke="#ffffff" strokeWidth="1.5" />

        {/* Digital Screen / Visor */}
        <rect x="25" y="32" width="50" height="34" rx="14" fill="#0b1728" stroke="#164e63" strokeWidth="2" />

        {/* Eyes (Expressive Blue/Cyan LED) */}
        {isListening ? (
          // Listening pulse wave
          <g fill="#22d3ee">
            <circle cx="38" cy="46" r="4" className="animate-bounce" />
            <circle cx="50" cy="46" r="4" className="animate-bounce delay-75" />
            <circle cx="62" cy="46" r="4" className="animate-bounce delay-150" />
          </g>
        ) : (
          // Friendly smiling eyes (^ ^)
          <g stroke="#22d3ee" strokeWidth="3" strokeLinecap="round">
            <path d="M34 49 C 36 43, 44 43, 46 49" />
            <path d="M54 49 C 56 43, 64 43, 66 49" />
          </g>
        )}

        {/* Cheerful Smile Mouth */}
        <path
          d="M44 57 Q 50 62 56 57"
          stroke={isSpeaking ? '#38bdf8' : '#22d3ee'}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Mascot Robot Hands holding a Sparkling Pearl Tooth */}
        <g transform="translate(37, 65)">
          {/* Pearl Tooth Mascot */}
          <path
            d="M5 2 C 7 -2, 19 -2, 21 2 C 24 6, 25 15, 23 23 C 21 29, 17 29, 15 22 C 14 18, 12 18, 11 22 C 9 29, 5 29, 3 23 C 1 15, 2 6, 5 2 Z"
            fill="url(#toothGrad)"
            stroke="#0a7f8b"
            strokeWidth="1.2"
          />
          {/* Sparkle Reflection on Tooth */}
          <circle cx="9" cy="6" r="1.5" fill="#ffffff" />
          <path d="M19 8 L 22 8 M 20.5 6.5 L 20.5 9.5" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
        </g>

        {/* Robot Hands Clamping Tooth */}
        <circle cx="34" cy="74" r="5" fill="#02535a" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="66" cy="74" r="5" fill="#02535a" stroke="#ffffff" strokeWidth="1.5" />
      </svg>

      {/* Speaking Soundwaves */}
      {isSpeaking && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 text-[8px] font-black text-white items-center justify-center">
            ♪
          </span>
        </span>
      )}
    </div>
  );
}

// ── Dental Intelligence Knowledge Base ──────────────────────────────────────
const DENTAL_KNOWLEDGE_BASE = [
  {
    triggers: ['fdi', 'tooth', 'teeth', 'chart', 'number', 'quadrant', 'permanent', 'deciduous', 'primary'],
    title: '🦷 FDI Two-Digit Tooth Notation System',
    response: `Standard FDI Tooth Numbering Cheat Sheet:

• **Permanent Teeth (Adult 11-48)**:
  - Upper Right (Q1): 18, 17, 16, 15, 14, 13, 12, 11 (Central Incisor)
  - Upper Left (Q2): 21 (Central Incisor), 22, 23, 24, 25, 26, 27, 28
  - Lower Left (Q3): 31 (Central Incisor), 32, 33, 34, 35, 36, 37, 38
  - Lower Right (Q4): 48, 47, 46, 45, 44, 43, 42, 41 (Central Incisor)

• **Primary Teeth (Deciduous 51-85)**:
  - Upper Right (Q5): 55, 54, 53, 52, 51
  - Upper Left (Q6): 61, 62, 63, 64, 65
  - Lower Left (Q7): 71, 72, 73, 74, 75
  - Lower Right (Q8): 85, 84, 83, 82, 81

💡 *Tip: In ZhanX DentalCare, click 'Dental Chart' on any patient file to visually tap individual surfaces (Mesial, Occlusal, Distal, Buccal, Lingual)!*`,
    action: { label: 'Open Dental Chart', path: '/dental-chart' }
  },
  {
    triggers: ['dosage', 'antibiotic', 'medicine', 'prescription', 'amoxicillin', 'metrogyl', 'painkiller', 'pain', 'ibuprofen', 'paracetamol', 'rx'],
    title: '💊 Dental Pharmacology & Standard Dosages',
    response: `Standard Dental Drug Regimens (Adults):

1. **Amoxicillin 500mg**:
   - Dose: 1 capsule TID (8-hourly) for 5 days with food.
   - For Penicillin-allergic patients: Clindamycin 300mg TID or Azithromycin 500mg OD for 3 days.

2. **Augmentin (Amoxicillin 500mg + Clavulanic Acid 125mg)**:
   - Dose: 1 tablet BD (12-hourly) for 5 days. Indicated for severe acute odontogenic infections.

3. **Metronidazole (Metrogyl) 400mg**:
   - Dose: 1 tablet TID for 5 days. For anaerobic periapical & periodontal infections. (Strictly avoid alcohol).

4. **Analgesic / Pain Relief**:
   - Mild/Moderate: Paracetamol 650mg QDS PRN or Ibuprofen 400mg TDS after meals.
   - Severe Pain: Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg (Zerodol-SP) BD for 3 days.

⚠️ *Safety Reminder: Always verify patient's allergy history and renal/gastric ulcer status before prescribing!*`,
    action: { label: 'Write Digital Rx', path: '/prescriptions' }
  },
  {
    triggers: ['post-op', 'extraction', 'aftercare', 'instructions', 'care', 'bleeding', 'socket'],
    title: '📋 Post-Operative Extraction Care Guidelines',
    response: `Standard Instructions to give patient after Dental Extraction:

1. **Firm Bite on Gauze**: Keep cotton/gauze pressed firmly for 45 to 60 minutes.
2. **Do Not Spit**: Swallow saliva normally. Spitting creates negative pressure and dislodges the blood clot, risking dry socket.
3. **No Straws or Smoking**: Avoid drinking with straws and no smoking/vaping for at least 72 hours.
4. **Cold & Soft Diet**: Eat lukewarm or cold, soft foods (ice cream, curd rice, soup) on the opposite side.
5. **Warm Salt Water Gargle**: Start gentle warm saline rinses ONLY after 24 hours (3-4 times a day).
6. **Ice Pack Application**: Apply ice pack intermittently (15 mins on, 15 mins off) externally on cheek for the first 6 hours to reduce swelling.`,
    action: { label: 'View OPD Queue', path: '/queue' }
  },
  {
    triggers: ['invoice', 'billing', 'bill', 'payment', 'upi', 'cash', 'money', 'discount'],
    title: '🧾 Billing & Invoicing Workflow in ZhanX',
    response: `How to generate a patient bill and collect payment:

1. Navigate to **Billing & Invoices** or click the quick action below.
2. Click **+ New Invoice** and select the patient.
3. Add procedure line items (e.g. Scaling ₹1,500, Composite Restoration ₹1,200).
4. Apply discount or coupon if authorized.
5. Click **Finalize Invoice**.
6. Click **Collect Payment** -> choose Cash, UPI, or Card.
7. Print standard thermal 3-inch slip or full A4 GST dental invoice with one click!`,
    action: { label: 'Create Invoice', path: '/invoices/new' }
  },
  {
    triggers: ['appointment', 'book', 'schedule', 'reschedule', 'slot', 'calendar'],
    title: '📅 Appointment Scheduling & Queue Management',
    response: `Managing Patient Appointments:

1. Go to **Appointments** to see today's visual doctor schedule.
2. Click on any free time slot or click **+ New Appointment**.
3. Choose the Dentist, Patient, and Procedure category (Consultation, RCT, Ortho adjustment, Surgery).
4. The patient automatically receives an instant SMS/WhatsApp confirmation.
5. When the patient arrives at the clinic, mark their status as **Checked In / In Waiting** to move them into the live Doctor Queue!`,
    action: { label: 'View Appointment Calendar', path: '/appointments' }
  },
  {
    triggers: ['emergency', 'avulsion', 'knocked', 'trauma', 'bleeding'],
    title: '🚨 Dental Emergency: Avulsed Tooth Protocol',
    response: `Protocol for Avulsed (Knocked Out) Permanent Tooth:

1. **Handle by Crown Only**: Never touch the root surfaces.
2. **Gently Rinse**: If dirty, rinse gently under cold water for 10 seconds. Do NOT scrub.
3. **Transport Medium**:
   - Best: Patient's vestibule (saliva) or cold fresh milk or Hank's Balanced Salt Solution (HBSS).
   - If conscious and cooperative: Re-insert into socket immediately.
4. **Golden Hour**: Re-implantation within 60 minutes yields the highest periodontal ligament survival rate.
5. **Splinting**: Flexible splint for 7–14 days. Administer Tetanus booster if contaminated with soil.`,
    action: { label: 'Register Emergency Patient', path: '/patients/new' }
  }
];

const QUICK_ACTIONS = [
  { title: 'New Patient', icon: UserPlus, path: '/patients/new', color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300' },
  { title: 'Book Appointment', icon: Calendar, path: '/appointments', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300' },
  { title: 'Live OPD Queue', icon: Clock, path: '/queue', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300' },
  { title: 'Create Bill', icon: FileText, path: '/invoices/new', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { title: 'Dental Charting', icon: Layers, path: '/dental-chart', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300' },
  { title: 'Prescriptions (Rx)', icon: Pill, path: '/prescriptions', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300' }
];

const WALKTHROUGH_GUIDES = [
  {
    id: 'patient-flow',
    title: '1. Complete Patient Lifecycle (Walk-in to Departure)',
    steps: [
      'Register patient via "+ New Patient" (Mobile, Name, Medical History).',
      'Check patient into Live Queue from Appointments or Queue tab.',
      'Doctor opens Consultation, checks FDI chart, and enters Diagnosis.',
      'Add Treatment Plan procedures & prescribe Digital Rx.',
      'Receptionist opens Invoices, finalizes procedure charges & collects UPI/Cash.',
      'Print receipt and schedule follow-up recall date.'
    ]
  },
  {
    id: 'fdi-guide',
    title: '2. FDI Dental Charting & Periodontal Scoring',
    steps: [
      'Open patient file and click the "Dental Chart" tab.',
      'Select permanent (32 teeth) or deciduous (20 teeth) chart view.',
      'Click any tooth surface (O, M, D, B, L) to mark Caries or Restoration.',
      'Tag conditions: Root Canal (RCT), Missing, Impacted, Crown, or Implant.',
      'Add Gingival Index / Periodontal pocket depth measurements.',
      'Click Save to store in patient historical timeline.'
    ]
  },
  {
    id: 'billing-guide',
    title: '3. GST Invoicing, Discounts & Split Payments',
    steps: [
      'Go to Invoices -> "+ New Invoice".',
      'Select patient and import items from completed Treatment Plan.',
      'Enter custom item or procedure fee if needed.',
      'Apply flat or percentage doctor discount if authorized.',
      'Click Finalize. Collect full or partial payment with transaction reference.',
      'Download or print A4 GST Invoice / Thermal 3-inch slip.'
    ]
  }
];

export default function ZhaDentalAiBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'shortcuts' | 'guides' | 'dosages'
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Vanakkam Doctor! I'm **Dr. Zha**, your AI Robotic Dental Companion & Guide. You can type or tap the microphone to speak with me anytime!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Proactive Chatty Companion States
  const [bubbleText, setBubbleText] = useState('Hi doctor! Dr. Zha is ready to assist your clinic ✨');
  const [bubbleIndex, setBubbleIndex] = useState(0);

  // Voice Interaction States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('zhanx_bot_voice_enabled') === 'true';
  });

  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedGuide, setExpandedGuide] = useState('patient-flow');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Proactive Chatty Robot Bubbles: Rotating Live Commentary ───────────────
  const PROACTIVE_BUBBLES = [
    `Vanakkam ${user?.fullName ? user.fullName.split(' ')[0] : 'Doctor'}! All chairs prepped & ready 🦷`,
    'Need quick FDI tooth numbering notation? Click me! ⚡',
    'Tip: Always review penicillin allergies before finalizing digital Rx 💊',
    'Click the mic button to ask me anything with your voice! 🎙️',
    '0 waiting in queue? Great time to review scheduled treatment plans 🩺',
    'Post-op care instructions for extraction & RCT ready to WhatsApp in 1 click! 📋',
    'Need to split an invoice payment between Cash & UPI? I can guide you! 🧾'
  ];

  // Rotate proactive bubbles every 10 seconds smoothly
  useEffect(() => {
    if (isOpen) return;
    const interval = setInterval(() => {
      setBubbleIndex((prev) => (prev + 1) % PROACTIVE_BUBBLES.length);
    }, 10_000);
    return () => clearInterval(interval);
  }, [isOpen, PROACTIVE_BUBBLES.length]);

  useEffect(() => {
    if (!isOpen) {
      setBubbleText(PROACTIVE_BUBBLES[bubbleIndex] || 'Dr. Zha is on duty!');
    }
  }, [bubbleIndex, isOpen]);

  // Context-aware speech bubbles on route navigation
  useEffect(() => {
    const path = location.pathname;
    let tip = null;
    if (path.includes('/patients')) {
      tip = 'Looking for patient dental history or photos? Ask me!';
    } else if (path.includes('/appointments')) {
      tip = 'Tip: Click any free calendar slot to book an instant consultation!';
    } else if (path.includes('/invoices') || path.includes('/payments')) {
      tip = 'Need help applying doctor discounts or thermal receipts?';
    } else if (path.includes('/prescriptions')) {
      tip = 'Ask me for adult or pediatric antibiotic dosages!';
    } else if (path.includes('/dental-chart')) {
      tip = 'Tap individual surfaces on the chart to record Caries or Crown!';
    }
    if (tip) {
      setBubbleText(tip);
    }
  }, [location.pathname]);

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // ── Speech Synthesis (Bot Voice Output) ────────────────────────────────────
  const speakText = useCallback(
    (textToSpeak) => {
      if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

      window.speechSynthesis.cancel(); // cancel any active utterance
      // Strip markdown symbols for clean speech
      const cleanText = textToSpeak
        .replace(/[*#_~`•]/g, ' ')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\n+/g, '. ')
        .slice(0, 300); // limit length for pleasant brevity

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.08; // friendly slightly cheerful pitch

      // Try selecting an English Indian or natural voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.includes('en-IN') || v.name.includes('India') || v.name.includes('Natural')
      );
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

  const toggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    localStorage.setItem('zhanx_bot_voice_enabled', String(nextVal));
    if (!nextVal && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // ── Speech Recognition (Doctor Voice Input) ────────────────────────────────
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  // ── Send Message & AI Knowledge Retrieval ─────────────────────────────────
  const handleSendMessage = (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    setTimeout(() => {
      const lower = text.toLowerCase();
      let match = DENTAL_KNOWLEDGE_BASE.find((item) =>
        item.triggers.some((trig) => lower.includes(trig))
      );

      let botResponse = '';
      let botAction = null;

      if (match) {
        botResponse = match.response;
        botAction = match.action;
      } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('vanakkam')) {
        botResponse = `Vanakkam Doctor! How can I assist you right now? You can ask me about:
• FDI tooth numbering notation
• Standard drug dosages (Amoxicillin, Augmentin, Zerodol-SP)
• Post-op care instructions for extraction or RCT
• Invoicing, GST bills & queue triage workflows!`;
      } else {
        botResponse = `I understand you're inquiring about "${text}".

Here are the fastest clinical tools you can use:
1. **FDI Dental Chart**: For marking restorations, crowns, endo, and missing teeth.
2. **Digital Prescription**: Automatically checks drug safety & patient allergy history.
3. **Billing & Invoices**: Generate GST invoices and collect UPI/Cash receipts.

Would you like a step-by-step walkthrough or clinical dosage reference?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botResponse,
          action: botAction,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);

      // Speak response if voice is enabled
      speakText(botResponse);
    }, 400);
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end select-none pointer-events-auto">
      {/* ── Chatty Companion Proactive Speech Bubble ── */}
      {!isOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsOpen(true);
          }}
          className="group relative mb-2.5 max-w-[280px] cursor-pointer rounded-2xl border border-teal-300/80 bg-white/95 p-3 text-xs font-semibold text-slate-800 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-[#009da6] dark:border-teal-700/80 dark:bg-slate-900/95 dark:text-slate-100"
        >
          {/* Subtle Speech Bubble Tail */}
          <div className="absolute -bottom-2 right-6 h-3 w-3 rotate-45 border-r border-b border-teal-300/80 bg-white dark:border-teal-700/80 dark:bg-slate-900" />

          <div className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-xs dark:bg-teal-950/80">
              ✨
            </span>
            <div className="space-y-1">
              <p className="leading-snug text-[11.5px] font-bold text-slate-800 dark:text-slate-100">
                {bubbleText}
              </p>
              <div className="flex items-center justify-between text-[10px] font-black text-[#009da6] dark:text-teal-400">
                <span>Dr. Zha Dental AI</span>
                <span className="group-hover:translate-x-0.5 transition-transform">Tap to Chat ➜</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Bot Modal (Properly constrained within viewport) ── */}
      {isOpen && (
        <div className="fixed bottom-22 right-4 sm:right-6 z-50 flex h-[min(560px,calc(100vh-110px))] w-[min(410px,calc(100vw-32px))] flex-col rounded-3xl border border-teal-200/90 bg-white shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header Bar */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#04616b] px-4 py-3 text-white shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                <DentalRobotAvatar isListening={isListening} isSpeaking={isSpeaking} size={36} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#009da6] bg-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-wide">Dr. Zha</h3>
                  <span className="rounded-md bg-white/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                    Robotic AI Companion
                  </span>
                </div>
                <p className="text-[10.5px] text-teal-100 font-medium">Smart Clinical &amp; Voice Guide</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Voice Output Speaker Toggle */}
              <button
                type="button"
                onClick={toggleVoice}
                title={voiceEnabled ? 'Mute AI Voice' : 'Enable AI Voice Response'}
                className={`rounded-lg p-1.5 transition cursor-pointer ${
                  voiceEnabled ? 'bg-white/25 text-white' : 'text-teal-200 hover:bg-white/15'
                }`}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Reset Conversation */}
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      id: 'welcome-reset',
                      sender: 'bot',
                      text: "Vanakkam! I'm **Dr. Zha**. How can I help your dental practice right now?",
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ]);
                }}
                title="Reset Chat"
                className="rounded-lg p-1.5 text-teal-200 hover:bg-white/15 transition cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize Dr. Zha"
                className="rounded-lg p-1.5 text-teal-200 hover:bg-white/15 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 pt-1 text-xs font-bold dark:border-slate-800 dark:bg-slate-850 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'chat'
                  ? 'border-[#009da6] text-[#009da6] dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              💬 AI Voice &amp; Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shortcuts')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'border-[#009da6] text-[#009da6] dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              ⚡ Fast 1-Click
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guides')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'guides'
                  ? 'border-[#009da6] text-[#009da6] dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              🧭 Guides
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dosages')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'dosages'
                  ? 'border-[#009da6] text-[#009da6] dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              💊 Rx &amp; Care
            </button>
          </div>

          {/* Tab 1: AI Chat & Voice */}
          {activeTab === 'chat' && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/60">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs leading-relaxed whitespace-pre-wrap ${
                        m.sender === 'user'
                          ? 'bg-gradient-to-r from-[#009da6] to-[#0a7f8b] text-white rounded-br-xs'
                          : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100'
                      }`}
                    >
                      {m.text}

                      {/* Action Deep Link */}
                      {m.action && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => {
                              navigate(m.action.path);
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-[11px] font-black text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:bg-teal-950/80 dark:text-teal-300"
                          >
                            <span>{m.action.label}</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[9.5px] font-semibold text-slate-400 px-1">
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                    <DentalRobotAvatar isSpeaking={true} size={20} />
                    <span className="font-semibold text-teal-600 dark:text-teal-300">
                      Dr. Zha is thinking…
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-white/70 border-t border-slate-100 dark:bg-slate-850 dark:border-slate-800 no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendMessage('FDI tooth chart numbering')}
                  className="shrink-0 rounded-full border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[10.5px] font-bold text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                >
                  🦷 FDI Cheat Sheet
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Antibiotic dosages for dental infections')}
                  className="shrink-0 rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[10.5px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  💊 Drug Dosages
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Post-op extraction care instructions')}
                  className="shrink-0 rounded-full border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-[10.5px] font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                >
                  📋 Post-Op Care
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('How to create an invoice and collect payment')}
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  🧾 Billing Guide
                </button>
              </div>

              {/* Message Input & Voice Controls */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-1.5 border-t border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shrink-0"
              >
                {/* Voice Speech-to-Text Microphone Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Stop Listening' : 'Speak with Dr. Zha'}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition cursor-pointer ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                      : 'bg-teal-50 text-[#009da6] hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? 'Listening… speak now' : 'Ask Dr. Zha or tap mic to speak…'}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:border-[#009da6] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#009da6] text-white hover:bg-[#0a7f8b] disabled:opacity-50 transition cursor-pointer"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Fast 1-Click Action Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/60">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Instant Workstation Shortcuts
                </h4>
                <p className="text-[11px] text-slate-500">
                  Fast 1-click access to all core clinic tools.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((qa) => {
                  const Icon = qa.icon;
                  return (
                    <button
                      key={qa.title}
                      type="button"
                      onClick={() => {
                        navigate(qa.path);
                        setIsOpen(false);
                      }}
                      className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-[#009da6] hover:shadow-md transition cursor-pointer dark:bg-slate-800 dark:border-slate-700 text-left"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${qa.color}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">{qa.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Jump to action ➜</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-500/10 to-transparent p-3.5 text-xs dark:border-teal-900/50">
                <div className="flex items-center gap-2 font-bold text-[#009da6] dark:text-teal-300">
                  <Sparkles size={16} />
                  <span>Pro Tip for Indian Clinics</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Use the <strong>Live OPD Queue</strong> during evening rush. Front desk can check patients in, and doctors can view waiting times with live status transitions!
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: Walkthrough Guides */}
          {activeTab === 'guides' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/60">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Interactive Clinical Procedures
                </h4>
                <p className="text-[11px] text-slate-500">
                  Step-by-step guidance for clinic staff.
                </p>
              </div>

              <div className="space-y-2.5">
                {WALKTHROUGH_GUIDES.map((g) => {
                  const isExp = expandedGuide === g.id;
                  return (
                    <div
                      key={g.id}
                      className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs dark:bg-slate-800 dark:border-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedGuide(isExp ? '' : g.id)}
                        className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
                      >
                        <span>{g.title}</span>
                        {isExp ? <ChevronUp size={16} className="text-[#009da6]" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>

                      {isExp && (
                        <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850/50 text-[11px] space-y-2">
                          <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                            {g.steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 4: Pharmacology & Patient Care Library */}
          {activeTab === 'dosages' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/60 text-xs">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Post-Op WhatsApp Instructions
                </h4>
                <p className="text-[11px] text-slate-500">
                  1-click copy post-operative care instructions to send to patients via WhatsApp.
                </p>
              </div>

              {/* Extraction Care */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:bg-slate-800 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    🦷 Post-Extraction Instructions
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `*Post-Dental Extraction Care Instructions:*\n1. Keep gauze pressed firmly for 45 mins.\n2. Do NOT spit or rinse vigorously for 24 hours.\n3. Avoid straws, hot drinks, and smoking.\n4. Take prescribed medications on time after food.\n5. Warm salt water rinses after 24 hours.\nIn case of excessive bleeding, contact our clinic immediately.`,
                        1
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-[10.5px] font-bold text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:bg-teal-950/80 dark:text-teal-300"
                  >
                    {copiedIndex === 1 ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedIndex === 1 ? 'Copied!' : 'Copy for WhatsApp'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-300 leading-relaxed">
                  Gauze pressure for 45 mins · No spitting or straws · Cold soft diet · Warm salt water gargle after 24 hrs.
                </p>
              </div>

              {/* RCT Care */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:bg-slate-800 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    ⚡ Post-Root Canal (RCT) Care
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `*Post-Root Canal Treatment (RCT) Care:*\n1. Avoid chewing on the treated tooth until permanent crown/restoration is placed.\n2. Mild soreness for 2-3 days is normal; take painkillers as prescribed.\n3. Brush gently around the temporary filling.\n4. If temporary filling chips or falls out, visit clinic for replacement.`,
                        2
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-[10.5px] font-bold text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:bg-teal-950/80 dark:text-teal-300"
                  >
                    {copiedIndex === 2 ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedIndex === 2 ? 'Copied!' : 'Copy for WhatsApp'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-300 leading-relaxed">
                  Avoid chewing hard foods on treated tooth until permanent crown is placed · Mild soreness normal for 48 hrs.
                </p>
              </div>

              {/* Scaling Care */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:bg-slate-800 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    ✨ Post-Scaling &amp; Polishing Care
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `*Post-Scaling & Polishing Instructions:*\n1. Mild sensitivity to hot/cold for 1-2 days is common and temporary.\n2. Use a desensitizing toothpaste if sensitivity occurs.\n3. Avoid staining foods (strong tea, coffee, turmeric) for 24 hours.\n4. Floss daily and brush twice daily with soft bristles.`,
                        3
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-[10.5px] font-bold text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:bg-teal-950/80 dark:text-teal-300"
                  >
                    {copiedIndex === 3 ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedIndex === 3 ? 'Copied!' : 'Copy for WhatsApp'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-300 leading-relaxed">
                  Mild temporary sensitivity · Avoid staining drinks for 24 hrs · Floss daily.
                </p>
              </div>
            </div>
          )}

          {/* Footer Status Bar */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10.5px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400 shrink-0">
            <span>ZhanX Robotic Dental AI · v2.8</span>
            <span className="flex items-center gap-1 text-[#009da6] dark:text-teal-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Voice &amp; Neural Active
            </span>
          </div>
        </div>
      )}

      {/* ── Floating Robot Pet Dock Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Dr. Zha Dental Robot AI Assistant"
        className="group relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-[#009da6] via-[#0a7f8b] to-[#044c54] shadow-2xl shadow-teal-500/35 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-white/70 dark:border-slate-700"
      >
        {/* Subtle breathing ambient aura */}
        <span className="absolute -inset-1 rounded-3xl bg-cyan-400/20 blur-md group-hover:bg-cyan-400/35 transition duration-500" />

        {/* Robot Mascot SVG */}
        <DentalRobotAvatar isListening={isListening} isSpeaking={isSpeaking} size={50} />

        {/* "AI" Pill Badge */}
        <span className="absolute -top-1.5 -right-1.5 flex h-5 px-1.5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-[9.5px] font-black text-white shadow-md border border-white/80">
          AI
        </span>
      </button>
    </div>
  );
}
