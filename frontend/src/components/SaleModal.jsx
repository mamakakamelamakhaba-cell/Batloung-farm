import { useRef, useState } from 'react';
import { api, get, openPdf } from '../api';
import { useAuth, useToast } from '../context';
import { Async, Badge, FormModal, Modal, Table, useAsync } from './ui';
import { dt, fruitEmoji, label, money, printHtml, sizeLabel } from '../utils';

/** Invoice / sale detail with PDF download, print, extra payments and returns. */
export default function SaleModal({ id, onClose, onChanged = () => {} }) {
  const { meta } = useAuth();
  const toast = useToast();
  const state = useAsync(() => get(`/sales/${id}`), [id]);
  const printRef = useRef(null);
  const [dialog, setDialog] = useState(null);
  const s = state.data;
  const changed = () => { state.reload(); onChanged(); };
  const pdf = (download) => openPdf(id, download).catch((e) => toast(e.message, 'err'));

  return (
    <Modal title={s ? `Invoice ${s.invoice_number}` : 'Invoice'} onClose={onClose} wide>
      <Async state={state}>
        {(s) => (
          <>
            <div ref={printRef}>
              <div className="invoice-head">
                <div><h3>Batloung Farm</h3><div>Invoice {s.invoice_number}<br />{s.vendor_name} - {s.location}<br />{s.phone_number}</div></div>
                <div style={{ textAlign: 'right' }}>Date: {dt(s.sale_date)}<br />Due: {dt(s.due_date)}<br /><Badge status={s.payment_status} /><br />Method: {label(s.payment_method)}</div>
              </div>
              <Table rows={s.items} cols={[
                { label: 'Fruit', render: (i) => <>{fruitEmoji(i.fruit_name)} {i.fruit_name}</> }, { label: 'Packaging', render: (i) => sizeLabel(i.packaging_size) }, { label: 'Qty', align: 'r', key: 'quantity' },
                { label: 'Unit price', align: 'r', render: (i) => money(i.unit_price) }, { label: 'Line total', align: 'r', render: (i) => money(i.line_total) }, { label: 'Returned', align: 'r', render: (i) => i.returned_quantity || '' }
              ]} />
              <div className="totals">
                <div><span>Sale total</span><span>{money(s.total_amount)}</span></div>
                {s.returned_amount > 0 && <div><span>Returns / credits</span><span className="neg">-{money(s.returned_amount)}</span></div>}
                <div><span>Net amount</span><span>{money(s.net_amount)}</span></div>
                <div><span>Amount paid</span><span className="pos">{money(s.amount_paid)}</span></div>
                <div className="big"><span>Balance due</span><span className={s.balance_due > 0 ? 'neg' : 'pos'}>{money(s.balance_due)}</span></div>
              </div>
              {s.payments.length > 0 && (
                <>
                  <h3 style={{ marginTop: 14 }}>Payments</h3>
                  <Table rows={s.payments} cols={[
                    { label: 'Date', render: (p) => dt(p.payment_date) }, { label: 'Type', render: (p) => <Badge status={p.payment_type} /> }, { label: 'Method', render: (p) => label(p.payment_method) },
                    { label: 'Reference', render: (p) => p.reference_number || '-' }, { label: 'Amount', align: 'r', render: (p) => `${p.payment_type === 'REFUND' ? '-' : ''}${money(p.amount)}` }
                  ]} />
                </>
              )}
              {s.returns.length > 0 && (
                <>
                  <h3 style={{ marginTop: 14 }}>Returns</h3>
                  <Table rows={s.returns} cols={[
                    { label: 'Date', render: (r) => dt(r.return_date) }, { label: 'Item', render: (r) => `${r.quantity} x ${r.fruit_name} ${sizeLabel(r.packaging_size)}` }, { label: 'Reason', key: 'reason' },
                    { label: 'Restocked', align: 'r', key: 'restocked_quantity' }, { label: 'Credit adj.', align: 'r', render: (r) => money(r.credit_adjustment) }, { label: 'Cash refund', align: 'r', render: (r) => money(r.cash_refund) }
                  ]} />
                </>
              )}
            </div>
            <div className="modal-foot no-print">
              <button className="btn green" onClick={() => pdf(true)}>Download PDF</button>
              <button className="btn ghost" onClick={() => pdf(false)}>Open PDF</button>
              <button className="btn ghost" onClick={() => printHtml(s.invoice_number, printRef.current.innerHTML) || toast('Allow pop-ups to print', 'err')}>Print</button>
              {s.balance_due > 0 && <button className="btn" onClick={() => setDialog('pay')}>Add payment</button>}
              {s.items.some((i) => i.returnable_quantity > 0) && <button className="btn red" onClick={() => setDialog('return')}>Return items</button>}
            </div>
            {dialog === 'pay' && (
              <FormModal
                title={`Payment for ${s.invoice_number}`} submitLabel="Record payment" values={{ amount: s.balance_due }} onClose={() => setDialog(null)}
                fields={[
                  { name: 'amount', label: 'Amount (M)', type: 'number', step: '0.01', min: 0, required: true, hint: `Balance due ${money(s.balance_due)}` },
                  { name: 'payment_method', label: 'Method', type: 'select', options: meta.payment_methods, required: true, placeholder: 'Choose method' }, { name: 'reference_number', label: 'Reference' }
                ]}
                onSubmit={async (d) => { await api(`/sales/${id}/payments`, { method: 'POST', body: d }); toast('Payment recorded'); changed(); }}
              />
            )}
            {dialog === 'return' && <ReturnForm sale={s} onClose={() => setDialog(null)} onSaved={changed} />}
          </>
        )}
      </Async>
    </Modal>
  );
}

