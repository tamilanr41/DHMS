import { useState, useEffect, useRef } from 'react';
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
  ExternalLink
} from 'lucide-react';

// Clinical & Dental Knowledge Base for Instant Intelligent Offline/Online Responses
const DENTAL_KNOWLEDGE_BASE = [
  {
    triggers: ['fdi', 'tooth', 'teeth', 'chart', 'number', 'quadrant', 'permanent', 'deciduous', 'primary'],
    title: '🦷 FDI Two-Digit Tooth Notation System',
    response: `Here is the standard FDI Tooth Numbering Cheat Sheet:

• **Permanent Teeth (Adult)**:
  - Upper Right (Q1): 18, 17, 16, 15, 14, 13, 12, 11 (Central Incisor)
  - Upper Left (Q2): 21 (Central Incisor), 22, 23, 24, 25, 26, 27, 28
  - Lower Left (Q3): 31 (Central Incisor), 32, 33, 34, 35, 36, 37, 38
  - Lower Right (Q4): 48, 47, 46, 45, 44, 43, 42, 41 (Central Incisor)

• **Primary Teeth (Deciduous/Pediatric)**:
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'guides' | 'dosages' | 'shortcuts'
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Vanakkam! I'm **Dr. Zha**, your AI Dental Clinical & Practice Guide. Ask me about tooth charting, drug dosages, post-op instructions, or clinic workflows!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [bubbleText, setBubbleText] = useState('Hi doctor! Click me for dental guides & shortcuts 🦷✨');
  const [showBubble, setShowBubble] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedGuide, setExpandedGuide] = useState('patient-flow');

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Context-aware proactive bubble tip on route change
  useEffect(() => {
    const path = location.pathname;
    let tip = 'Hi doctor! Click me for dental guides & shortcuts 🦷✨';
    if (path.includes('/patients')) {
      tip = 'Need help with patient records or medical history? Ask Dr. Zha!';
    } else if (path.includes('/appointments')) {
      tip = 'Tip: Drag or click any free slot to book an instant appointment!';
    } else if (path.includes('/invoices') || path.includes('/payments')) {
      tip = 'Need help splitting UPI/Cash or applying procedure discounts?';
    } else if (path.includes('/prescriptions')) {
      tip = 'Ask me for adult or pediatric antibiotic dosages anytime!';
    } else if (path.includes('/dental-chart')) {
      tip = 'FDI charting cheat sheet available right here in 1 click!';
    }
    setBubbleText(tip);
    setShowBubble(true);
    const timer = setTimeout(() => setShowBubble(false), 9000);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

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
      // Find knowledge base match
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
        botResponse = `Vanakkam Doctor! How can I assist your dental practice right now? You can ask me about:
• FDI tooth numbering (e.g. "What is tooth 46?")
• Drug dosages (e.g. "Amoxicillin dose for adult")
• Post-op care instructions for extraction or RCT
• How to bill an invoice or create a treatment plan`;
      } else {
        botResponse = `I understand you're inquiring about "${text}".

Here are the most helpful clinical & practice tools you can use:
1. **FDI Dental Chart**: For marking restorations, crowns, endo, and missing teeth.
2. **Digital Prescription**: Automatically checks medication interactions & allergies.
3. **Billing & Invoices**: Generate GST invoices and collect UPI/Cash receipts.

Would you like a step-by-step walkthrough or clinical quick dosage reference?`;
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
    }, 450);
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end select-none">
      {/* Proactive Floating Speech Bubble */}
      {showBubble && !isOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setIsOpen(true);
            setShowBubble(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsOpen(true);
              setShowBubble(false);
            }
          }}
          className="mb-2.5 max-w-[240px] cursor-pointer animate-bounce rounded-2xl border border-teal-200/90 bg-white/95 p-3 text-xs font-semibold text-slate-800 shadow-xl backdrop-blur-md transition hover:scale-105 dark:border-teal-800 dark:bg-slate-900/95 dark:text-slate-100"
        >
          <div className="flex items-start gap-2">
            <span className="text-base">🦷</span>
            <p className="leading-snug">{bubbleText}</p>
          </div>
          <div className="mt-1 text-[10px] font-bold text-[#009da6] text-right">Click Dr. Zha ➜</div>
        </div>
      )}

      {/* Main Bot Window */}
      {isOpen && (
        <div className="mb-3 flex h-[580px] w-[380px] sm:w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl border border-teal-200/80 bg-white shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#04616b] px-4 py-3.5 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                <span className="text-xl animate-pulse">🦷</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#009da6] bg-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-wide">Dr. Zha</h3>
                  <span className="rounded-md bg-white/25 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider">
                    AI Dental Guide
                  </span>
                </div>
                <p className="text-[11px] text-teal-100 font-medium">Smart Clinical &amp; Practice Companion</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      id: 'welcome-reset',
                      sender: 'bot',
                      text: "Vanakkam! I'm **Dr. Zha**. How can I help you in your clinic today?",
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ]);
                }}
                title="Reset Conversation"
                className="rounded-lg p-1.5 text-teal-100 hover:bg-white/15 transition cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="rounded-lg p-1.5 text-teal-100 hover:bg-white/15 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 pt-1 text-xs font-bold dark:border-slate-800 dark:bg-slate-850">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 text-center border-b-2 transition cursor-pointer ${
                activeTab === 'chat'
                  ? 'border-[#009da6] text-[#009da6] dark:text-teal-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              💬 AI Chat
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

          {/* Tab Content 1: AI Clinical Chat */}
          {activeTab === 'chat' && (
            <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/60">
              {/* Message History */}
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

                      {/* Interactive Deep Link Button */}
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
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 p-2">
                    <span className="h-2 w-2 rounded-full bg-[#009da6] animate-ping" />
                    <span className="font-semibold">Dr. Zha is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Prompt Suggestions */}
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-white/70 border-t border-slate-100 dark:bg-slate-850 dark:border-slate-800 no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleSendMessage('FDI tooth chart numbering')}
                  className="shrink-0 rounded-full border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[10.5px] font-bold text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                >
                  🦷 FDI Chart Cheat Sheet
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
                  📋 Post-Op Extraction
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('How to create an invoice and collect payment')}
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  🧾 Invoicing Guide
                </button>
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask Dr. Zha (e.g. Tooth 46, Amoxicillin dose)..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:border-[#009da6] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping}
                  className="rounded-xl bg-[#009da6] p-2 text-white hover:bg-[#0a7f8b] disabled:opacity-50 transition cursor-pointer"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* Tab Content 2: Fast 1-Click Action Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/60">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Instant Workstation Shortcuts
                </h4>
                <p className="text-[11px] text-slate-500">
                  Navigate straight into high-frequency clinic actions without browsing menus.
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

              {/* Proactive Tip Card */}
              <div className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-500/10 to-transparent p-3.5 text-xs dark:border-teal-900/50">
                <div className="flex items-center gap-2 font-bold text-[#009da6] dark:text-teal-300">
                  <Sparkles size={16} />
                  <span>Pro Tip for Indian Clinics</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Use the <strong>Live OPD Queue</strong> during peak evening rush. Front desk can check patients in, and doctors can view waiting times with live status transitions!
                </p>
              </div>
            </div>
          )}

          {/* Tab Content 3: Walkthrough Guides */}
          {activeTab === 'guides' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/60">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Step-by-Step Clinic Procedures
                </h4>
                <p className="text-[11px] text-slate-500">
                  Interactive walk-throughs for doctors, receptionists, and nursing staff.
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

          {/* Tab Content 4: Pharmacology & Patient Care Library */}
          {activeTab === 'dosages' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/60 text-xs">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Clinical Care &amp; Copyable Instructions
                </h4>
                <p className="text-[11px] text-slate-500">
                  Copy instant post-operative care instructions to send to patients via WhatsApp or print.
                </p>
              </div>

              {/* Extraction Care Card */}
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

              {/* RCT Care Card */}
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

              {/* Scaling Care Card */}
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

          {/* Footer Bar */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10.5px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
            <span>ZhanX Clinical AI Engine · v2.6</span>
            <span className="flex items-center gap-1 text-[#009da6] dark:text-teal-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online &amp; Active
            </span>
          </div>
        </div>
      )}

      {/* Floating Animated Mascot Button (Dr. Zha / Pet) */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setShowBubble(false);
        }}
        aria-label="Toggle Dr. Zha AI Dental Assistant"
        className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#009da6] via-[#0a7f8b] to-[#04616b] text-white shadow-xl shadow-teal-500/25 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/60 dark:border-slate-700"
      >
        <span className="text-2xl transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
          🦷
        </span>
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-xs">
          AI
        </span>
      </button>
    </div>
  );
}
