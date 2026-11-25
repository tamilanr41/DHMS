#!/usr/bin/env node
/**
 * ZhanX Studio — private license generator.
 *
 * This tool is for the software publisher only. It must never be installed with the
 * clinic application, committed with the private key, or shared with customers.
 *
 * Usage:
 *   node tools/license-generator/generate.mjs issue --device ZXDC-7A91-2F83-C4D8 \
 *     --clinic "Smile Dental Clinic" --dentist "Dr. A. Kumar" \
 *     --address "12 MG Road, Kochi" --contact "+91 98450 12345" \
 *     --type perpetual --out license.json
 *
 *   node tools/license-generator/generate.mjs verify --file license.json [--device ZXDC-...]
 *   node tools/license-generator/generate.mjs public-key
 *   node tools/license-generator/generate.mjs history
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appendHistory, createLicense, loadPrivateKey, publicKeyFromPrivate, verifyLicenseFile } from './lib/issue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = path.join(__dirname, 'keys');
const DEFAULT_KEY = path.join(KEYS_DIR, 'private.pem');
const HISTORY_FILE = path.join(__dirname, 'history.json');

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1];
  return fallback;
}

function required(name) {
  const value = arg(name);
  if (!value) {
    console.error(`Missing required option --${name}`);
    process.exit(1);
  }
  return value;
}

function issue() {
  const keyPath = arg('key', process.env.ZHANX_LICENSE_PRIVATE_KEY_PATH || DEFAULT_KEY);
  if (!fs.existsSync(keyPath)) {
    console.error(`Private key not found at ${keyPath}. Keep it offline and pass --key <path>.`);
    process.exit(1);
  }
  const privateKey = loadPrivateKey(keyPath);
  const deviceId = required('device').toUpperCase();
  const clinic = required('clinic');
  const type = arg('type', 'perpetual');
  const expires = arg('expires');
  const license = createLicense({
    privateKey,
    deviceId,
    clinicName: clinic,
    dentistName: arg('dentist'),
    licenseType: type,
    expiresAt: type === 'perpetual' ? null : expires,
    features: arg('features', '*').split(',').map((f) => f.trim()).filter(Boolean)
  });

  const safeClinic = clinic.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40);
  const outFile = arg('out', `license-${safeClinic}-${license.payload.licenseId}.json`);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(license, null, 2)}\n`, { mode: 0o600 });
  appendHistory(HISTORY_FILE, {
    licenseId: license.payload.licenseId,
    deviceId,
    clinicName: clinic,
    licenseType: license.payload.licenseType,
    issuedAt: license.payload.issuedAt,
    expiresAt: license.payload.expiresAt,
    file: path.resolve(outFile)
  });
  console.log(`License written to ${path.resolve(outFile)}`);
  console.log(`License ID: ${license.payload.licenseId}`);
  console.log(`Device:     ${deviceId}`);
  console.log(`Clinic:     ${clinic}`);
  console.log('Send only the license JSON file to the clinic — never the private key.');
}

function verify() {
  const file = required('file');
  const text = fs.readFileSync(file, 'utf8');
  const publicKey = arg('public-key') || publicKeyFromPrivate(loadPrivateKey(arg('key', process.env.ZHANX_LICENSE_PRIVATE_KEY_PATH || DEFAULT_KEY)));
  const result = verifyLicenseFile({ text, publicKey, deviceId: arg('device') });
  if (!result.ok) {
    console.error(`INVALID: ${result.code} — ${result.message}`);
    process.exit(2);
  }
  console.log('Signature valid.');
  console.log(JSON.stringify(result.payload, null, 2));
}

function publicKey() {
  const privateKey = loadPrivateKey(arg('key', process.env.ZHANX_LICENSE_PRIVATE_KEY_PATH || DEFAULT_KEY));
  const encoded = publicKeyFromPrivate(privateKey);
  console.log(encoded);
  console.log(`Fingerprint: SHA-256 ${crypto.createHash('sha256').update(Buffer.from(encoded, 'base64')).digest('hex')}`);
}

function history() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.log('No licenses have been issued from this machine yet.');
    return;
  }
  const rows = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  for (const row of rows) {
    console.log(`${row.issuedAt}  ${row.licenseId}  ${row.deviceId}  ${row.clinicName}  ${row.licenseType}${row.expiresAt ? ` until ${row.expiresAt.slice(0, 10)}` : ''}`);
  }
}

const command = process.argv[2] || 'issue';
const commands = { issue, verify, 'public-key': publicKey, history };
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use issue, verify, public-key or history.`);
  process.exit(1);
}
commands[command]();
