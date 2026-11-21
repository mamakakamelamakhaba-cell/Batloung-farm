import { useState } from 'react';
import { api, getPaged } from '../api';
import { useToast } from '../context';
import { Async, FormModal, Pager, Table, useAsync, useDebounced } from '../components/ui';
import { dt, money } from '../utils';

export function VendorForm({ vendor, onClose, onSaved }) {
  const toast = useToast();
  return (
    <FormModal
      title={vendor ? 'Edit vendor' : 'Register vendor'} submitLabel={vendor ? 'Save changes' : 'Register vendor'} values={vendor || { credit_limit: 0 }} onClose={onClose}
      fields={[
        { name: 'vendor_name', label: 'Vendor / stall name', required: true, full: true }, { name: 'phone_number', label: 'Phone number', required: true, placeholder: '+266 5801 1234' }, { name: 'location', label: 'Location', required: true },
        { name: 'credit_limit', label: 'Credit limit (M)', type: 'number', step: '0.01', min: 0, hint: 'The most this vendor may owe at one time.' }
      ]}
      onSubmit={async (d) => { await api(vendor ? `/vendors/${vendor.vendor_id}` : '/vendors', { method: vendor ? 'PUT' : 'POST', body: d }); toast(vendor ? 'Vendor updated' : 'Vendor registered'); onSaved(); }}
    />
  );
}

export default function Vendors() {
  const [q, setQ] = useState('');
  const [bal, setBal] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const search = useDebounced(q);
  const state = useAsync(() => getPaged('/vendors', { search, has_balance: bal, page }), [search, bal, page]);
  return (
    <div className="card">
      <div className="toolbar">
        <input className="grow" placeholder="Search vendors by name or phone number..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={bal} onChange={(e) => { setBal(e.target.value); setPage(1); }}><option value="">All vendors</option><option value="true">Owing money</option></select>
        <button className="btn" onClick={() => setForm({ vendor: null })}>+ Register vendor</button>
      </div>
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No vendors found." emptyIcon="🛒" cols={[
              { label: 'Vendor', render: (v) => <><b>{v.vendor_name}</b><br /><small>{v.location}</small></> }, { label: 'Phone', key: 'phone_number' }, { label: 'Registered', render: (v) => dt(v.registration_date) },
              { label: 'Credit limit', align: 'r', render: (v) => money(v.credit_limit) },
              { label: 'Outstanding', align: 'r', render: (v) => <span className={v.outstanding_balance > 0 ? 'neg' : ''}>{money(v.outstanding_balance)}</span> },
              { label: 'Available credit', align: 'r', render: (v) => { const pct = v.credit_limit ? (v.available_credit / v.credit_limit) * 100 : 0; return <>{money(v.available_credit)}<div className="meter"><i className={pct < 15 ? 'bad' : pct < 50 ? 'warn' : ''} style={{ width: `${pct}%` }} /></div></>; } },
              { label: '', render: (v) => <div className="actions"><a className="btn sm" href={`#/vendors/${v.vendor_id}`}>Profile</a><button className="btn ghost sm" onClick={() => setForm({ vendor: v })}>Edit</button></div> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
      {form && <VendorForm vendor={form.vendor} onClose={() => setForm(null)} onSaved={state.reload} />}
    </div>
  );
}
