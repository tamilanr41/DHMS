import { app, BrowserWindow, dialog, ipcMain, shell, safeStorage, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.setName('ZhanX DentalCare');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_URL);

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'server-config.json');
const SESSION_FILE = () => path.join(app.getPath('userData'), 'session.bin');
const PRINT_DIR = () => path.join(app.getPath('temp'), 'zhanx-prints');

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { serverUrl: 'http://127.0.0.1:4000' };
  }
}

function writeConfig(next) {
  fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(next, null, 2), 'utf8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#f5f7fa',
    title: 'ZhanX DentalCare',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => win.show());

  // The renderer blocks unload (beforeunload) while a form has unsaved edits. Electron
  // does not prompt on its own, so ask natively and let the user keep editing.
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Stay', 'Discard changes and close'],
      defaultId: 0,
      cancelId: 0,
      title: 'Unsaved changes',
      message: 'You have unsaved changes.',
      detail: 'Closing or reloading now will discard them.'
    });
    if (choice === 1) event.preventDefault(); // preventDefault => proceed with unload
  });

  // Keep the branded title; the page <title> must not replace it.
  win.on('page-title-updated', (e) => e.preventDefault());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || (isDev && url.startsWith(DEV_URL))) return { action: 'allow' };
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://') || (isDev && url.startsWith(DEV_URL))) return;
    event.preventDefault();
    if (url.startsWith('http')) shell.openExternal(url);
  });

  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    const entry = path.join(__dirname, '..', 'dist', 'index.html');
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[zhanx] failed to load ${url}: ${desc} (${code})`);
    });
    win.loadURL(pathToFileURL(entry).href);
  }

  return win;
}

function installCsp() {
  // Vite injects an inline React Refresh preamble in dev; production builds ship
  // only external scripts, so the shipped policy stays strict.
  const devScript = isDev ? " 'unsafe-inline' 'unsafe-eval'" : '';
  const policy = [
    "default-src 'self'",
    `script-src 'self'${devScript}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } });
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    installCsp();

    ipcMain.handle('zhanx:get-server-url', () => readConfig().serverUrl || 'http://127.0.0.1:4000');

    ipcMain.on('zhanx:get-server-url-sync', (event) => {
      event.returnValue = readConfig().serverUrl || 'http://127.0.0.1:4000';
    });

    ipcMain.handle('zhanx:set-server-url', (_e, rawUrl) => {
      const url = String(rawUrl || '').trim().replace(/\/+$/, '');
      if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Server address must start with http:// or https://');
      writeConfig({ ...readConfig(), serverUrl: url });
      return url;
    });

    ipcMain.handle('zhanx:test-connection', async (_e, rawUrl) => {
      const base = String(rawUrl || readConfig().serverUrl || '').replace(/\/+$/, '').replace(/\/api$/, '');
      const started = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${base}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
        const body = await res.json().catch(() => null);
        return { ok: res.ok && body?.status === 'ok', status: res.status, latencyMs: Date.now() - started, base };
      } catch (err) {
        return { ok: false, error: err.name === 'AbortError' ? 'Connection timed out' : 'Server unreachable', latencyMs: Date.now() - started, base };
      }
    });

    ipcMain.handle('zhanx:get-refresh-token', () => {
      try {
        if (!fs.existsSync(SESSION_FILE())) return null;
        const buf = fs.readFileSync(SESSION_FILE());
        if (!safeStorage.isEncryptionAvailable()) return buf.toString('utf8');
        return safeStorage.decryptString(buf);
      } catch {
        return null;
      }
    });

    ipcMain.handle('zhanx:save-refresh-token', (_e, token) => {
      if (!token) return false;
      fs.mkdirSync(path.dirname(SESSION_FILE()), { recursive: true });
      const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(token)) : Buffer.from(String(token), 'utf8');
      fs.writeFileSync(SESSION_FILE(), data);
      return true;
    });

    ipcMain.handle('zhanx:clear-refresh-token', () => {
      try {
        if (fs.existsSync(SESSION_FILE())) fs.unlinkSync(SESSION_FILE());
      } catch {
        /* ignore */
      }
      return true;
    });

    ipcMain.handle('zhanx:open-pdf', async (_e, bytes, fileName) => {
      const dir = PRINT_DIR();
      fs.mkdirSync(dir, { recursive: true });
      const safeName = String(fileName || 'document.pdf').replace(/[^\w.\-]+/g, '_');
      const target = path.join(dir, safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`);
      fs.writeFileSync(target, Buffer.from(bytes));
      const err = await shell.openPath(target);
      if (err) throw new Error(err);
      return target;
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
