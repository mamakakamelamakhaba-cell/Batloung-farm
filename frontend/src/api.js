/** API client. All calls go to /api (proxied to Express in development, same origin in production). */
const BASE = import.meta.env.VITE_API_URL || '/api';
let token = localStorage.getItem('bf_token') || '';
let onUnauthorized = () => {};

export const setToken = (t) => { token = t; if (t) localStorage.setItem('bf_token', t); else localStorage.removeItem('bf_token'); };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const getStoredToken = () => token;

function qs(obj = {}) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
}

export async function api(path, { method = 'GET', body, query, raw } = {}) {
  let res;
  try {
    res = await fetch(BASE + path + qs(query), {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running (npm start in the backend folder)?');
  }
  if (raw) {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Request failed');
    return res;
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { onUnauthorized(); throw new Error('Session expired. Please log in again.'); }
  if (!res.ok) { const e = new Error(json.message || 'Request failed'); e.details = json.details; throw e; }
  return json;
}
export const get = async (path, query) => (await api(path, { query })).data;
export const getPaged = (path, query) => api(path, { query });

/** Opens (or downloads) the PDF invoice. The token is sent in the header, so we fetch it as a blob. */
export async function openPdf(saleId, download) {
  const res = await api(`/sales/${saleId}/invoice.pdf`, { raw: true, query: download ? { download: 1 } : {} });
  const url = URL.createObjectURL(await res.blob());
  if (download) { const a = document.createElement('a'); a.href = url; a.download = `invoice-${saleId}.pdf`; a.click(); } else window.open(url, '_blank');
}
