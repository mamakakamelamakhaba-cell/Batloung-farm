import { useState } from 'react';
import { api, get, getPaged } from '../api';
import { useAuth, useToast } from '../context';
import { Async, Badge, FormModal, Pager, Table, Tabs, useAsync, useDebounced } from '../components/ui';
import { money } from '../utils';

export default function Suppliers() {
  return <Tabs items={[{ label: 'Directory', render: () => <Directory /> }, { label: 'Performance', render: () => <Performance /> }]} />;
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const { meta } = useAuth();
  const toast = useToast();
  return (
    <FormModal
      title={supplier ? 'Edit supplier' : 'Register supplier'} submitLabel={supplier ? 'Save changes' : 'Register supplier'} values={supplier || {}} onClose={onClose}
      fields={[
        { name: 'business_name', label: 'Business name', required: true, full: true }, { name: 'contact_person', label: 'Contact person', required: true },
        { name: 'phone', label: 'Phone', required: true, placeholder: '+27 11 555 0101' },
        { name: 'province', label: 'Province', type: 'select', options: meta.provinces, required: true, placeholder: 'Choose province' }, { name: 'address', label: 'Address', required: true }
      ]}
      onSubmit={async (d) => { await api(supplier ? `/suppliers/${supplier.supplier_id}` : '/suppliers', { method: supplier ? 'PUT' : 'POST', body: d }); toast(supplier ? 'Supplier updated' : 'Supplier registered'); onSaved(); }}
    />
  );
}

function Directory() {
  const { meta } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [province, setProvince] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); // null | {supplier}
  const search = useDebounced(q);
  const state = useAsync(() => getPaged('/suppliers', { search, province, page }), [search, province, page]);
  const remove = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try { await api(`/suppliers/${id}`, { method: 'DELETE' }); toast('Supplier deleted'); state.reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="card">
      <div className="toolbar">
        <input className="grow" placeholder="Search suppliers by name..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }}><option value="">All provinces</option>{meta.provinces.map((p) => <option key={p}>{p}</option>)}</select>
        <button className="btn" onClick={() => setForm({ supplier: null })}>+ Register supplier</button>
      </div>
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No suppliers match your search." emptyIcon="🚜" cols={[
              { label: 'Business', render: (s) => <><b>{s.business_name}</b><br /><small>{s.address}</small></> }, { label: 'Contact', key: 'contact_person' }, { label: 'Phone', key: 'phone' },
              { label: 'Province', render: (s) => <span className="badge">{s.province}</span> },
              { label: '', render: (s) => <div className="actions"><button className="btn ghost sm" onClick={() => setForm({ supplier: s })}>Edit</button><button className="btn ghost sm" onClick={() => remove(s.supplier_id)}>Delete</button></div> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
      {form && <SupplierForm supplier={form.supplier} onClose={() => setForm(null)} onSaved={state.reload} />}
    </div>
  );
}

function Performance() {
  const state = useAsync(() => get('/suppliers/performance'), []);
  return (
    <Async state={state}>
      {(rows) => (
        <div className="card">
          <h3>Supplier performance</h3>
          <p className="hint">Rating combines late deliveries, deliveries with rejected boxes and the share of boxes rejected.</p>
          <Table rows={rows} cols={[
            { label: 'Supplier', render: (s) => <><b>{s.business_name}</b><br /><small>{s.province}</small></> }, { label: 'Deliveries', key: 'deliveries', align: 'r' },
            { label: 'Damaged deliveries', key: 'damaged_deliveries', align: 'r' }, { label: 'Late', align: 'r', render: (s) => <>{s.delayed_deliveries} <small>(avg {s.avg_delay_days}d)</small></> },
            { label: 'Boxes ordered / accepted / rejected', align: 'r', render: (s) => <>{s.qty_ordered} / {s.qty_accepted} / <span className={s.qty_rejected ? 'neg' : ''}>{s.qty_rejected}</span></> },
            { label: 'Total purchased', align: 'r', render: (s) => money(s.total_purchases) }, { label: 'Avg cost / box', align: 'r', render: (s) => money(s.avg_unit_cost) },
            { label: 'Rating', render: (s) => <><Badge status={s.rating} /> {s.score !== null && <small>{s.score}/100</small>}</> }
          ]} />
        </div>
      )}
    </Async>
  );
}
