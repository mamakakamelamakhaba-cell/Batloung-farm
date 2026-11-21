import { useRef, useState } from 'react';
import { get } from '../api';
import { useToast } from '../context';
import { Async, Badge, HBars, Modal, PeriodBar, Stat, Table, periodQuery, useAsync } from '../components/ui';
import SaleModal from '../components/SaleModal';
import VendorPaymentForm from '../components/VendorPaymentForm';
import { VendorForm } from './Vendors';
import { dt, fruitEmoji, label, money, printHtml, sizeLabel } from '../utils';

export default function VendorProfile({ id }) {
  const state = useAsync(() => get(`/vendors/${id}/profile`), [id]);
  const [dialog, setDialog] = useState(null); // 'edit' | 'pay' | 'statement' | {sale: id}
  return (
    <Async state={state}>
      {(p) => {
        const v = p.vendor, s = p.summary;
        return (
          <>
            <a href="#/vendors" className="btn ghost sm">&larr; All vendors</a>
            <div className="card" style={{ marginTop: 14 }}>
              <div className="toolbar">
                <div className="grow"><h2>🛒 {v.vendor_name}</h2><div className="hint">{v.location} - {v.phone_number} - registered {dt(v.registration_date)}</div></div>
                <button className="btn" onClick={() => setDialog('pay')}>Record payment</button><button className="btn green" onClick={() => setDialog('statement')}>Statement</button><button className="btn ghost" onClick={() => setDialog('edit')}>Edit</button>
              </div>
            </div>
            <div className="stats">
              <Stat cls="g" emoji="🧺" title="Total purchases (net)">{money(s.total_purchases)}</Stat>
              <Stat cls="t" emoji="💵" title="Total payments made">{money(s.total_paid)}</Stat>
              <Stat cls="r" emoji="⏰" title="Outstanding balance">{money(s.outstanding_balance)}</Stat>
              <Stat cls="y" emoji="🏷️" title="Credit limit / available" sub={`${money(s.available_credit)} available`}>{money(s.credit_limit)}</Stat>
            </div>
            <div className="grid g2">
              <div className="card"><h3>Most frequently purchased fruits</h3><HBars data={p.most_purchased_fruits.map((f) => ({ label: `${fruitEmoji(f.fruit_name)} ${f.fruit_name}`, value: f.boxes_bought }))} fmt={(x) => x + ' boxes'} /></div>
              <div className="card"><h3>Returns</h3>
                <Table rows={p.returns} empty="No returns." cols={[{ label: 'Date', render: (r) => dt(r.return_date) }, { label: 'Item', render: (r) => `${r.quantity} x ${r.fruit_name} ${sizeLabel(r.packaging_size)}` }, { label: 'Reason', key: 'reason' }, { label: 'Refund', align: 'r', render: (r) => money(r.refund_value) }]} />
              </div>
            </div>
            <div className="card"><h3>Purchase history</h3>
              <Table rows={p.purchase_history} empty="No purchases yet." cols={[
                { label: 'Invoice', render: (r) => <a href="#open" onClick={(e) => { e.preventDefault(); setDialog({ sale: r.sale_id }); }}>{r.invoice_number}</a> }, { label: 'Date', render: (r) => dt(r.sale_date) }, { label: 'Boxes', align: 'r', key: 'total_boxes' },
                { label: 'Total', align: 'r', render: (r) => money(r.total_amount) }, { label: 'Paid', align: 'r', render: (r) => money(r.amount_paid) }, { label: 'Balance', align: 'r', render: (r) => money(r.balance_due) },
                { label: 'Due', render: (r) => dt(r.due_date) }, { label: 'Status', render: (r) => <Badge status={r.payment_status} /> }
              ]} />
            </div>
            <div className="card"><h3>Payment history</h3>
              <Table rows={p.payment_history} empty="No payments yet." cols={[
                { label: 'Date', render: (r) => dt(r.payment_date) }, { label: 'Invoice', key: 'invoice_number' }, { label: 'Type', render: (r) => <Badge status={r.payment_type} /> }, { label: 'Method', render: (r) => label(r.payment_method) },
                { label: 'Reference', render: (r) => r.reference_number || '-' }, { label: 'Amount', align: 'r', render: (r) => <span className={r.payment_type === 'REFUND' ? 'neg' : 'pos'}>{r.payment_type === 'REFUND' ? '-' : ''}{money(r.amount)}</span> }
              ]} />
            </div>
            {dialog === 'edit' && <VendorForm vendor={v} onClose={() => setDialog(null)} onSaved={state.reload} />}
            {dialog === 'pay' && <VendorPaymentForm vendor={{ ...v, outstanding_balance: s.outstanding_balance }} onClose={() => setDialog(null)} onSaved={state.reload} />}
            {dialog === 'statement' && <Statement vendor={v} onClose={() => setDialog(null)} />}
            {dialog && dialog.sale && <SaleModal id={dialog.sale} onClose={() => setDialog(null)} onChanged={state.reload} />}
          </>
        );
      }}
    </Async>
  );
}

function Statement({ vendor, onClose }) {
  const toast = useToast();
  const [per, setPer] = useState({ period: 'month' });
  const state = useAsync(() => get(`/vendors/${vendor.vendor_id}/statement`, periodQuery(per)), [per]);
  const ref = useRef(null);
  const Box = ({ cls, t, v }) => <div className={`stat ${cls}`}><small>{t}</small><b style={{ fontSize: 20 }}>{money(v)}</b></div>;
  return (
    <Modal title={`Statement - ${vendor.vendor_name}`} onClose={onClose} wide>
      <PeriodBar value={per} onChange={setPer} />
      <Async state={state}>
        {(s) => (
          <>
            <div ref={ref}>
              <h3>Batloung Farm - Account statement</h3>
              <p><b>{s.vendor.vendor_name}</b> - {s.vendor.phone_number}<br />Period: {s.period.from} to {s.period.to}</p>
              <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                <Box cls="t" t="Previous balance" v={s.previous_balance} /><Box cls="o" t="New purchases" v={s.new_purchases} /><Box cls="g" t="Payments received" v={s.payments_received} />
                <Box cls="p" t="Returns / credits" v={s.returns_credit_adjustments} /><Box cls="r" t="Current balance" v={s.current_balance} />
              </div>
              <div className="statement-table">
                <Table rows={s.lines} empty="No transactions in this period." cols={[
                  { label: 'Date', render: (e) => dt(e.entry_date) }, { label: 'Reference', key: 'reference' }, { label: 'Description', key: 'description' },
                  { label: 'Charges', align: 'r', render: (e) => (e.debit ? money(e.debit) : '') }, { label: 'Credits', align: 'r', render: (e) => (e.credit ? money(e.credit) : '') }, { label: 'Balance', align: 'r', render: (e) => money(e.balance) }
                ]} />
              </div>
            </div>
            <div className="modal-foot no-print"><button className="btn" onClick={() => printHtml('Statement', ref.current.innerHTML) || toast('Allow pop-ups to print', 'err')}>Print statement</button></div>
          </>
        )}
      </Async>
    </Modal>
  );
}