function ReturnForm({ sale, onClose, onSaved }) {
  const toast = useToast();
  const lines = sale.items.filter((i) => i.returnable_quantity > 0);
  const [qty, setQty] = useState({});
  const [good, setGood] = useState({});
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('CASH');
  const value = lines.reduce((t, i) => t + (Number(qty[i.sales_detail_id]) || 0) * i.unit_price, 0);

  const submit = async (e) => {
    e.preventDefault();
    const items = lines.map((i) => ({ sales_detail_id: i.sales_detail_id, quantity: Number(qty[i.sales_detail_id]) || 0, reason: reason.trim(), restock: !!good[i.sales_detail_id] })).filter((i) => i.quantity > 0);
    if (!items.length) return toast('Enter the number of boxes returned', 'err');
    if (!reason.trim()) return toast('Reason for return is required', 'err');
    try { await api('/returns', { method: 'POST', body: { sale_id: sale.sale_id, refund_method: method, items } }); toast('Return recorded', 'ok', 'Vendor balance adjusted'); onSaved(); onClose(); } catch (err) { toast(err.message, 'err', err.details); }
  };
  return (
    <Modal title={`Return items - ${sale.invoice_number}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="hint">Choose the boxes the vendor is returning. Tick "good condition" only if the fruit can go back into available stock (expired batches are never restocked).</p>
        {lines.map((i) => (
          <div className="line-item sale" key={i.sales_detail_id}>
            <div><label className="f">Item</label><b>{fruitEmoji(i.fruit_name)} {i.fruit_name}</b> - {sizeLabel(i.packaging_size)}<div className="hint">{money(i.unit_price)} each, {i.returnable_quantity} returnable</div></div>
            <div><label className="f">Boxes returned</label><input type="number" min="0" max={i.returnable_quantity} value={qty[i.sales_detail_id] ?? 0} onChange={(e) => setQty({ ...qty, [i.sales_detail_id]: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label className="f">Condition</label><label><input type="checkbox" style={{ width: 'auto' }} checked={!!good[i.sales_detail_id]} onChange={(e) => setGood({ ...good, [i.sales_detail_id]: e.target.checked })} /> Good condition - return to stock</label></div>
          </div>
        ))}
        <div className="form-grid">
          <div className="full"><label className="f">Reason for return *</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged on arrival" required /></div>
          <div><label className="f">Refund method (if money goes back)</label><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option></select></div>
        </div>
        <div className="totals"><div className="big"><span>Refund / credit value</span><span>{money(value)}</span></div></div>
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn red" type="submit">Record return</button></div>
      </form>
    </Modal>
  );
}
