// Must be the first module evaluated in every DB test file: config/env.js reads
// process.env at import time, so these values have to exist before it loads.
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'zhanx_test';
process.env.JWT_SECRET = 'test-only-secret-value-0123456789abcdef0123456789';
process.env.BCRYPT_ROUNDS = '4';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Admin@Test123';
process.env.DATA_DIR = 'data-test';
process.env.LOG_LEVEL = 'silent';

// Disposable Ed25519 keypair used only by the automated tests. Production licenses are
// signed by tools/license-generator with a key that never leaves the publisher.
const seed = Buffer.from('d3a6c1f48b92e75a0c4d68f1b3e9a2578c5d0f4261b9e83a7c4d5f60b1e2a3c4', 'hex');
const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([pkcs8Prefix, seed]),
  format: 'der',
  type: 'pkcs8'
});
process.env.ZHANX_TEST_LICENSE_SEED = seed.toString('hex');
process.env.ZHANX_LICENSE_PUBLIC_KEY = crypto
  .createPublicKey(privateKey)
  .export({ type: 'spki', format: 'der' })
  .toString('base64');
