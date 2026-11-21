import { useState } from 'react';
import { api, get, getPaged } from '../api';
import { useAuth, useToast } from '../context';
import { Async, Field, Modal, Pager, PeriodBar, Table, Tabs, periodQuery, useAsync } from '../components/ui';
import { dt, fruitEmoji, money, sizeLabel } from '../utils';

export default function Purchases() {
  const [form, setForm] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <>
      <div className="toolbar"><div className="grow" /><button className="btn" onClick={() => setForm(true)}>+ Record purchase</button></div>
      <Tabs items={[{ label: 'Purchase history', render: () => <History key={version} /> }, { label: 'Cost tracking', render: () => <CostTracking key={version} /> }]} />
      {form && <PurchaseForm onClose={() => setForm(false)} onSaved={() => setVersion((v) => v + 1)} />}
    </>
  );
}

function History() {
  const suppliers = useAsync(async () => (await getPaged('/suppliers', { limit: 200 })).data, []);
  const [sup, setSup] = useState('');
  const [per, setPer] = useState({ period: 'all' });
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const state = useAsync(() => getPaged('/purchases', { supplier_id: sup, ...periodQuery(per), page }), [sup, per, page]);
  return (
    <div className="card">
      <div className="toolbar">
        <select value={sup} onChange={(e) => { setSup(e.target.value); setPage(1); }}><option value="">All suppliers</option>{(suppliers.data || []).map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.business_name}</option>)}</select>
      </div>
      <PeriodBar all value={per} onChange={(p) => { setPer(p); setPage(1); }} />
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No purchases found." emptyIcon="🚚" cols={[
              { label: '#', render: (p) => '#' + p.purchase_id }, { label: 'Date', render: (p) => dt(p.purchase_date) }, { label: 'Supplier', render: (p) => <><b>{p.supplier_name}</b><br /><small>{p.province}</small></> },
              { label: 'Lines', align: 'r', key: 'item_count' }, { label: 'Accepted', align: 'r', key: 'boxes_accepted' }, { label: 'Rejected', align: 'r', render: (p) => (p.boxes_rejected ? <span className="neg">{p.boxes_rejected}</span> : 0) },
              { label: 'Delivery', render: (p) => (p.expected_delivery_date && p.delivery_date > p.expected_delivery_date ? <span className="badge warn">Late</span> : <span className="badge good">On time</span>) },
              { label: 'Total', align: 'r', render: (p) => money(p.total_amount) }, { label: '', render: (p) => <button className="btn ghost sm" onClick={() => setView(p.purchase_id)}>View</button> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
      {view && <PurchaseDetail id={view} onClose={() => setView(null)} />}
    </div>
  );
}

function PurchaseDetail({ id, onClose }) {
  const state = useAsync(() => get(`/purchases/${id}`), [id]);
  return (
    <Modal title={`Purchase #${id}`} onClose={onClose} wide>
      <Async state={state}>
        {(p) => (
          <>
            <p><b>{p.supplier_name}</b> ({p.province}) - {p.contact_person}, {p.phone}<br />Purchased {dt(p.purchase_date)} - expected {dt(p.expected_delivery_date)} - delivered {dt(p.delivery_date)}</p>
            <Table rows={p.items} cols={[
              { label: 'Fruit', render: (i) => <>{fruitEmoji(i.fruit_name)} {i.fruit_name}</> }, { label: 'Size', render: (i) => sizeLabel(i.packaging_size) }, { label: 'Ordered', align: 'r', key: 'quantity_ordered' }, { label: 'Delivered', align: 'r', key: 'quantity_delivered' },
              { label: 'Rejected', align: 'r', render: (i) => (i.quantity_rejected ? <span className="neg" title={i.rejection_reason || ''}>{i.quantity_rejected}</span> : 0) }, { label: 'Accepted', align: 'r', render: (i) => <b>{i.quantity}</b> },
              { label: 'Cost / box', align: 'r', render: (i) => money(i.unit_cost) }, { label: 'Line total', align: 'r', render: (i) => money(i.line_total) }
            ]} />
            <div className="totals"><div className="big"><span>Total</span><span>{money(p.total_amount)}</span></div></div>
          </>
        )}
      </Async>
    </Modal>
  );
}

function CostTracking() {
  const state = useAsync(() => get('/purchases/cost-trends'), []);
  return (
    <Async state={state}>
      {(rows) => (
        <div className="card">
          <h3>Purchase cost tracking</h3>
          <p className="hint">Previous vs current cost per box from the two most recent purchases of each fruit and size.</p>
          <Table rows={rows} emptyIcon="💲" cols={[
            { label: 'Fruit', render: (r) => <>{fruitEmoji(r.fruit_name)} {r.fruit_name}</> }, { label: 'Packaging', render: (r) => sizeLabel(r.packaging_size) }, { label: 'Last purchase', render: (r) => dt(r.purchase_date) },
            { label: 'Previous cost', align: 'r', render: (r) => (r.previous_cost === null ? '-' : money(r.previous_cost)) }, { label: 'Current cost', align: 'r', render: (r) => <b>{money(r.current_cost)}</b> },
            { label: 'Difference', align: 'r', render: (r) => (r.difference === null ? '-' : <span className={r.difference > 0 ? 'neg' : r.difference < 0 ? 'pos' : ''}>{r.difference > 0 ? '▲ +' : r.difference < 0 ? '▼ ' : ''}{money(r.difference).replace('M-', '-M')}</span>) }
          ]} />
        </div>
      )}
    </Async>
  );
}

const newRow = () => ({ key: Math.random(), fruit_id: '', packaging_size: 'SMALL', quantity_ordered: '', quantity_delivered: '', quantity_rejected: 0, unit_cost: '', expiry_date: '' });

