import { useState } from 'react';
import { api, get, getPaged, openPdf } from '../api';
import { useAuth, useToast } from '../context';
import { Async, Badge, Modal, Pager, PeriodBar, Table, periodQuery, useAsync, useDebounced } from '../components/ui';
import SaleModal from '../components/SaleModal';
import { dt, money, sizeLabel } from '../utils';

export default function Sales() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [per, setPer] = useState({ period: 'all' });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // 'new' | {sale:id}
  const search = useDebounced(q);
  const state = useAsync(() => getPaged('/sales', { search, payment_status: st, ...periodQuery(per), page }), [search, st, per, page]);
  return (
    <div className="card">
      <div className="toolbar">
        <input className="grow" placeholder="Search invoice number or vendor..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }}><option value="">All payment statuses</option><option value="PAID">Paid</option><option value="PARTIALLY_PAID">Partially paid</option><option value="UNPAID">Unpaid</option></select>
        <button className="btn" onClick={() => setDialog('new')}>+ New sale</button>
      </div>
      <PeriodBar all value={per} onChange={(p) => { setPer(p); setPage(1); }} />
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No sales found." emptyIcon="🧾" cols={[
              { label: 'Invoice', render: (s) => <a href="#open" onClick={(e) => { e.preventDefault(); setDialog({ sale: s.sale_id }); }}><b>{s.invoice_number}</b></a> }, { label: 'Date', render: (s) => dt(s.sale_date) }, { label: 'Vendor', key: 'vendor_name' },
              { label: 'Boxes', align: 'r', key: 'total_boxes' }, { label: 'Total', align: 'r', render: (s) => money(s.total_amount) }, { label: 'Paid', align: 'r', render: (s) => money(s.amount_paid) },
              { label: 'Balance', align: 'r', render: (s) => <span className={s.balance_due > 0 ? 'neg' : ''}>{money(s.balance_due)}</span> }, { label: 'Status', render: (s) => <Badge status={s.payment_status} /> },
              { label: '', render: (s) => <button className="btn ghost sm" onClick={() => openPdf(s.sale_id).catch((e) => toast(e.message, 'err'))}>PDF</button> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
      {dialog === 'new' && <SaleForm onClose={() => setDialog(null)} onSaved={(sale) => { state.reload(); setDialog({ sale: sale.sale_id }); }} />}
      {dialog && dialog.sale && <SaleModal id={dialog.sale} onClose={() => setDialog(null)} onChanged={state.reload} />}
    </div>
  );
}

const newRow = () => ({ key: Math.random(), fruit_id: '', packaging_size: 'SMALL', quantity: 1 });

