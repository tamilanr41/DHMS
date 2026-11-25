import { useEffect, useState } from 'react';

/**
 * ZhaWaterLoader
 * Clean, borderless Tamil letter "ழ" water filling loading animation
 * Strictly the letter "ழ" floating with realistic liquid wave filling,
 * with no enclosing box, card, or border container.
 */
export default function ZhaWaterLoader({
  progress = 0,
  statusText = 'Verifying credentials…',
  tamilStatusText = 'பயனாளர் சரிபார்ப்பு…',
  compact = false,
  showPercentage = true,
  autoAnimate = false
}) {
  const [internalProgress, setInternalProgress] = useState(progress);

  useEffect(() => {
    if (!autoAnimate) {
      setInternalProgress(progress);
      return;
    }
    let p = 15;
    const interval = setInterval(() => {
      p = (p + 2.5) % 100;
      setInternalProgress(p);
    }, 60);
    return () => clearInterval(interval);
  }, [autoAnimate, progress]);

  // Clamped progress between 0 and 100
  const effectiveProgress = autoAnimate ? internalProgress : progress;
  const clampedProgress = Math.min(100, Math.max(0, effectiveProgress));

  // In our 240x240 SVG viewBox, empty is ~205, full is ~35
  const emptyY = 205;
  const fullY = 35;
  const waveY = emptyY - (clampedProgress / 100) * (emptyY - fullY);

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <style>{`
        @keyframes zhaWaveFront {
          0% { transform: translateX(0); }
          100% { transform: translateX(-120px); }
        }
        @keyframes zhaWaveBack {
          0% { transform: translateX(-120px); }
          100% { transform: translateX(0); }
        }
        @keyframes zhaBubbleFloat1 {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          40% { opacity: 0.85; }
          100% { transform: translate(-8px, -60px) scale(1.1); opacity: 0; }
        }
        @keyframes zhaBubbleFloat2 {
          0% { transform: translate(0, 0) scale(0.7); opacity: 0; }
          50% { opacity: 0.95; }
          100% { transform: translate(10px, -70px) scale(1.2); opacity: 0; }
        }
        @keyframes zhaBubbleFloat3 {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          30% { opacity: 0.8; }
          100% { transform: translate(-6px, -50px) scale(1); opacity: 0; }
        }
        @keyframes zhaAmbientPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.96); }
          50% { opacity: 0.65; transform: scale(1.05); }
        }
        .animate-zha-wave-front {
          animation: zhaWaveFront 4.2s linear infinite;
        }
        .animate-zha-wave-back {
          animation: zhaWaveBack 5.8s linear infinite;
        }
        .animate-zha-bubble-1 {
          animation: zhaBubbleFloat1 3s ease-in infinite;
        }
        .animate-zha-bubble-2 {
          animation: zhaBubbleFloat2 3.8s ease-in infinite 1s;
        }
        .animate-zha-bubble-3 {
          animation: zhaBubbleFloat3 2.8s ease-in infinite 1.8s;
        }
        .animate-zha-ambient {
          animation: zhaAmbientPulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Gentle soft ambient back-light strictly centered on the letter */}
      <div
        className="pointer-events-none absolute h-52 w-52 rounded-full bg-gradient-to-tr from-blue-500/20 via-sky-300/25 to-indigo-500/20 blur-3xl animate-zha-ambient"
        aria-hidden="true"
      />

      {/* ONLY The Letter "ழ" (No box, no card, no border) */}
      <div className="relative flex items-center justify-center">
        <svg
          viewBox="0 0 240 240"
          className={`${compact ? 'h-36 w-36' : 'h-52 w-52 sm:h-64 sm:w-64'} filter drop-shadow-[0_12px_36px_rgba(37,99,235,0.45)]`}
          aria-label="Tamil letter ழ with water filling"
        >
          <defs>
            {/* Clip path defining the exact shape of Tamil letter ழ */}
            <clipPath id="zha-water-clip">
              <text
                x="120"
                y="172"
                textAnchor="middle"
                fontSize="170"
                fontWeight="900"
                fontFamily="'Nirmala UI', 'Latha', 'Tamil Sangam MN', 'Mukta Malar', 'Segoe UI', system-ui, sans-serif"
              >
                ழ
              </text>
            </clipPath>

            {/* Water Gradients */}
            <linearGradient id="zha-water-front-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#3b82f6" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#1d4ed8" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="zha-water-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#2563eb" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#1e40af" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="zha-glass-stroke-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.85" />
            </linearGradient>

            {/* Water surface shine filter */}
            <filter id="zha-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Layer 1: Empty translucent glass silhouette of ழ */}
          <text
            x="120"
            y="172"
            textAnchor="middle"
            fontSize="170"
            fontWeight="900"
            fontFamily="'Nirmala UI', 'Latha', 'Tamil Sangam MN', 'Mukta Malar', 'Segoe UI', system-ui, sans-serif"
            fill="rgba(255, 255, 255, 0.05)"
            stroke="rgba(147, 197, 253, 0.28)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          >
            ழ
          </text>

          {/* Subtle inner depth tint */}
          <text
            x="120"
            y="172"
            textAnchor="middle"
            fontSize="170"
            fontWeight="900"
            fontFamily="'Nirmala UI', 'Latha', 'Tamil Sangam MN', 'Mukta Malar', 'Segoe UI', system-ui, sans-serif"
            fill="rgba(59, 130, 246, 0.07)"
          >
            ழ
          </text>

          {/* Layer 2: Clipped Water Waves inside the letter ழ */}
          <g clipPath="url(#zha-water-clip)">
            {/* Liquid level translating vertically with smooth fluid momentum */}
            <g
              style={{
                transform: `translateY(${waveY}px)`,
                transition: 'transform 0.45s cubic-bezier(0.2, 0.8, 0.25, 1)'
              }}
            >
              {/* Back wave flowing right-to-left */}
              <path
                d="M-120,0 C-60,11 0,-11 60,0 C120,11 180,-11 240,0 C300,11 360,-11 420,0 C480,11 540,-11 600,0 L600,280 L-120,280 Z"
                fill="url(#zha-water-back-grad)"
                className="animate-zha-wave-back"
              />

              {/* Rising Bubbles inside the water body */}
              <g opacity={clampedProgress > 10 ? 0.9 : 0.2}>
                <circle cx="100" cy="50" r="3.5" fill="rgba(255,255,255,0.75)" className="animate-zha-bubble-1" />
                <circle cx="140" cy="70" r="4.5" fill="rgba(255,255,255,0.85)" className="animate-zha-bubble-2" />
                <circle cx="120" cy="95" r="2.5" fill="rgba(255,255,255,0.7)" className="animate-zha-bubble-3" />
                <circle cx="85" cy="80" r="2.8" fill="rgba(255,255,255,0.8)" className="animate-zha-bubble-1" />
                <circle cx="155" cy="110" r="3" fill="rgba(255,255,255,0.65)" className="animate-zha-bubble-2" />
              </g>

              {/* Front wave flowing left-to-right */}
              <path
                d="M-120,0 C-60,-9 0,9 60,0 C120,-9 180,9 240,0 C300,-9 360,9 420,0 C480,-9 540,9 600,0 L600,280 L-120,280 Z"
                fill="url(#zha-water-front-grad)"
                className="animate-zha-wave-front"
              />

              {/* Wave crest shimmer line */}
              <path
                d="M-120,0 C-60,-9 0,9 60,0 C120,-9 180,9 240,0 C300,-9 360,9 420,0 C480,-9 540,9 600,0"
                fill="none"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="2.2"
                filter="url(#zha-glow-filter)"
                className="animate-zha-wave-front"
              />

              {/* Secondary subsurface glow line */}
              <path
                d="M-120,4 C-60,-5 0,13 60,4 C120,-5 180,13 240,4 C300,-5 360,13 420,4 C480,-5 540,13 600,4"
                fill="none"
                stroke="rgba(191, 219, 254, 0.65)"
                strokeWidth="1.5"
                className="animate-zha-wave-front"
              />
            </g>
          </g>

          {/* Layer 3: Crisp glass stroke & specular edge of the letter ழ */}
          <text
            x="120"
            y="172"
            textAnchor="middle"
            fontSize="170"
            fontWeight="900"
            fontFamily="'Nirmala UI', 'Latha', 'Tamil Sangam MN', 'Mukta Malar', 'Segoe UI', system-ui, sans-serif"
            fill="none"
            stroke="url(#zha-glass-stroke-grad)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            pointerEvents="none"
            className="drop-shadow-[0_0_10px_rgba(147,197,253,0.6)]"
          >
            ழ
          </text>

          {/* Layer 4: Full shine sparkle when 100% full */}
          {clampedProgress >= 96 && (
            <g className="animate-pulse">
              <circle cx="168" cy="72" r="3.5" fill="#ffffff" filter="url(#zha-glow-filter)" />
              <path d="M168,64 L168,80 M160,72 L176,72" stroke="#ffffff" strokeWidth="1.8" />
            </g>
          )}
        </svg>
      </div>

      {/* Floating minimalist progress & status text under the letter (No box) */}
      <div className="mt-2 flex flex-col items-center text-center">
        {showPercentage && (
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(59,130,246,0.7)]">
              {Math.round(clampedProgress)}
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-sky-400">%</span>
          </div>
        )}

        {/* Slim minimal glowing liquid progress bar */}
        <div className="mt-2 h-1 w-36 sm:w-44 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 shadow-[0_0_12px_rgba(96,165,250,0.85)] transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        {/* Minimalist Status Text */}
        <div className="mt-2.5 min-h-[32px] flex flex-col items-center justify-center">
          <p className="text-[13px] font-medium text-white/95 drop-shadow-sm transition-all duration-300">
            {tamilStatusText}
          </p>
          <p className="text-[10.5px] text-white/55 font-mono tracking-wide mt-0.5">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
}