function PurchaseForm({ onClose, onSaved }) {
  const { meta } = useAuth();
  const toast = useToast();
  const lookups = useAsync(async () => ({ suppliers: (await getPaged('/suppliers', { limit: 200 })).data, fruits: (await get('/fruits')).filter((f) => f.status === 'AVAILABLE') }), []);
  const [h, setH] = useState({ supplier_id: '', purchase_date: '', expected_delivery_date: '', delivery_date: '', notes: '' });
  const [rows, setRows] = useState([newRow(), newRow()]);
  const [busy, setBusy] = useState(false);
  const setRow = (key, k, v) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
  const n = (x) => Number(x) || 0;
  const acc = rows.reduce((t, r) => t + Math.max(n(r.quantity_delivered) - n(r.quantity_rejected), 0), 0);
  const rej = rows.reduce((t, r) => t + n(r.quantity_rejected), 0);
  const total = rows.reduce((t, r) => t + Math.max(n(r.quantity_delivered) - n(r.quantity_rejected), 0) * n(r.unit_cost), 0);

  const submit = async (e) => {
    e.preventDefault();
    const items = rows.filter((r) => r.fruit_id).map((r) => {
      const it = { fruit_id: Number(r.fruit_id), packaging_size: r.packaging_size, unit_cost: n(r.unit_cost), quantity_delivered: n(r.quantity_delivered), quantity_rejected: n(r.quantity_rejected) };
      if (r.quantity_ordered !== '') it.quantity_ordered = n(r.quantity_ordered);
      if (r.expiry_date) it.expiry_date = r.expiry_date;
      return it;
    });
    if (!h.supplier_id) return toast('Choose a supplier', 'err');
    if (!items.length) return toast('Add at least one fruit line', 'err');
    const body = { supplier_id: Number(h.supplier_id), items };
    ['purchase_date', 'expected_delivery_date', 'delivery_date', 'notes'].forEach((k) => { if (h[k]) body[k] = h[k]; });
    setBusy(true);
    try { const r = await api('/purchases', { method: 'POST', body }); toast('Purchase recorded', 'ok', `Total ${money(r.data.total_amount)} - stock updated`); onSaved(); onClose(); } catch (err) { toast(err.message, 'err', err.details); setBusy(false); }
  };

  return (
    <Modal title="Record purchase from supplier" onClose={onClose} wide>
      {!lookups.data ? <div className="empty">Loading...</div> : (
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <Field f={{ name: 'supplier_id', label: 'Supplier', type: 'select', required: true, full: true, placeholder: 'Choose supplier', options: lookups.data.suppliers.map((s) => ({ value: s.supplier_id, label: `${s.business_name} (${s.province})` })) }} value={h.supplier_id} onChange={(v) => setH({ ...h, supplier_id: v })} />
            <Field f={{ name: 'purchase_date', label: 'Purchase date', type: 'date' }} value={h.purchase_date} onChange={(v) => setH({ ...h, purchase_date: v })} />
            <Field f={{ name: 'expected_delivery_date', label: 'Expected delivery date', type: 'date' }} value={h.expected_delivery_date} onChange={(v) => setH({ ...h, expected_delivery_date: v })} />
            <Field f={{ name: 'delivery_date', label: 'Actual delivery date', type: 'date' }} value={h.delivery_date} onChange={(v) => setH({ ...h, delivery_date: v })} />
            <Field f={{ name: 'notes', label: 'Notes' }} value={h.notes} onChange={(v) => setH({ ...h, notes: v })} />
          </div>
          <h3 style={{ margin: '18px 0 6px' }}>Fruit delivered</h3>
          <div className="hint" style={{ marginBottom: 6 }}>Compare ordered, delivered and rejected boxes. Only accepted boxes are added to stock and charged.</div>
          <div className="line-item hint" style={{ fontWeight: 700 }}><span>Fruit</span><span>Size</span><span>Ordered</span><span>Delivered</span><span>Rejected</span><span>Cost / box</span><span>Expiry (optional)</span><span /></div>
          {rows.map((r) => (
            <div className="line-item" key={r.key}>
              <select value={r.fruit_id} onChange={(e) => setRow(r.key, 'fruit_id', e.target.value)}><option value="">Fruit</option>{lookups.data.fruits.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}</select>
              <select value={r.packaging_size} onChange={(e) => setRow(r.key, 'packaging_size', e.target.value)}>{meta.packaging_sizes.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}</select>
              <input type="number" min="0" placeholder="0" value={r.quantity_ordered} onChange={(e) => setRow(r.key, 'quantity_ordered', e.target.value)} />
              <input type="number" min="0" placeholder="0" value={r.quantity_delivered} onChange={(e) => setRow(r.key, 'quantity_delivered', e.target.value)} />
              <input type="number" min="0" value={r.quantity_rejected} onChange={(e) => setRow(r.key, 'quantity_rejected', e.target.value)} />
              <input type="number" step="0.01" min="0" placeholder="0.00" value={r.unit_cost} onChange={(e) => setRow(r.key, 'unit_cost', e.target.value)} />
              <input type="date" value={r.expiry_date} onChange={(e) => setRow(r.key, 'expiry_date', e.target.value)} />
              <button type="button" className="x" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>&times;</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setRows((rs) => [...rs, newRow()])}>+ Add fruit line</button>
          <div className="totals"><div><span>Accepted boxes</span><b>{acc}</b></div><div><span>Rejected boxes</span><b>{rej}</b></div><div className="big"><span>Total cost</span><span>{money(total)}</span></div></div>
          <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={busy}>Record purchase</button></div>
        </form>
      )}
    </Modal>
  );
}
