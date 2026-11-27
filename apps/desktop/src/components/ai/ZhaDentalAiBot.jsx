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
  Smile,
  SquarePen,
  Languages,
  Globe
} from 'lucide-react';
import { useAuth } from '../../services/auth.jsx';

// ── Unique ZhanX Dental Robot Mascot SVG ────────────────────────────────────
function ZhaDentalRobotAvatar({ isListening = false, isSpeaking = false, size = 66, className = '' }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none transition-transform duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 118"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl overflow-visible"
      >
        <defs>
          {/* ZhanX Brand Signature Teal Gradient */}
          <linearGradient id="zhanxTeal" x1="10" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00d1dc" />
            <stop offset="0.45" stopColor="#009da6" />
            <stop offset="1" stopColor="#034d52" />
          </linearGradient>

          {/* Pearl Ceramic Dental White Gradient */}
          <linearGradient id="pearlDentalWhite" x1="30" y1="10" x2="70" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#f0fdfa" />
            <stop offset="1" stopColor="#ccfbf1" />
          </linearGradient>

          {/* Cyber Visor Screen */}
          <linearGradient id="dentalVisor" x1="20" y1="20" x2="80" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#072024" />
            <stop offset="0.6" stopColor="#041518" />
            <stop offset="1" stopColor="#020c0e" />
          </linearGradient>

          {/* Mint Cyan LED Glow Filter */}
          <filter id="mintGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Energy Pod Glow */}
          <filter id="podGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Hover Thrusters / Boots with Mint Energy Glow ── */}
        <g>
          {/* Energy Thrust Ambient Glow */}
          <ellipse cx="37" cy="107" rx="8" ry="3" fill="#22d3ee" opacity="0.6" filter="url(#podGlow)" />
          <ellipse cx="63" cy="107" rx="8" ry="3" fill="#22d3ee" opacity="0.6" filter="url(#podGlow)" />

          {/* Left Boot */}
          <rect x="30" y="92" width="14" height="15" rx="7" fill="url(#zhanxTeal)" stroke="#023b3f" strokeWidth="2" />
          <ellipse cx="37" cy="104" rx="5" ry="2" fill="#5eead4" />

          {/* Right Boot */}
          <rect x="56" y="92" width="14" height="15" rx="7" fill="url(#zhanxTeal)" stroke="#023b3f" strokeWidth="2" />
          <ellipse cx="63" cy="104" rx="5" ry="2" fill="#5eead4" />
        </g>

        {/* ── Robotic Arms ── */}
        {/* Left Arm with Ceramic Hand */}
        <g>
          <ellipse
            cx="19"
            cy="73"
            rx="6.5"
            ry="12"
            transform="rotate(-18 19 73)"
            fill="url(#zhanxTeal)"
            stroke="#023b3f"
            strokeWidth="2"
          />
          <circle cx="15" cy="82" r="4.5" fill="url(#pearlDentalWhite)" stroke="#023b3f" strokeWidth="1.5" />
        </g>

        {/* Right Arm (Waving friendly) */}
        <g>
          <ellipse
            cx="81"
            cy="73"
            rx="6.5"
            ry="12"
            transform="rotate(18 81 73)"
            fill="url(#zhanxTeal)"
            stroke="#023b3f"
            strokeWidth="2"
          />
          <circle cx="85" cy="82" r="4.5" fill="url(#pearlDentalWhite)" stroke="#023b3f" strokeWidth="1.5" />
        </g>

        {/* ── Chubby Robotic Dental Body / Torso ── */}
        <ellipse
          cx="50"
          cy="75"
          rx="25"
          ry="22"
          fill="url(#zhanxTeal)"
          stroke="#023b3f"
          strokeWidth="2.5"
        />

        {/* Ceramic Dental Chest Armor Plate */}
        <path
          d="M 33 66 Q 50 63 67 66 Q 64 85 50 88 Q 36 85 33 66 Z"
          fill="url(#pearlDentalWhite)"
          stroke="#087077"
          strokeWidth="1.5"
        />

        {/* Chest Core: Illuminated Dental Cross & Sparkle Core */}
        <g filter="url(#mintGlow)" transform="translate(50, 75)">
          {/* Medical Dental Cross in Brand Mint */}
          <rect x="-2" y="-6" width="4" height="12" rx="1.5" fill="#009da6" />
          <rect x="-6" y="-2" width="12" height="4" rx="1.5" fill="#009da6" />
          {/* Inner neon core dot */}
          <circle cx="0" cy="0" r="2" fill="#5eead4" />
        </g>

        {/* ── Robotic Head with Dental Tooth Crown Ears ── */}
        {/* Left Tooth Crown Ear */}
        <g transform="translate(23, 14)">
          <path
            d="M 3 14 C 0 8, 3 2, 7 2 C 11 2, 14 6, 14 14 Z"
            fill="url(#pearlDentalWhite)"
            stroke="#023b3f"
            strokeWidth="2"
          />
          <circle cx="8" cy="7" r="1.5" fill="#5eead4" />
        </g>

        {/* Right Tooth Crown Ear */}
        <g transform="translate(63, 14)">
          <path
            d="M 0 14 C 0 6, 3 2, 7 2 C 11 2, 14 8, 11 14 Z"
            fill="url(#pearlDentalWhite)"
            stroke="#023b3f"
            strokeWidth="2"
          />
          <circle cx="6" cy="7" r="1.5" fill="#5eead4" />
        </g>

        {/* Top Micro Dental Antenna */}
        <line x1="50" y1="20" x2="50" y2="10" stroke="#009da6" strokeWidth="3" strokeLinecap="round" />
        <circle
          cx="50"
          cy="9"
          r="4.5"
          fill={isListening ? '#ef4444' : '#22d3ee'}
          filter="url(#mintGlow)"
          className={isListening ? 'animate-ping' : ''}
        />
        <circle cx="50" cy="9" r="2.5" fill="#ffffff" />

        {/* Main Robotic Helmet Chassis */}
        <rect
          x="19"
          y="20"
          width="62"
          height="46"
          rx="18"
          fill="url(#zhanxTeal)"
          stroke="#023b3f"
          strokeWidth="2.5"
        />

        {/* Glossy Curved Visor Screen */}
        <rect
          x="26"
          y="26"
          width="48"
          height="32"
          rx="12"
          fill="url(#dentalVisor)"
          stroke="#0d4e54"
          strokeWidth="2"
        />

        {/* Visor Specular Glass Reflection */}
        <path
          d="M 29 30 Q 50 27 71 30 Q 70 33 62 33 Q 48 30 29 34 Z"
          fill="#ffffff"
          opacity="0.18"
        />

        {/* ── Expressive Visor LED Face ── */}
        {isListening ? (
          // Listening: Animated neon soundwave bars
          <g fill="#22d3ee" filter="url(#mintGlow)">
            <rect x="36" y="38" width="3" height="8" rx="1.5" className="animate-pulse" />
            <rect x="42" y="34" width="3" height="16" rx="1.5" className="animate-bounce" />
            <rect x="48" y="32" width="3" height="20" rx="1.5" className="animate-pulse delay-75" />
            <rect x="54" y="34" width="3" height="16" rx="1.5" className="animate-bounce delay-150" />
            <rect x="60" y="38" width="3" height="8" rx="1.5" className="animate-pulse" />
          </g>
        ) : isSpeaking ? (
          // Speaking: Cheerful curved eyes & talking wave mouth
          <g stroke="#22d3ee" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#mintGlow)">
            {/* Happy curved eyes (^ ^) */}
            <path d="M 34 40 Q 39 34 44 40" fill="none" />
            <path d="M 56 40 Q 61 34 66 40" fill="none" />
            {/* Friendly talking smile */}
            <path d="M 45 48 Q 50 53 55 48" fill="none" stroke="#5eead4" strokeWidth="2.5" />
          </g>
        ) : (
          // Idle Friendly Clinical LED Face: Left eye glowing wink/sparkle, Right eye smart terminal cursor
          <g filter="url(#mintGlow)">
            {/* Left Eye: Cute Smiling LED Arc */}
            <path
              d="M 34 41 Q 39 34 44 41"
              stroke="#22d3ee"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Right Eye: Friendly Smart Terminal Eye with pulse */}
            <g stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 55 37 L 60 41 L 55 45" fill="none" />
              <line x1="63" y1="45" x2="68" y2="45" className="animate-pulse" />
            </g>
            {/* Cute mini smile */}
            <path
              d="M 47 48 Q 50 51 53 48"
              stroke="#5eead4"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
      </svg>

      {/* Speaking Voice Waves Indicator */}
      {isSpeaking && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-[#009da6] text-[8px] font-black text-white items-center justify-center shadow-sm">
            ♪
          </span>
        </span>
      )}
    </div>
  );
}

