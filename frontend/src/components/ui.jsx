/** Reusable UI building blocks used by every page. */
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { PALETTE, label, money, num } from '../utils';
import { useToast } from '../context';

// ---------------- data loading ----------------
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && setState({ loading: false, data, error: null })).catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Shows loading / error states, then calls children(data). */
export function Async({ state, children }) {
  if (state.error) return <div className="card empty"><span className="big">⚠️</span><b>{state.error.message}</b><p className="hint">{/database/i.test(state.error.message) ? 'Start MySQL, check backend/.env, then try again.' : ''}</p></div>;
  if (!state.data) return <div className="empty"><span className="big">🍊</span>Loading...</div>;
  return children(state.data);
}

// ---------------- small pieces ----------------
const GOOD = ['PAID', 'NORMAL', 'FRESH', 'AVAILABLE', 'FAST', 'Excellent', 'PURCHASE', 'RETURN'];
const WARN = ['PARTIALLY_PAID', 'LOW', 'NEAR_EXPIRY', 'STEADY', 'Good', 'ADJUSTMENT', 'CORRECTION', 'Needs attention'];
const BAD = ['UNPAID', 'CRITICAL', 'EXPIRED', 'SLOW', 'Poor', 'DAMAGED', 'SPOILED', 'UNAVAILABLE', 'REFUND'];
export function Badge({ status }) {
  const cls = GOOD.includes(status) ? 'good' : WARN.includes(status) ? 'warn' : BAD.includes(status) ? 'bad' : '';
  return <span className={`badge ${cls}`}>{label(status)}</span>;
}

export const Empty = ({ icon = '🌱', children }) => <div className="empty"><span className="big">{icon}</span>{children}</div>;

export function Stat({ cls, emoji, title, children, sub }) {
  return <div className={`stat ${cls}`} data-emoji={emoji}><small>{title}</small><b>{children}</b>{sub && <small>{sub}</small>}</div>;
}

export function CountUp({ value, isMoney }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (t) => { const k = Math.min((t - start) / 900, 1); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{isMoney ? money(v) : num(Math.round(v))}</>;
}

// ---------------- modal ----------------
export function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  // Rendered through a portal so animated parent cards cannot trap the fixed backdrop.
  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">&times;</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ---------------- form controls ----------------
export function Field({ f, value, onChange }) {
  const common = { name: f.name, required: f.required, value: value ?? '' };
  let input;
  if (f.type === 'select') {
    input = (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        {f.placeholder && <option value="">{f.placeholder}</option>}
        {f.options.map((o) => { const ov = typeof o === 'object' ? o.value : o; const ol = typeof o === 'object' ? o.label : label(o); return <option key={ov} value={ov}>{ol}</option>; })}
      </select>
    );
  } else if (f.type === 'textarea') input = <textarea {...common} rows="2" onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === 'checkbox') input = <label><input type="checkbox" style={{ width: 'auto' }} checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.checkLabel}</label>;
  else input = <input {...common} type={f.type || 'text'} step={f.step} min={f.min} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className={f.full ? 'full' : ''}>
      <label className="f">{f.label}{f.required ? ' *' : ''}</label>
      {input}
      {f.hint && <div className="hint">{f.hint}</div>}
    </div>
  );
}

/** Generic form dialog. fields: [{name,label,type,options,required,full,hint,step,min,value}] */
export function FormModal({ title, fields, values = {}, submitLabel = 'Save', onSubmit, onClose, wide }) {
  const toast = useToast();
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.name, values[f.name] ?? f.value ?? (f.type === 'checkbox' ? false : '')])));
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && f.type !== 'checkbox' && String(v[f.name] ?? '').trim() === '');
    if (missing) return toast(`${missing.label} is required`, 'err');
    const data = {};
    for (const f of fields) {
      const x = v[f.name];
      if (f.type === 'checkbox') { data[f.name] = !!x; continue; }
      if (x === '' || x === undefined || x === null) continue;
      data[f.name] = f.type === 'number' ? Number(x) : typeof x === 'string' ? x.trim() : x;
    }
    setBusy(true);
    try { await onSubmit(data); onClose(); } catch (err) { toast(err.message, 'err', err.details); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">{fields.map((f) => <Field key={f.name} f={f} value={v[f.name]} onChange={(x) => setV((s) => ({ ...s, [f.name]: x }))} />)}</div>
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={busy}>{submitLabel}</button></div>
      </form>
    </Modal>
  );
}

