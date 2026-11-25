import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler, getStoredRefreshToken, storeRefreshToken, clearStoredTokens, refreshAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [sessionNotice, setSessionNotice] = useState(null);

  const signOutLocal = useCallback(async () => {
    await clearStoredTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSessionNotice('Your session expired. Please sign in again.');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getStoredRefreshToken();
        if (!token) return;
        const data = await refreshAccessToken();
        if (!cancelled) setUser(data.user);
      } catch {
        await clearStoredTokens();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const data = res.data;
    setAccessToken(data.accessToken);
    await storeRefreshToken(data.refreshToken);
    setUser(data.user);
    setSessionNotice(null);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const token = await getStoredRefreshToken();
    try {
      await api.post('/auth/logout', { refreshToken: token });
    } catch {
      /* best-effort */
    }
    await signOutLocal();
  }, [signOutLocal]);

  const refreshProfile = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    return res.data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      sessionNotice,
      login,
      logout,
      refreshProfile,
      can: (permission) => Boolean(user?.permissions?.includes(permission)),
      has: (permission) => Boolean(user?.permissions?.includes(permission)),
      hasAny: (...permissions) => permissions.some((p) => user?.permissions?.includes(p))
    }),
    [user, booting, sessionNotice, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