// ── Multi-Language Auto-Detection Engine ─────────────────────────────────────
export function detectLanguage(text) {
  if (!text) return 'en';

  // 1. Check for Tamil script (Unicode U+0B80 - U+0BFF)
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta';
  }

  // 2. Check for Hindi script (Unicode U+0900 - U+097F)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }

  const lower = text.toLowerCase();

  // 3. Check for Thanglish (Tamil written in Latin/English letters)
  const thanglishKeywords = [
    'epdi', 'eppadi', 'enna', 'solla', 'sollu', 'sollunga', 'panradhu', 'pannanu', 'panra', 'panna', 'pannunga',
    'irukku', 'irukkanu', 'venum', 'venda', 'vendaam', 'pathu', 'pakka', 'kudukka', 'kudunga', 'pallu', 'pal', 'vali',
    'marundhu', 'illai', 'illa', 'aagala', 'vandhu', 'poiduchu', 'konjam', 'nalla', 'yaarukku', 'enakku', 'romba',
    'aama', 'seri', 'paravalla', 'thanglish', 'vanakkam', 'ungalluku', 'ungalukku', 'enga', 'keela', 'mela', 'edhuvum',
    'endha', 'apram', 'mudiyala', 'podradhu', 'podanum', 'paakanum', 'kaatunga', 'kooda', 'namma', 'adhula', 'adhulaye',
    'adhuvum', 'pesanu', 'pesa', 'pesunga', 'kitta', 'ketta', 'theriyala', 'theriyum', 'evlo', 'eppo', 'dha', 'dhan',
    'pudhu', 'kaasu', 'panam', 'kassu', 'serkka'
  ];

  const words = lower.split(/[^a-z0-9]+/);
  const isThanglish = words.some((w) => thanglishKeywords.includes(w));
  if (isThanglish || lower.includes('vanakkam') || lower.includes('epdi') || lower.includes('solla') || lower.includes('panra') || lower.includes('pallu')) {
    return 'thanglish';
  }

  // 4. Check for Hinglish
  const hinglishKeywords = ['kaise', 'karna', 'karo', 'namaste', 'kya', 'hai', 'batao', 'dawa', 'dard', 'dant'];
  if (words.some((w) => hinglishKeywords.includes(w))) {
    return 'hi';
  }

  return 'en';
}

