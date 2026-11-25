import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keysDir = path.join(__dirname, 'keys');
const privateKeyPath = path.join(keysDir, 'private.pem');

fs.mkdirSync(keysDir, { recursive: true });

if (!fs.existsSync(privateKeyPath)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const pubBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  console.log('KEY_GENERATED');
  console.log('PUBLIC_KEY=' + pubBase64);
} else {
  const pem = fs.readFileSync(privateKeyPath, 'utf8');
  const privateKey = crypto.createPrivateKey({ key: pem, format: 'pem' });
  const pubBase64 = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
  console.log('KEY_EXISTS');
  console.log('PUBLIC_KEY=' + pubBase64);
}
