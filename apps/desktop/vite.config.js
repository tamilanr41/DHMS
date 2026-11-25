import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// The CSP meta tag protects the packaged app (file:// responses skip the Electron
// header hook), but it would block Vite's inline refresh preamble in dev; Electron
// still applies the session header policy while developing.
const stripCspMetaInDev = {
  name: 'zhanx-strip-csp-meta-in-dev',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(/[ \t]*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>[ \t]*\r?\n?/i, '');
  }
};

export default defineConfig({
  plugins: [react(), stripCspMetaInDev],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
        // The API applies a strict CORS allow-list. In development the renderer is
        // served from a port that may not be listed (for example a second Vite
        // instance). Same-origin proxy requests do not need an Origin header, so
        // strip it before forwarding to keep local previews working.
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  }
});
