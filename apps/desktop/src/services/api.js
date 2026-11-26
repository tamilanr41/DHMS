let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

const desktop = () => window.zhanx || null;

export function getServerBase() {
  const override = import.meta.env.VITE_API_URL;
  if (override) return override.replace(/\/$/, '');
  const desktopUrl = desktop()?.getServerUrl?.();
  if (desktopUrl) return `${desktopUrl.replace(/\/$/, '')}/api`;
  return '/api';
}

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = payload?.error?.code;
    this.details = payload?.error?.details;
    this.payload = payload;
  }
}

async function rawFetch(path, { method = 'GET', body, headers = {}, signal, isForm = false } = {}) {
  const opts = { method, headers: { ...headers }, signal };
  if (accessToken) opts.headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined && !isForm) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (isForm) {
    opts.body = body;
  }
  let res;
  try {
    res = await fetch(`${getServerBase()}${path}`, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: { message: 'Cannot reach the clinic server. Check the network connection and server address.', code: 'NETWORK_ERROR' } });
  }
  return res;
}

let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) throw new ApiError(401, { error: { message: 'No session', code: 'UNAUTHORIZED' } });
    const res = await rawFetch('/auth/refresh', { method: 'POST', body: { refreshToken } });
    if (!res.ok) {
      await clearStoredTokens();
      throw new ApiError(401, { error: { message: 'Session expired', code: 'UNAUTHORIZED' } });
    }
    const json = await res.json();
    accessToken = json.data.accessToken;
    await storeRefreshToken(json.data.refreshToken);
    return json.data;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function request(path, options = {}, retry = true) {
  const res = await rawFetch(path, options);
  if (res.status === 401 && retry && path !== '/auth/login' && path !== '/auth/refresh') {
    try {
      await refreshAccessToken();
      return request(path, options, false);
    } catch {
      onUnauthorized?.();
      throw new ApiError(401, { error: { message: 'Your session has expired. Please sign in again.', code: 'UNAUTHORIZED' } });
    }
  }
  if (res.status === 204) return null;
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 300) } };
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData, isForm: true }),
  async blob(path) {
    const res = await rawFetch(path);
    if (res.status === 401) {
      await refreshAccessToken();
      const retryRes = await rawFetch(path);
      if (!retryRes.ok) {
        let errMsg = `Request failed (${retryRes.status})`;
        try {
          const errJson = await retryRes.json();
          if (errJson?.error?.message) errMsg = errJson.error.message;
        } catch {}
        throw new ApiError(retryRes.status, { message: errMsg });
      }
      return retryRes.blob();
    }
    if (!res.ok) {
      let errMsg = `Request failed (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch {}
      throw new ApiError(res.status, { message: errMsg });
    }
    return res.blob();
  }
};

export async function openBlob(path, fileName) {
  const blob = await api.blob(path);
  if (desktop()?.openPdf) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await desktop().openPdf(bytes, fileName);
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadBlob(path, fileName) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ---------- refresh token persistence ---------- */
const LS_KEY = 'zhanx.refreshToken';

export async function getStoredRefreshToken() {
  if (desktop()?.getRefreshToken) {
    try {
      return await desktop().getRefreshToken();
    } catch {
      return null;
    }
  }
  return localStorage.getItem(LS_KEY);
}

export async function storeRefreshToken(token) {
  if (desktop()?.saveRefreshToken) {
    await desktop().saveRefreshToken(token);
    return;
  }
  localStorage.setItem(LS_KEY, token);
}

export async function clearStoredTokens() {
  accessToken = null;
  if (desktop()?.clearRefreshToken) {
    await desktop().clearRefreshToken();
    return;
  }
  localStorage.removeItem(LS_KEY);
}