// ── Multi-Language Dental Intelligence Knowledge Base ───────────────────────
const DENTAL_KNOWLEDGE_BASE = [
  {
    triggers: ['fdi', 'tooth', 'teeth', 'chart', 'number', 'quadrant', 'permanent', 'deciduous', 'primary', 'pallu', 'parkal', 'enn', 'edam', 'notation'],
    title: '🦷 FDI Two-Digit Tooth Notation System',
    responseEn: `Standard FDI Tooth Numbering Cheat Sheet:

• **Permanent Teeth (Adult 11-48)**:
  - Upper Right (Q1): 18, 17, 16, 15, 14, 13, 12, 11 (Central Incisor)
  - Upper Left (Q2): 21 (Central Incisor), 22, 23, 24, 25, 26, 27, 28
  - Lower Left (Q3): 31 (Central Incisor), 32, 33, 34, 35, 36, 37, 38
  - Lower Right (Q4): 48, 47, 46, 45, 44, 43, 42, 41 (Central Incisor)

• **Primary Teeth (Deciduous 51-85)**:
  - Upper Right (Q5): 55-51 | Upper Left (Q6): 61-65
  - Lower Left (Q7): 71-75 | Lower Right (Q8): 85-81

💡 *Tip: Click 'Dental Chart' on any patient file to tap individual surfaces (Mesial, Occlusal, Distal, Buccal, Lingual)!*`,
    responseThanglish: `FDI Pal Enn (Tooth Numbering) Cheat Sheet:

• **Periyavanga Palkal (Permanent 11-48)**:
  - Upper Right (Q1): 18, 17, 16, 15, 14, 13, 12, 11 (Mun pal / Central Incisor)
  - Upper Left (Q2): 21, 22, 23, 24, 25, 26, 27, 28
  - Lower Left (Q3): 31, 32, 33, 34, 35, 36, 37, 38
  - Lower Right (Q4): 48, 47, 46, 45, 44, 43, 42, 41

• **Paal Palkal (Deciduous 51-85)**:
  - Q5 (Mel Valadhu 55-51) | Q6 (Mel Idadhu 61-65)
  - Q7 (Keezh Idadhu 71-75) | Q8 (Keezh Valadhu 85-81)

💡 *Tip: Patient profile-la 'Dental Chart' click panni tooth surfaces (O, M, D, B, L) direct-ah tap panna restoration mark aagidum!*`,
    responseTa: `FDI சர்வதேச பற்கள் குறிப்பு முறைமை:

• **பெரியவர்கள் பற்கள் (11 முதல் 48 வரை)**:
  - மேல் வலது (Q1): 18 முதல் 11 வரை (முன் பல்)
  - மேல் இடது (Q2): 21 முதல் 28 வரை
  - கீழ் இடது (Q3): 31 முதல் 38 வரை
  - கீழ் வலது (Q4): 48 முதல் 41 வரை

• **பால் பற்கள் (51 முதல் 85 வரை)**:
  - Q5, Q6, Q7, Q8 பகுதிகளாக பிரிக்கப்பட்டுள்ளது.

💡 *குறிப்பு: நோயாளி கோப்பில் 'Dental Chart' கிளிக் செய்து பற்களின் நிலையை நேரடியாக குறித்துக் கொள்ளலாம்!*`,
    action: { label: 'Open Dental Chart', path: '/dental-chart' }
  },
  {
    triggers: ['dosage', 'antibiotic', 'medicine', 'prescription', 'amoxicillin', 'metrogyl', 'painkiller', 'pain', 'ibuprofen', 'paracetamol', 'rx', 'marundhu', 'vali', 'tablet', 'mathirai', 'alavu'],
    title: '💊 Dental Pharmacology & Standard Dosages',
    responseEn: `Standard Dental Drug Regimens (Adults):

1. **Amoxicillin 500mg**: 1 capsule TID (8-hourly) for 5 days with food. (If penicillin-allergic: Clindamycin 300mg TID).
2. **Augmentin 625mg (Amox + Clav)**: 1 tablet BD (12-hourly) for 5 days for severe acute odontogenic infections.
3. **Metrogyl 400mg (Metronidazole)**: 1 tablet TID for 5 days for anaerobic periapical/periodontal infections. (Strictly avoid alcohol).
4. **Analgesic / Pain Relief**: Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg (Zerodol-SP) BD for 3 days after meals.

⚠️ *Safety: Always verify patient's allergy history and renal status before prescribing!*`,
    responseThanglish: `Dental Marundhu & Dosage Vivaram (Adults):

1. **Amoxicillin 500mg**: 1 capsule 8 hours-ku oru thadava (TDS) 5 days saapaattukku pinbu. (Penicillin allergy irundha Clindamycin 300mg kudunga).
2. **Augmentin 625mg**: 1 tablet 12 hours-ku oru thadava (BD) 5 days severe tooth infection-ku.
3. **Metrogyl 400mg**: 1 tablet TDS 5 days periapical/gums infection-ku. (Alcohol kandippa koodadhu).
4. **Vali Nivaaranam (Painkiller)**: Zerodol-SP (Aceclofenac + Para + Serratiopeptidase) 1 tablet BD 3 days saapadu apram.

⚠️ *Mukkiyam: Patient-oda allergy & kidney/gastric ulcer check panni Digital Rx kudunga Doctor!*`,
    responseTa: `பல் மருத்துவ நிலையான மருந்து அளவுகள் (பெரியவர்களுக்கு):

1. **Amoxicillin 500mg**: 8 மணி நேரத்திற்கு 1 மாத்திரை (TDS) - 5 நாட்கள் உணவுக்குப் பின். (ஒவ்வாமை இருந்தால் Clindamycin 300mg).
2. **Augmentin 625mg**: கடுமையான பல் தொற்றுக்கு 12 மணி நேரத்திற்கு 1 மாத்திரை (BD) - 5 நாட்கள்.
3. **Metrogyl 400mg**: 1 மாத்திரை (TDS) - 5 நாட்கள். மது அருந்துவதை தவிர்க்கவும்.
4. **வலி நிவாரணி**: Zerodol-SP 1 மாத்திரை (BD) - 3 நாட்கள் உணவுக்குப் பின்.

⚠️ *பாதுகாப்பு குறிப்பு: நோயாளியின் அலர்ஜி விவரங்களை சரிபார்த்து மருந்து சீட்டு வழங்கவும்!*`,
    action: { label: 'Write Digital Rx', path: '/prescriptions' }
  },
  {
    triggers: ['patient', 'pudhu patient', 'add patient', 'register', 'serkka', 'aalu', 'new patient', 'kootam'],
    title: '👤 Patient Registration & OPD Intake',
    responseEn: `How to Register a New Patient:

1. Click **+ Add Patient** from the header or go to **Patients** in the left menu.
2. Enter Name, Mobile Number, Age, Gender, and Medical History (Diabetes, Hypertension, Allergies).
3. Click **Save Patient**.
4. An automated Patient ID is created, and the patient is instantly added to today's Live Triage Queue!`,
    responseThanglish: `Pudhu Patient-ah Epdi Register Panradhu:

1. Top bar-la irukura **+ Add Patient** click pannunga illana left menu-la **Patients** ponga.
2. Patient Name, Mobile Number, Vayasu (Age), Gender and Medical History (BP, Sugar, Allergies) enter pannunga.
3. **Save Patient** click pannadhum automated Patient ID generate aagidum.
4. Patient direct-ah inaiku OPD Live Queue-ku poiduvaanga!`,
    responseTa: `புதிய நோயாளியை சேர்க்கும் முறை:

1. மேல் பட்டியில் உள்ள **+ Add Patient** அல்லது இடது மெனுவில் உள்ள **Patients** கிளிக் செய்யவும்.
2. பெயர், மொபைல் எண், வயது, பாலினம் மற்றும் மருத்துவ வரலாறு (நீரிழிவு, இரத்த அழுத்தம்) உள்ளிடவும்.
3. **Save Patient** கிளிக் செய்தவுடன் தனித்துவமான Patient ID உருவாக்கப்பட்டு OPD வரிசையில் சேர்க்கப்படும்!`,
    action: { label: 'Register New Patient', path: '/patients/new' }
  },
  {
    triggers: ['post-op', 'extraction', 'aftercare', 'instructions', 'care', 'bleeding', 'socket', 'pallu eduthu', 'edutha apram'],
    title: '📋 Post-Operative Extraction Care Guidelines',
    responseEn: `Instructions for Patient After Tooth Extraction:

1. **Gauze Pressure**: Bite firmly on gauze for 45-60 minutes.
2. **Do Not Spit**: Swallow saliva normally to protect blood clot.
3. **No Straws or Hot Drinks**: Avoid straws, smoking, and hot tea/coffee for 48 hours.
4. **Cold Soft Diet**: Curd rice, ice cream, cool soup on opposite side.
5. **Warm Salt Water**: Gentle saline gargles starting after 24 hours (3x daily).`,
    responseThanglish: `Pallu Edutha Pinbu Patient-ku Solla Vendiya Instructions:

1. **Panju (Gauze)**: 45-60 nimisham nanna kadichu vekkavum.
2. **Echil Thuppakoodadhu**: Saliva-vai swallow pannikkanum. Thuppuna blood clot kalanjidum.
3. **Straw & Hot Drinks Thavirkkavum**: Straw use panni kudikka koodadhu, soodaana tea/coffee avoid pannunga.
4. **Kulirndha Soft Food**: Thayir saadham, ice cream edukkalaam.
5. **Uppu Thanneer Gargle**: 24 hours kazhichu mella ilanchoodu uppu thanneer-la gargle panna sollaungga!`,
    responseTa: `பல் பிடுங்கிய பின் நோயாளிக்கு கூற வேண்டிய முக்கிய குறிப்புகள்:

1. **பஞ்சு**: 45 முதல் 60 நிமிடங்கள் வரை நன்றாக கடித்து வைத்திருக்கவும்.
2. **எச்சில் துப்பக்கூடாது**: இரத்த உறைவு கலையாமல் இருக்க எச்சில் விழுங்க வேண்டும்.
3. **ஸ்ட்ரா தவிர்க்கவும்**: ஸ்ட்ரா மூலம் குடிப்பதை தவிர்க்கவும், சூடான பானங்களை அருந்த வேண்டாம்.
4. **மென்மையான உணவு**: குளிர்ந்த தயிர் சாதம், ஐஸ்கிரீம் போன்றவற்றை உட்கொள்ளலாம்.
5. **உப்பு நீர் கொப்பளிப்பு**: 24 மணி நேரம் கழித்து மிதமான உப்பு நீரில் வாய் கொப்பளிக்கவும்.`,
    action: { label: 'View OPD Queue', path: '/queue' }
  },
  {
    triggers: ['invoice', 'billing', 'bill', 'payment', 'upi', 'cash', 'money', 'discount', 'panam', 'bill podradhu', 'kaasu'],
    title: '🧾 Billing & Invoicing Workflow in ZhanX',
    responseEn: `Generating Patient Bill & Collecting Payment:

1. Go to **Billing & Invoices** -> click **+ New Invoice**.
2. Select Patient and add procedure line items (e.g. Scaling ₹1,500, RCT ₹3,500).
3. Apply doctor discount if authorized.
4. Click **Finalize Invoice**.
5. Click **Collect Payment** -> choose Cash, UPI, or Card.
6. Print instant 3-inch thermal slip or full A4 GST dental invoice!`,
    responseThanglish: `Billing & Payment Podradhu Epdi:

1. Menu-la **Billing & Invoices** ponga, **+ New Invoice** click pannunga.
2. Patient-ah select panni, seitha treatment line items (Scaling, RCT, Extraction) add pannunga.
3. Thevaipatta discount apply pannikalam.
4. **Finalize Invoice** kuduthu, **Collect Payment**-la Cash, UPI or Card select pannunga.
5. 1-click-la thermal receipt slip or full A4 GST bill print edukalaam!`,
    responseTa: `பில்லிங் மற்றும் கட்டணம் வசூலிக்கும் முறை:

1. **Billing & Invoices** சென்று **+ New Invoice** என்பதை கிளிக் செய்யவும்.
2. நோயாளியை தேர்ந்தெடுத்து சிகிச்சை விவரங்களை சேர்க்கவும்.
3. **Finalize Invoice** கொடுத்து UPI, ரொக்கம் அல்லது கார்டு மூலம் கட்டணத்தை பெறவும்.
4. உடனடியாக GST ரசீது அல்லது தெர்மல் ஸ்லிப் பிரிண்ட் எடுத்துக்கொள்ளலாம்!`,
    action: { label: 'Create Invoice', path: '/invoices/new' }
  },
  {
    triggers: ['appointment', 'book', 'schedule', 'reschedule', 'slot', 'calendar', 'neram', 'naalaiki'],
    title: '📅 Appointment Scheduling & Queue Management',
    responseEn: `Managing Appointments in ZhanX:

1. Open **Appointments** to see today's doctor schedule.
2. Click any free slot or **+ New Appointment**.
3. Select Dentist, Patient, and Procedure category.
4. Instant SMS/WhatsApp confirmation is dispatched to the patient.
5. On clinic arrival, mark them **Checked In** to move into the Live Queue!`,
    responseThanglish: `Appointment Book Panradhu Epdi:

1. **Appointments** calendar open pannunga.
2. Free slot-la click panni Doctor, Patient and Treatment choose pannunga.
3. Patient-ku instant-ah WhatsApp/SMS confirmation pooidum.
4. Patient clinic-ku vandhadhum 'Checked In' status pottu Live Queue-ku anuppalaam!`,
    responseTa: `முன்பதிவு (Appointment) செய்யும் முறை:

1. **Appointments** காலெண்டரை திறக்கவும்.
2. காலியான நேரத்தை கிளிக் செய்து நோயாளி மற்றும் மருத்துவர் விவரங்களை பதிவு செய்யவும்.
3. நோயாளி கிளினிக் வந்தவுடன் 'Checked In' செய்து வரிசைக்கு அனுப்பவும்!`,
    action: { label: 'View Appointment Calendar', path: '/appointments' }
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

  // Dynamic Language Mirroring States ('auto' | 'thanglish' | 'ta' | 'en')
  const [chatLang, setChatLang] = useState('auto');
  const [detectedLang, setDetectedLang] = useState('thanglish');

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

  // ── Speech Synthesis (Adaptive Bot Voice Output in Matching Language) ──
  const speakText = useCallback(
    (textToSpeak, langCode = 'en') => {
      if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

      window.speechSynthesis.cancel(); // cancel any active utterance
      // Strip markdown symbols for clean speech
      const cleanText = textToSpeak
        .replace(/[*#_~`•]/g, ' ')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\n+/g, '. ')
        .slice(0, 320); // limit length for pleasant brevity

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.05; // natural friendly pitch

      const voices = window.speechSynthesis.getVoices();

      if (langCode === 'ta') {
        utterance.lang = 'ta-IN';
        const taVoice = voices.find(
          (v) => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil')
        );
        if (taVoice) utterance.voice = taVoice;
      } else if (langCode === 'hi') {
        utterance.lang = 'hi-IN';
        const hiVoice = voices.find(
          (v) => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi')
        );
        if (hiVoice) utterance.voice = hiVoice;
      } else {
        // For Thanglish and Indian English, en-IN voice speaks Thanglish words effortlessly!
        utterance.lang = 'en-IN';
        const inVoice = voices.find(
          (v) =>
            v.lang.includes('en-IN') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('natural')
        );
        if (inVoice) utterance.voice = inVoice;
      }

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

  // ── Speech Recognition (Doctor Voice Input with Language Detection) ───────
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
      // Listen in Tamil if Tamil mode selected/active, else en-IN for Thanglish & English
      recognition.lang = (chatLang === 'ta' || detectedLang === 'ta') ? 'ta-IN' : 'en-IN';
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

  // ── Send Message & Language-Matched AI Retrieval ──────────────────────────
  const handleSendMessage = (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    // Detect user's language (Thanglish / Tamil / English)
    const activeLang = chatLang === 'auto' ? detectLanguage(text) : chatLang;
    setDetectedLang(activeLang);

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
        if (activeLang === 'thanglish') {
          botResponse = match.responseThanglish || match.responseEn;
        } else if (activeLang === 'ta') {
          botResponse = match.responseTa || match.responseThanglish || match.responseEn;
        } else {
          botResponse = match.responseEn;
        }
        botAction = match.action;
      } else if (
        lower.includes('hi') ||
        lower.includes('hello') ||
        lower.includes('vanakkam') ||
        lower.includes('வணக்கம்') ||
        lower.includes('hey')
      ) {
        if (activeLang === 'ta') {
          botResponse = `வணக்கம் டாக்டர்! நான் டாக்டர் ழா, உங்கள் AI மருத்துவ வழிகாட்டி. நான் உங்களுக்கு எவ்வாறு உதவலாம்?
• FDI பற்கள் குறிப்பு எண் முறைமை
• மருந்து அளவுகள் (Amoxicillin, Augmentin, Zerodol-SP)
• பல் பிடுங்கிய பின் நோயாளி பாதுகாப்பு குறிப்புகள்
• பில்லிங், GST இன்வாய்ஸ் மற்றும் OPD வரிசை வழிமுறைகள்!`;
        } else if (activeLang === 'thanglish') {
          botResponse = `Vanakkam Doctor! Naan Dr. Zha, unga AI Dental Assistant. Ungalukku eppadi help pannattum?
• FDI tooth numbering (pal enn) cheat sheet
• Mukkiyamana antibiotic & painkiller dosages
• Extraction & RCT-ku apram patient-ku kudukka vendiya instructions
• GST Bill podradhu & OPD Queue paaka kekaalam!`;
        } else {
          botResponse = `Vanakkam Doctor! I'm Dr. Zha, your Clinical AI Copilot. How can I assist you right now? You can ask me in English, Tamil, or Thanglish about:
• FDI tooth numbering notation
• Standard drug dosages (Amoxicillin, Augmentin, Zerodol-SP)
• Post-op care instructions for extraction or RCT
• Invoicing, GST bills & queue triage workflows!`;
        }
      } else {
        if (activeLang === 'ta') {
          botResponse = `டாக்டர், உங்கள் கேள்வி "${text}" எனக்கு புரிந்தது. ZhanX அமைப்பில் இதற்கான முக்கிய வழிகள்:
1. **FDI Dental Chart**: பற்கள் சிகிச்சை, கேரிஸ், ரூட் கெனால் குறிக்க.
2. **Digital Prescription**: அலர்ஜி சோதித்து துல்லியமாக மருந்து சீட்டு வழங்க.
3. **Billing & Invoices**: GST ரசீது தயார் செய்து UPI/ரொக்கம் வசூலிக்க.

இதில் உங்களுக்கு எந்த வழிகாட்டுதல் தேவை என்று கூறவும்!`;
        } else if (activeLang === 'thanglish') {
          botResponse = `Doctor, unga kelvi "${text}" pathi naana purinjikitten. ZhanX DentalCare-la idhukku fastest ways irukku:
1. **FDI Dental Chart**: Pal treatment, crown, restoration mark panna.
2. **Digital Prescription**: Patient allergy check panni digital Rx generate panna.
3. **Billing & Invoices**: GST receipt & UPI payment collect panna.

Idhula ungalukku step-by-step help venuma illana dosage reference venuma?`;
        } else {
          botResponse = `I understand you're inquiring about "${text}".

Here are the fastest clinical tools in ZhanX DentalCare:
1. **FDI Dental Chart**: For marking restorations, crowns, endo, and missing teeth.
2. **Digital Prescription**: Automatically checks drug safety & patient allergy history.
3. **Billing & Invoices**: Generate GST invoices and collect UPI/Cash receipts.

Would you like a step-by-step walkthrough or clinical dosage reference?`;
        }
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

      // Speak response in matching language if voice is enabled
      speakText(botResponse, activeLang);
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

      {/* ── Main Bot Modal (Properly elevated above dock, never submerged) ── */}
      {isOpen && (
        <div
          className="fixed right-4 sm:right-6 z-50 flex flex-col rounded-3xl border border-teal-200/90 bg-white shadow-2xl backdrop-blur-xl dark:border-teal-800/80 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            bottom: '120px',
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(580px, calc(100vh - 140px))',
            maxHeight: 'calc(100vh - 140px)'
          }}
        >
          {/* Header Bar in Signature ZhanX Dental Teal */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-[#009da6] via-[#0a7f8b] to-[#044c54] px-4 py-3 text-white shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                <ZhaDentalRobotAvatar isListening={isListening} isSpeaking={isSpeaking} size={36} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#009da6] bg-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-wide">Dr. Zha</h3>
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-teal-100">
                    Robotic Dental Companion
                  </span>
                </div>
                <p className="text-[10.5px] text-teal-100 font-medium">Smart Clinical &amp; Voice Guide</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Language Switcher Pill */}
              <button
                type="button"
                onClick={() => {
                  const next = chatLang === 'auto' ? 'thanglish' : chatLang === 'thanglish' ? 'ta' : chatLang === 'ta' ? 'en' : 'auto';
                  setChatLang(next);
                  if (next !== 'auto') setDetectedLang(next);
                }}
                title="Conversation Language Mode (Auto / Thanglish / தமிழ் / English)"
                className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/30 transition cursor-pointer"
              >
                <Languages size={13} className="text-teal-200" />
                <span>
                  {chatLang === 'auto'
                    ? `Auto: ${detectedLang === 'thanglish' ? 'Thanglish' : detectedLang === 'ta' ? 'தமிழ்' : 'English'}`
                    : chatLang === 'thanglish'
                    ? 'Thanglish'
                    : chatLang === 'ta'
                    ? 'தமிழ்'
                    : 'English'}
                </span>
              </button>

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
                    <ZhaDentalRobotAvatar isSpeaking={true} size={22} />
                    <span className="font-semibold text-teal-600 dark:text-teal-300">
                      Dr. Zha is thinking…
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips with Language Matching */}
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-white/70 border-t border-slate-100 dark:bg-slate-850 dark:border-slate-800 no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendMessage(detectedLang === 'ta' ? 'FDI பற்கள் குறிப்பு முறைமை' : detectedLang === 'thanglish' ? 'FDI pal enn chart' : 'FDI tooth chart numbering')}
                  className="shrink-0 rounded-full border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[10.5px] font-bold text-[#009da6] hover:bg-teal-100 transition cursor-pointer dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                >
                  {detectedLang === 'ta' ? '🦷 FDI பற்கள் முறைமை' : detectedLang === 'thanglish' ? '🦷 FDI Pal Enn Chart' : '🦷 FDI Cheat Sheet'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(detectedLang === 'ta' ? 'பல் வலி மாத்திரை மருந்துகள்' : detectedLang === 'thanglish' ? 'Amoxicillin & painkiller dosages enna' : 'Antibiotic dosages for dental infections')}
                  className="shrink-0 rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[10.5px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  {detectedLang === 'ta' ? '💊 மருந்து அளவுகள்' : detectedLang === 'thanglish' ? '💊 Medicine Dosages' : '💊 Drug Dosages'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(detectedLang === 'ta' ? 'பல் பிடுங்கிய பின் நோயாளி பாதுகாப்பு' : detectedLang === 'thanglish' ? 'Pallu edutha apram instructions' : 'Post-op extraction care instructions')}
                  className="shrink-0 rounded-full border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-[10.5px] font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                >
                  {detectedLang === 'ta' ? '📋 பல் பாதுகாப்பு' : detectedLang === 'thanglish' ? '📋 Extraction Care' : '📋 Post-Op Care'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(detectedLang === 'ta' ? 'பில்லிங் மற்றும் ரசீது தயாரிப்பது எப்படி' : detectedLang === 'thanglish' ? 'Billing & GST invoice podradhu epdi' : 'How to create an invoice and collect payment')}
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {detectedLang === 'ta' ? '🧾 பில்லிங் முறை' : detectedLang === 'thanglish' ? '🧾 Bill Podradhu Epdi' : '🧾 Billing Guide'}
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
                  placeholder={
                    isListening
                      ? (detectedLang === 'ta' ? 'கேட்கிறது... பேசுங்கள்' : detectedLang === 'thanglish' ? 'Listening... pesunga Doctor' : 'Listening… speak now')
                      : (detectedLang === 'ta' ? 'டாக்டர் ழா-விடம் கேட்கவும் (எ.கா: பற்கள், மருந்து அளவு)...' : detectedLang === 'thanglish' ? 'Ask Dr. Zha (e.g. Tooth 46, Amoxicillin dose, billing epdi)...' : 'Ask Dr. Zha or tap mic to speak…')
                  }
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

      {/* ── Interactive Robot Mascot & Pill Dock (Custom ZhanX Dental Theme) ── */}
      <div className="relative flex flex-col items-center">
        {/* Floating Robot Mascot Pet */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsOpen((prev) => !prev);
          }}
          aria-label="Dr. Zha Robot AI Companion"
          className="group relative -mb-1 flex cursor-pointer items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        >
          {/* Subtle ZhanX Mint/Teal Glow Aura behind robot */}
          <span className="absolute -inset-2 rounded-full bg-teal-400/25 blur-lg group-hover:bg-teal-400/40 transition duration-500" />

          {/* Unique Dental Robot Avatar */}
          <ZhaDentalRobotAvatar isListening={isListening} isSpeaking={isSpeaking} size={70} />

          {/* Sparkle Tooth Accent on shoulder */}
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#00d1dc] to-[#009da6] shadow-md border border-white text-[10px]">
            🦷
          </span>
        </div>

        {/* ── Sleek ZhanX Teal Pill Dock & Action Button ── */}
        <div className="flex items-center gap-2 pt-1">
          {/* Dark Teal Pill Dock Capsule */}
          <div className="flex items-center gap-3 rounded-full bg-[#041d22]/95 px-3.5 py-2 border border-teal-500/40 shadow-2xl shadow-teal-950/40 backdrop-blur-md">
            {/* Edit / Quick Query Button */}
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              title="Open Clinical AI Assistant"
              className="text-teal-200 hover:text-white hover:scale-110 transition-all duration-200 cursor-pointer p-0.5"
            >
              <SquarePen size={18} strokeWidth={2.2} />
            </button>

            {/* Subtle Divider */}
            <div className="h-4 w-[1px] bg-teal-700/60" />

            {/* Live Audio Waveform Bars (Click to Speak / Voice Mode) */}
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Listening… (click to stop)' : 'Voice Mode: Speak to Dr. Zha'}
              className="group/mic flex items-center gap-0.5 p-0.5 cursor-pointer"
            >
              <span
                className={`w-1 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'h-4 bg-teal-300 animate-pulse'
                    : 'h-2.5 bg-teal-500/80 group-hover/mic:bg-teal-300 group-hover/mic:h-3.5'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'h-6 bg-teal-300 animate-bounce'
                    : 'h-4 bg-teal-400 group-hover/mic:bg-teal-300 group-hover/mic:h-5'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'h-5 bg-teal-300 animate-pulse delay-75'
                    : 'h-3 bg-teal-400 group-hover/mic:bg-teal-300 group-hover/mic:h-4'
                }`}
              />
              <span
                className={`w-1 rounded-full transition-all duration-200 ${
                  isListening
                    ? 'h-3.5 bg-teal-300 animate-bounce delay-150'
                    : 'h-2 bg-teal-500/80 group-hover/mic:bg-teal-300 group-hover/mic:h-3'
                }`}
              />
            </button>
          </div>

          {/* Signature ZhanX Teal Circular Action Arrow Button (->) */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Expand AI Assistant"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-[#009da6] via-[#088b93] to-[#05777e] hover:from-[#008b93] hover:to-[#036166] text-white shadow-xl shadow-teal-500/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer border border-teal-200/40"
          >
            <ArrowRight size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}
