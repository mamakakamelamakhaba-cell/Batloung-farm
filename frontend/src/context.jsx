import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, get, getStoredToken, setToken, setUnauthorizedHandler } from './api';

// ---------------- toasts ----------------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((msg, type = 'ok', detail) => {
    const id = Math.random();
    const text = Array.isArray(detail) ? detail.join(' | ') : typeof detail === 'string' ? detail : '';
    setItems((l) => [...l, { id, msg, type, text }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), type === 'err' ? 7000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'toast' + (t.type === 'err' ? ' err' : '')}>
            {t.msg}
            {t.text && <small>{t.text}</small>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------- authentication + lookup data ----------------
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(getStoredToken());
  const [admin, setAdmin] = useState(localStorage.getItem('bf_admin') || '');
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const logout = useCallback(() => {
    setToken(''); localStorage.removeItem('bf_admin');
    setTok(''); setAdmin(''); setMeta(null);
    window.location.hash = '#/home';
  }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const login = async (username, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { username, password } });
    setToken(r.data.token); localStorage.setItem('bf_admin', r.data.admin.username);
    setTok(r.data.token); setAdmin(r.data.admin.username);
    return r.data.admin;
  };

  useEffect(() => {
    if (!token) return;
    setMetaError('');
    get('/meta').then(setMeta).catch((e) => setMetaError(e.message));
  }, [token]);

  return <AuthCtx.Provider value={{ token, admin, meta, metaError, login, logout }}>{children}</AuthCtx.Provider>;
}

// ---------------- hash router (no extra library needed) ----------------
export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/');
  const [parts, setParts] = useState(read());
  useEffect(() => {
    const h = () => { setParts(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return parts;
}