// ---------------- tables / paging / tabs ----------------
export function Table({ cols, rows, empty = 'Nothing here yet.', emptyIcon = '🌱' }) {
  if (!rows || !rows.length) return <Empty icon={emptyIcon}>{empty}</Empty>;
  const al = (c) => (c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : '');
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map((c, i) => <th key={i} className={al(c)}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c, j) => <td key={j} className={al(c)}>{c.render ? c.render(r, i) : r[c.key] ?? '-'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Pager({ p, onPage }) {
  if (!p) return null;
  if (p.totalPages <= 1) return <div className="pager">{p.total} record(s)</div>;
  return (
    <div className="pager">
      <span>{p.total} records - page {p.page} of {p.totalPages}</span>
      <button className="btn ghost sm" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>Previous</button>
      <button className="btn ghost sm" disabled={p.page >= p.totalPages} onClick={() => onPage(p.page + 1)}>Next</button>
    </div>
  );
}

export function Tabs({ items }) {
  const [i, setI] = useState(0);
  return (
    <>
      <div className="tabs">{items.map((t, j) => <button key={j} className={i === j ? 'on' : ''} onClick={() => setI(j)}>{t.label}</button>)}</div>
      <div key={i}>{items[i].render()}</div>
    </>
  );
}

/** Today / This week / This month / Previous month / This year / Custom range. value = {period, from, to} */
export function PeriodBar({ value, onChange, all = false }) {
  const [sel, setSel] = useState(value.period || (all ? 'all' : 'month'));
  const [from, setFrom] = useState(value.from || '');
  const [to, setTo] = useState(value.to || '');
  const pick = (p) => { setSel(p); if (p !== 'custom') onChange({ period: p }); else if (from && to) onChange({ period: 'custom', from, to }); };
  const dates = (f, t) => { if (f && t) onChange({ period: 'custom', from: f, to: t }); };
  return (
    <div className="toolbar">
      <select value={sel} onChange={(e) => pick(e.target.value)}>
        {all && <option value="all">All time</option>}
        <option value="today">Today</option><option value="week">This week</option><option value="month">This month</option>
        <option value="last_month">Previous month</option><option value="year">This year</option><option value="custom">Custom range</option>
      </select>
      {sel === 'custom' && (
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); dates(e.target.value, to); }} /> to
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); dates(from, e.target.value); }} />
        </span>
      )}
    </div>
  );
}
/** Converts a PeriodBar value into API query parameters. */
export const periodQuery = (v) => (v.period === 'custom' ? { period: 'custom', from: v.from, to: v.to } : v.period === 'all' ? {} : { period: v.period });

// ---------------- charts ----------------
export function HBars({ data, fmt = num }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 60); return () => clearTimeout(t); }, []);
  if (!data.length) return <Empty>No data for this period.</Empty>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return data.map((d, i) => (
    <div className="hbar" key={i}>
      <span>{d.label}</span>
      <div className="track"><div className="fill" style={{ width: ready ? `${(d.value / max) * 100}%` : 0, background: PALETTE[i % PALETTE.length] }} /></div>
      <b className="r">{fmt(d.value)}</b>
    </div>
  ));
}

export function LineChart({ points, fmt = money, color = '#F77F00' }) {
  const gid = useId().replace(/:/g, '');
  if (!points.length) return <Empty>No sales in this period.</Empty>;
  const W = 640, H = 220, P = 34;
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1));
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)} ${H - P} L${x(0)} ${H - P} Z`;
  const step = Math.ceil(points.length / 8);
  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((t) => (
        <g key={t}><line x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="#e3ebdd" /><text x={P - 4} y={y(max * t) + 4} textAnchor="end">{num(Math.round(max * t))}</text></g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path className="draw" d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle className="dot" cx={x(i)} cy={y(p.value)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5"><title>{`${p.label}: ${fmt(p.value)}`}</title></circle>
          {i % step === 0 && <text x={x(i)} y={H - 10} textAnchor="middle">{String(p.label).slice(5) || p.label}</text>}
        </g>
      ))}
    </svg>
  );
}