function SaleForm({ onClose, onSaved }) {
  const { meta } = useAuth();
  const toast = useToast();
  const lookups = useAsync(async () => ({ vendors: (await getPaged('/vendors', { limit: 200 })).data, fruits: (await get('/fruits')).filter((f) => f.status === 'AVAILABLE') }), []);
  const [vendorId, setVendorId] = useState('');
  const [rows, setRows] = useState([newRow()]);
  const [method, setMethod] = useState('CASH');
  const [paidText, setPaidText] = useState('');
  const [touched, setTouched] = useState(false);
  const [terms, setTerms] = useState(14);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const setRow = (key, k, v) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)));

  const fruits = lookups.data ? lookups.data.fruits : [];
  const vendor = lookups.data ? lookups.data.vendors.find((v) => String(v.vendor_id) === String(vendorId)) : null;
  const priced = rows.map((r) => {
    const f = fruits.find((x) => String(x.fruit_id) === String(r.fruit_id));
    const price = f && f.prices[r.packaging_size] !== undefined ? f.prices[r.packaging_size] : null;
    const stock = f && f.stock[r.packaging_size] ? f.stock[r.packaging_size].available : 0;
    return { ...r, f, price, stock, q: Number(r.quantity) || 0 };
  });
  const total = priced.reduce((t, r) => t + (r.price ? r.price * r.q : 0), 0);
  const paid = method === 'CREDIT' ? 0 : touched ? Number(paidText) || 0 : total;
  const credit = Math.max(total - paid, 0);

  const submit = async (e) => {
    e.preventDefault();
    const items = rows.filter((r) => r.fruit_id).map((r) => ({ fruit_id: Number(r.fruit_id), packaging_size: r.packaging_size, quantity: Number(r.quantity) }));
    if (!vendorId) return toast('Choose a vendor', 'err');
    if (!items.length) return toast('Add at least one fruit', 'err');
    const body = { vendor_id: Number(vendorId), payment_method: method, items, payment_terms_days: Number(terms || 14) };
    if (method !== 'CREDIT' && touched && paidText !== '') body.amount_paid = Number(paidText);
    if (reference) body.reference_number = reference;
    setBusy(true);
    try { const r = await api('/sales', { method: 'POST', body }); toast('Sale completed', 'ok', `${r.data.invoice_number} - ${money(r.data.total_amount)}`); onClose(); onSaved(r.data); } catch (err) { toast(err.message, 'err', err.details); setBusy(false); }
  };

  return (
    <Modal title="New sale to vendor" onClose={onClose} wide>
      {!lookups.data ? <div className="empty">Loading...</div> : (
        <form onSubmit={submit} noValidate>
          <div className="form-grid"><div className="full">
            <label className="f">Vendor *</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">Choose registered vendor</option>{lookups.data.vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name} - {v.phone_number}</option>)}</select>
            <div className="hint">{vendor && <>Credit limit {money(vendor.credit_limit)} - owes {money(vendor.outstanding_balance)} - <b>{money(vendor.available_credit)} available</b></>}</div>
          </div></div>
          <h3 style={{ margin: '16px 0 6px' }}>Boxes sold</h3>
          {priced.map((r) => (
            <div className="line-item sale" key={r.key}>
              <div><label className="f">Fruit</label><select value={r.fruit_id} onChange={(e) => setRow(r.key, 'fruit_id', e.target.value)}><option value="">Choose fruit</option>{fruits.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}</select></div>
              <div><label className="f">Size</label><select value={r.packaging_size} onChange={(e) => setRow(r.key, 'packaging_size', e.target.value)}>{meta.packaging_sizes.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}</select></div>
              <div><label className="f">Boxes</label><input type="number" min="1" value={r.quantity} onChange={(e) => setRow(r.key, 'quantity', e.target.value)} /></div>
              <div className="hint" style={{ paddingBottom: 8 }}>
                {!r.fruit_id ? 'Pick a fruit' : r.price === null ? <span className="neg">No price set</span> : <>{money(r.price)} each = <b>{money(r.price * r.q)}</b><br /><span className={r.q > r.stock ? 'neg' : ''}>{r.stock} in stock</span></>}
              </div>
              <button type="button" className="x" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>&times;</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setRows((rs) => [...rs, newRow()])}>+ Add fruit</button>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <div><label className="f">Payment method</label><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="CREDIT">Credit (pay later)</option></select></div>
            <div><label className="f">Amount paid now (M)</label><input type="number" step="0.01" min="0" disabled={method === 'CREDIT'} value={method === 'CREDIT' ? '' : touched ? paidText : total ? total.toFixed(2) : ''} onChange={(e) => { setTouched(true); setPaidText(e.target.value); }} /><div className="hint">Anything unpaid goes on the vendor's credit.</div></div>
            <div><label className="f">Payment terms (days)</label><input type="number" min="0" value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
            <div><label className="f">Reference (mobile money)</label><input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <div className="totals"><div><span>Total (calculated automatically)</span><b>{money(total)}</b></div><div><span>Paid now</span><b>{money(paid)}</b></div><div className="big"><span>On credit</span><span>{money(credit)}</span></div></div>
          <div className="hint" style={{ textAlign: 'right' }}>{vendor && credit > vendor.available_credit && <span className="neg">Credit of {money(credit)} is more than the available {money(vendor.available_credit)}. The sale will be rejected.</span>}</div>
          <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={busy}>Complete sale</button></div>
        </form>
      )}
    </Modal>
  );
}
