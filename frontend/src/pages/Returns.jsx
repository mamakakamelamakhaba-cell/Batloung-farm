import { useState } from 'react';
import { getPaged } from '../api';
import { Async, FormModal, Pager, Table, useAsync } from '../components/ui';
import SaleModal from '../components/SaleModal';
import { dt, money, sizeLabel } from '../utils';

export default function Returns() {
  const [page, setPage] = useState(1);
  const [find, setFind] = useState(false);
  const [sale, setSale] = useState(null);
  const state = useAsync(() => getPaged('/returns', { page }), [page]);
  return (
    <div className="card">
      <div className="toolbar"><div className="grow hint">Returns are recorded against the original invoice, so history is never deleted.</div><button className="btn" onClick={() => setFind(true)}>+ Start a return</button></div>
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No returns recorded." emptyIcon="↩️" cols={[
              { label: 'Date', render: (x) => dt(x.return_date) }, { label: 'Invoice', render: (x) => <a href="#open" onClick={(e) => { e.preventDefault(); setSale(x.sale_id); }}>{x.invoice_number}</a> }, { label: 'Vendor', key: 'vendor_name' },
              { label: 'Item', render: (x) => `${x.quantity} x ${x.fruit_name} ${sizeLabel(x.packaging_size)}` }, { label: 'Reason', key: 'reason' }, { label: 'Restocked', align: 'r', key: 'restocked_quantity' },
              { label: 'Refund value', align: 'r', render: (x) => money(x.refund_value) }, { label: 'Balance credit', align: 'r', render: (x) => money(x.credit_adjustment) }, { label: 'Cash refund', align: 'r', render: (x) => money(x.cash_refund) }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
      {find && (
        <FormModal title="Find the original sale" submitLabel="Find invoice" onClose={() => setFind(false)}
          fields={[{ name: 'q', label: 'Invoice number or vendor name', required: true, placeholder: 'INV-2026-00003' }]}
          onSubmit={async (d) => { const r = await getPaged('/sales', { search: d.q, limit: 1 }); if (!r.data.length) throw new Error('No matching sale found'); setSale(r.data[0].sale_id); }} />
      )}
      {sale && <SaleModal id={sale} onClose={() => setSale(null)} onChanged={state.reload} />}
    </div>
  );
}
