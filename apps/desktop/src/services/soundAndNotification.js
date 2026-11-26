/**
 * soundAndNotification.js
 * Provides sound chimes and native Web Push Notifications for Doctor & Staff.
 * Works on Mobile (Chrome, Safari iOS 16.4+, Android) & Desktop browsers.
 */

// Play a pleasant chime sound using Web Audio API (No external mp3 required!)
export function playChimeSound(type = 'arrival') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'arrival') {
      // Pleasant two-tone dental clinic chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.8);
      osc2.stop(ctx.currentTime + 0.8);
    } else if (type === 'urgent') {
      // 3 rapid alert beeps
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (err) {
    console.warn('Audio chime playback blocked or not supported:', err);
  }
}

// Request Notification Permission on Mobile/Desktop
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}

// Show native Web Notification banner on Doctor's phone/PC
export function showDoctorNotification({ title, body, icon = '/icons/icon-192x192.png', tag = 'dhms-alert' }) {
  // 1. Always play clinical chime sound
  playChimeSound('arrival');

  // 2. Try native Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon,
        tag,
        badge: icon,
        vibrate: [200, 100, 200]
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      // Fallback for mobile service worker if direct Notification throws
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon,
            tag,
            vibrate: [200, 100, 200]
          });
        });
      }
    }
  }
}

/**
 * Trigger Doctor WhatsApp Alert directly with formatted clinical message
 * @param {string} doctorMobile - Doctor's phone number
 * @param {object} details - { doctorName, patientName, time, reason, event: 'booked'|'checked_in'|'in_chair'|'cancelled' }
 */
export function sendDoctorWhatsAppAlert(doctorMobile, { doctorName, patientName, time, reason, event = 'booked' }) {
  if (!doctorMobile) return false;

  const clean = doctorMobile.replace(/\D/g, '');
  const num = clean.length === 10 ? `91${clean}` : clean;

  let header = '🔔 *CLINIC NOTIFICATION*';
  let statusText = '';

  if (event === 'checked_in') {
    header = '🚨 *PATIENT WAITING IN CLINIC LOUNGE*';
    statusText = 'Patient has arrived and is waiting in the lounge for consultation.';
  } else if (event === 'booked') {
    header = '📅 *NEW APPOINTMENT BOOKED*';
    statusText = 'A new clinical consultation has been booked on your roster.';
  } else if (event === 'in_chair') {
    header = '💺 *PATIENT SEATED IN OPERATORY CHAIR*';
    statusText = 'Patient is prepared and seated in the dental chair for procedure.';
  } else if (event === 'cancelled') {
    header = '⚠️ *APPOINTMENT CANCELLED*';
    statusText = 'Patient visit has been cancelled/rescheduled.';
  }

  const msg = encodeURIComponent(
`${header}
Hello Dr. ${doctorName || 'Doctor'},

👤 *Patient:* ${patientName}
⏰ *Time:* ${time || 'Today'}
🩺 *Reason:* ${reason || 'Dental Consultation'}

📌 *Status Update:* ${statusText}

— *ZhanX DentalCare Practice System*`
  );

  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  return true;
}
