import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from '../config/env.js';

const DEVICE_VERSION = 'zhanx-device/1';
const SECRET_FILE_VERSION = 1;

let cached = null;

function run(command, args) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (result.status !== 0 || typeof result.stdout !== 'string') return null;
    return result.stdout;
  } catch {
    return null;
  }
}

// Machine GUID and volume serial are the least volatile identifiers Windows exposes
// without collecting serial numbers of individual components. IP and MAC addresses
// are deliberately excluded: both change routinely (DHCP, Wi-Fi adapters, VPNs).
function readMachineGuid() {
  if (process.platform !== 'win32') return null;
  const output = run('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
  const match = output && /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(output);
  return match ? normalize(match[1]) : null;
}

function readVolumeSerial() {
  if (process.platform !== 'win32') return null;
  const output = run('cmd.exe', ['/d', '/c', 'vol', 'C:']);
  const match = output && /([0-9A-F]{4}-[0-9A-F]{4})/i.exec(output);
  return match ? normalize(match[1]) : null;
}

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function protectWithDpapi(buffer, scope = 'CurrentUser') {
  if (process.platform !== 'win32') return null;
  const script =
    'Add-Type -AssemblyName System.Security; ' +
    `$b=[Convert]::FromBase64String('${buffer.toString('base64')}'); ` +
    '$p=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,' +
    `[System.Security.Cryptography.DataProtectionScope]::${scope}); ` +
    '[Convert]::ToBase64String($p)';
  const output = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const value = output && output.trim();
  return value ? Buffer.from(value, 'base64') : null;
}

function unprotectWithDpapi(buffer, scope = 'CurrentUser') {
  if (process.platform !== 'win32') return null;
  const script =
    'Add-Type -AssemblyName System.Security; ' +
    `$b=[Convert]::FromBase64String('${buffer.toString('base64')}'); ` +
    '$p=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,' +
    `[System.Security.Cryptography.DataProtectionScope]::${scope}); ` +
    '[Convert]::ToBase64String($p)';
  const output = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  const value = output && output.trim();
  return value ? Buffer.from(value, 'base64') : null;
}

function secretFilePath() {
  return path.join(config.dataDir, 'device', 'installation.secret');
}

function createSecretRecord() {
  const secret = crypto.randomBytes(32);
  // LocalMachine scope, not CurrentUser: the API runs as a scheduled task under SYSTEM,
  // which cannot decrypt a CurrentUser blob written by the installing administrator.
  const machineBlob = protectWithDpapi(secret, 'LocalMachine');
  if (machineBlob) {
    return { version: SECRET_FILE_VERSION, protection: 'dpapi-machine', data: machineBlob.toString('base64'), secret };
  }
  const userBlob = protectWithDpapi(secret, 'CurrentUser');
  if (userBlob) {
    return { version: SECRET_FILE_VERSION, protection: 'dpapi-user', data: userBlob.toString('base64'), secret };
  }
  // DPAPI is unavailable (non-Windows dev machine or locked-down policy). The file is
  // owner-readable only; device identity still works and is restored on reactivation.
  console.warn('[licensing] DPAPI unavailable; installation secret is stored with file permissions only');
  return { version: SECRET_FILE_VERSION, protection: 'file', data: secret.toString('base64'), secret };
}

function loadSecret() {
  const filePath = secretFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (record.version !== SECRET_FILE_VERSION || typeof record.data !== 'string') throw new Error('unsupported secret format');
      const blob = Buffer.from(record.data, 'base64');
      if (record.protection === 'dpapi-machine') {
        const secret = unprotectWithDpapi(blob, 'LocalMachine');
        if (!secret) throw new Error('DPAPI could not decrypt the secret');
        return { secret, protection: 'dpapi-machine', reset: false };
      }
      if (record.protection === 'dpapi' || record.protection === 'dpapi-user') {
        const secret = unprotectWithDpapi(blob, 'CurrentUser');
        if (!secret) throw new Error('DPAPI could not decrypt the secret');
        // Migrate the legacy user-scoped blob to machine scope in place. The secret itself
        // is unchanged, so the Device ID and any existing license keep working while the
        // SYSTEM service account gains the ability to read it.
        const upgraded = protectWithDpapi(secret, 'LocalMachine');
        if (upgraded) {
          writeSecret({ version: SECRET_FILE_VERSION, protection: 'dpapi-machine', data: upgraded.toString('base64') });
          return { secret, protection: 'dpapi-machine', reset: false };
        }
        return { secret, protection: 'dpapi-user', reset: false };
      }
      return { secret: blob, protection: 'file', reset: false };
    } catch (err) {
      // A corrupted or no-longer-decryptable secret yields a new identity. Activation
      // then fails the device check and the clinic re-requests a license — it never
      // bypasses licensing silently.
      console.warn(`[licensing] installation secret unreadable (${err.message}); generating a new device identity`);
      const regenerated = createSecretRecord();
      writeSecret(regenerated);
      return { secret: regenerated.secret, protection: regenerated.protection, reset: true };
    }
  }
  const created = createSecretRecord();
  writeSecret(created);
  return { secret: created.secret, protection: created.protection, reset: false };
}

function writeSecret(record) {
  const filePath = secretFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ version: record.version, protection: record.protection, data: record.data }), {
    mode: 0o600
  });
  fs.renameSync(temp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* best-effort on Windows */
  }
}

function deviceIdFrom(signals, secret) {
  const material = [DEVICE_VERSION, signals.machineGuid || '-', signals.volumeSerial || '-', secret.toString('hex')].join('|');
  const digest = crypto.createHash('sha256').update(material).digest('hex').slice(0, 12).toUpperCase();
  return `ZXDC-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
}

export async function getDeviceIdentity({ refresh = false } = {}) {
  if (cached && !refresh) return cached;
  const signals = { machineGuid: readMachineGuid(), volumeSerial: readVolumeSerial() };
  const { secret, protection, reset } = loadSecret();
  const identity = {
    deviceId: deviceIdFrom(signals, secret),
    signals: { machineGuid: Boolean(signals.machineGuid), volumeSerial: Boolean(signals.volumeSerial) },
    protection,
    secretReset: reset
  };
  cached = identity;
  return identity;
}

export function resetDeviceIdentityCache() {
  cached = null;
}
