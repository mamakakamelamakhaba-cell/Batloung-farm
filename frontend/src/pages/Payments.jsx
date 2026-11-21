import { useState } from 'react';
import { get, getPaged } from '../api';
import { useToast } from '../context';
import { Async, Badge, Modal, Pager, PeriodBar, Table, Tabs, periodQuery, useAsync } from '../components/ui';
import VendorPaymentForm from '../components/VendorPaymentForm';
import { dt, label, money } from '../utils';

export default function Payments() {
  return <Tabs items={[
    { label: 'Outstanding balances', render: () => <Outstanding overdueOnly={false} /> },
    { label: 'Overdue reminders', render: () => <Outstanding overdueOnly /> },
    { label: 'Payment history', render: () => <History /> }
  ]} />;
}

function Outstanding({ overdueOnly }) {
  const toast = useToast();
  const state = useAsync(() => get(overdueOnly ? '/payments/overdue' : '/payments/outstanding'), [overdueOnly]);
  const [pay, setPay] = useState(null);
  const [reminder, setReminder] = useState(null);
  return (
    <Async state={state}>
      {(rows) => {
        const total = rows.reduce((s, r) => s + (overdueOnly ? r.overdue_amount : r.outstanding), 0);
        return (
          <div className="card">
            <h3>{overdueOnly ? 'Vendors with overdue payments' : 'Vendors with outstanding balances'} <span className={`badge ${overdueOnly ? 'bad' : 'warn'}`}>{rows.length} vendors - {money(total)}</span></h3>
            <Table rows={rows} emptyIcon="🎉" empty={overdueOnly ? 'No overdue payments. Every vendor is up to date.' : 'No outstanding balances.'} cols={[
              { label: 'Vendor', render: (r) => <><b>{r.vendor_name}</b><br /><small>{r.phone_number}</small></> }, { label: 'Outstanding', align: 'r', render: (r) => <b>{money(r.outstanding)}</b> },
              { label: 'Overdue', align: 'r', render: (r) => (r.overdue_amount ? <span className="neg">{money(r.overdue_amount)}</span> : '-') }, { label: 'Unpaid invoices', align: 'r', key: 'unpaid_invoices' },
              { label: 'Oldest due date', render: (r) => dt(r.oldest_due_date) }, { label: 'Days overdue', align: 'r', render: (r) => (r.days_overdue > 0 ? <span className="neg">{r.days_overdue}</span> : '-') },
              { label: 'Last payment', render: (r) => dt(r.last_payment_date) }, { label: 'Credit available', align: 'r', render: (r) => money(r.available_credit) },
              { label: '', render: (r) => <div className="actions"><button className="btn sm" onClick={() => setPay(r)}>Record payment</button>{r.overdue_amount > 0 && <button className="btn ghost sm" onClick={() => setReminder(r)}>Reminder</button>}</div> }
            ]} />
            {pay && <VendorPaymentForm vendor={{ vendor_id: pay.vendor_id, vendor_name: pay.vendor_name, outstanding_balance: pay.outstanding }} onClose={() => setPay(null)} onSaved={state.reload} />}
            {reminder && (() => {
              const msg = `Hello ${reminder.vendor_name}, this is Batloung Farm. Your account has ${money(reminder.overdue_amount)} overdue (oldest invoice due ${dt(reminder.oldest_due_date)}). Please settle by cash or mobile money. Thank you!`;
              return (
                <Modal title="Payment reminder" onClose={() => setReminder(null)}>
                  <textarea rows="4" readOnly value={msg} />
                  <div className="modal-foot">
                    <button className="btn ghost" onClick={() => navigator.clipboard.writeText(msg).then(() => toast('Message copied'))}>Copy message</button>
                    <a className="btn" href={`sms:${encodeURIComponent(reminder.phone_number)}?body=${encodeURIComponent(msg)}`}>Open in SMS</a>
                  </div>
                </Modal>
              );
            })()}
          </div>
        );
      }}
    </Async>
  );
}

function History() {
  const [per, setPer] = useState({ period: 'month' });
  const [page, setPage] = useState(1);
  const state = useAsync(() => getPaged('/payments', { ...periodQuery(per), page }), [per, page]);
  return (
    <div className="card">
      <PeriodBar all value={per} onChange={(p) => { setPer(p); setPage(1); }} />
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No payments in this period." emptyIcon="💵" cols={[
              { label: 'Date', render: (p) => dt(p.payment_date) }, { label: 'Vendor', key: 'vendor_name' }, { label: 'Invoice', key: 'invoice_number' }, { label: 'Type', render: (p) => <Badge status={p.payment_type} /> },
              { label: 'Method', render: (p) => label(p.payment_method) }, { label: 'Reference', render: (p) => p.reference_number || '-' },
              { label: 'Amount', align: 'r', render: (p) => <span className={p.payment_type === 'REFUND' ? 'neg' : 'pos'}>{p.payment_type === 'REFUND' ? '-' : ''}{money(p.amount)}</span> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </div>
  );
}
