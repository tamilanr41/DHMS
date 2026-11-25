import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Square, Play, Pause, RotateCcw, Download,
  Volume2, ShieldCheck, CheckCircle2, AlertCircle, FileAudio
} from 'lucide-react';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';

const DB_NAME = 'ZhanX_Consultation_Audio_DB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_recordings';

function openAudioDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'consultationId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredAudio(consultationId) {
  if (!consultationId) return null;
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(String(consultationId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveStoredAudio(consultationId, blob, duration) {
  if (!consultationId || !blob) return;
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry = {
        consultationId: String(consultationId),
        blob,
        duration,
        recordedAt: new Date().toISOString()
      };
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save audio in IndexedDB:', err);
  }
}

async function deleteStoredAudio(consultationId) {
  if (!consultationId) return;
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(String(consultationId));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export default function ConsultationAudioRecorder({
  consultationId,
  patientName = 'Patient',
  onRecordingSaved
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'recorded'
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordedMeta, setRecordedMeta] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [permissionError, setPermissionError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Load existing audio recording for this consultation
  useEffect(() => {
    let active = true;
    if (consultationId) {
      getStoredAudio(consultationId).then((data) => {
        if (!active || !data) return;
        const url = URL.createObjectURL(data.blob);
        setAudioUrl(url);
        setRecordedMeta({
          duration: data.duration,
          recordedAt: data.recordedAt,
          sizeBytes: data.blob.size
        });
        setStatus('recorded');
      });
    }
    return () => {
      active = false;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      stopTracks();
    };
  }, [consultationId]);

  const stopTracks = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
    }
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
  };

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 3;
      const barGap = 2;
      const totalBars = Math.floor(canvas.width / (barWidth + barGap));
      const step = Math.floor(bufferLength / totalBars);

      for (let i = 0; i < totalBars; i++) {
        const val = dataArray[i * step] || 0;
        const barHeight = Math.max(3, (val / 255) * canvas.height);
        const x = i * (barWidth + barGap);
        const y = canvas.height - barHeight;

        // Gradient bar (teal to emerald)
        ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#06b6d4';
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    render();
  };

  const startRecording = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const meta = {
          duration: elapsedSec,
          recordedAt: new Date().toISOString(),
          sizeBytes: blob.size
        };
        setRecordedMeta(meta);
        setStatus('recorded');

        if (consultationId) {
          await saveStoredAudio(consultationId, blob, elapsedSec);
        }
        if (onRecordingSaved) {
          onRecordingSaved({ blob, duration: elapsedSec });
        }
      };

      mediaRecorder.start(250);
      setStatus('recording');
      setElapsedSec(0);

      timerRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);

      drawVisualizer();
    } catch (err) {
      console.error('Microphone error:', err);
      setPermissionError('Microphone access denied or not available. Please allow audio permission in browser.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (status === 'recording' || status === 'paused')) {
      mediaRecorderRef.current.stop();
      stopTracks();
    }
  };

  const discardRecording = async () => {
    if (window.confirm('Delete this audio discussion recording?')) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setRecordedMeta(null);
      setStatus('idle');
      setElapsedSec(0);
      if (consultationId) {
        await deleteStoredAudio(consultationId);
      }
    }
  };

  const togglePlay = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const formatSec = (total) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            status === 'recording' ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
          }`}>
            <Mic size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                Doctor-Patient Discussion Recorder
              </h3>
              {status === 'recording' && (
                <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
                  REC
                </span>
              )}
              {status === 'recorded' && (
                <Badge tone="success" dot>Archived</Badge>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500">
              Chairside audio documentation for informed consent &amp; treatment history
            </p>
          </div>
        </div>

        {/* Live Elapsed Timer */}
        <div className="font-mono text-base font-black tabular-nums text-navy-900">
          {formatSec(status === 'recorded' ? recordedMeta?.duration || elapsedSec : elapsedSec)}
        </div>
      </div>

      {permissionError && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Audio Waveform Canvas */}
      {status === 'recording' || status === 'paused' ? (
        <div className="relative my-3 rounded-xl border border-emerald-100 bg-slate-950 p-3">
          <canvas
            ref={canvasRef}
            width={340}
            height={48}
            className="w-full h-12"
          />
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-emerald-400 font-mono">
            <span>● Real-time Clinical Speech Analyser</span>
            <span>{status === 'paused' ? 'PAUSED' : 'LIVE'}</span>
          </div>
        </div>
      ) : null}

      {/* Recorded State Player */}
      {status === 'recorded' && audioUrl && (
        <div className="my-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onTimeUpdate={(e) => {
              const audio = e.target;
              if (audio.duration) {
                setPlayProgress((audio.currentTime / audio.duration) * 100);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setPlayProgress(0);
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm hover:bg-accent-700 transition cursor-pointer"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                <span>Discussion with {patientName}</span>
                <span className="font-mono text-slate-500">{formatSec(recordedMeta?.duration || 0)}</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-100"
                  style={{ width: `${playProgress}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>{recordedMeta?.sizeBytes ? `${Math.round(recordedMeta.sizeBytes / 1024)} KB` : 'Audio blob'}</span>
                <span>{recordedMeta?.recordedAt ? new Date(recordedMeta.recordedAt).toLocaleTimeString() : 'Recorded'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Patient discussion stored securely in clinical audit records</span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <Button
              size="sm"
              variant="primary"
              icon={Mic}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={startRecording}
            >
              Record Discussion
            </Button>
          )}

          {status === 'recording' && (
            <>
              <Button size="sm" variant="secondary" icon={Pause} onClick={pauseRecording}>
                Pause
              </Button>
              <Button size="sm" variant="danger" icon={Square} onClick={stopRecording}>
                Stop &amp; Save
              </Button>
            </>
          )}

          {status === 'paused' && (
            <>
              <Button size="sm" variant="primary" icon={Mic} onClick={resumeRecording}>
                Resume
              </Button>
              <Button size="sm" variant="danger" icon={Square} onClick={stopRecording}>
                Finish
              </Button>
            </>
          )}

          {status === 'recorded' && (
            <>
              <a
                href={audioUrl}
                download={`Consultation-Audio-${consultationId || 'Recording'}.webm`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Download size={13} /> Export Audio
              </a>
              <Button size="sm" variant="subtle" icon={RotateCcw} onClick={discardRecording} className="text-slate-500">
                Re-record
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
