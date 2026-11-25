/**
 * deviceFingerprint.js
 * Generates and persists a unique hardware / browser device identity for seat locking.
 */

async function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getClientDeviceFingerprint() {
  const STORAGE_KEY = 'zhanx_device_fingerprint';
  let stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.length >= 16) {
    return stored;
  }

  // Generate hardware / browser signature
  const screenInfo = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const cores = navigator.hardwareConcurrency || 4;
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Unknown';
  const ua = navigator.userAgent || '';
  const randomSalt = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

  const rawSig = `${screenInfo}|${tz}|${cores}|${platform}|${ua}|${randomSalt}`;
  const hash = await sha256(rawSig);
  const fingerprint = `DEV-${hash.substring(0, 16).toUpperCase()}`;

  localStorage.setItem(STORAGE_KEY, fingerprint);
  return fingerprint;
}

export function getClientDeviceInfo() {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.indexOf('Win') !== -1) os = 'Windows PC';
  else if (ua.indexOf('Mac') !== -1) os = 'macOS';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('like Mac') !== -1) os = 'iOS';

  return {
    osPlatform: os,
    deviceName: `${os} (${window.screen?.width || 1920}x${window.screen?.height || 1080})`,
    browserInfo: navigator.userAgent
  };
}
