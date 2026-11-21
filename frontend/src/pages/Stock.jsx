import { useState } from 'react';
import { api, get, getPaged } from '../api';
import { useAuth, useToast } from '../context';
import { Async, Badge, FormModal, Pager, PeriodBar, Table, Tabs, periodQuery, useAsync } from '../components/ui';
import { dt, fruitEmoji, label, money, sizeLabel } from '../utils';

export default function Stock() {
  const [adjust, setAdjust] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <>
      <div className="toolbar"><div className="grow" /><button className="btn" onClick={() => setAdjust(true)}>+ Record damage / adjustment</button></div>
      <Tabs items={[
        { label: 'Stock levels', render: () => <Levels key={version} /> },
        { label: 'Movement history', render: () => <Movements key={version} /> },
        { label: 'Batches & expiry', render: () => <Batches key={version} /> }
      ]} />
      {adjust && <AdjustForm onClose={() => setAdjust(false)} onSaved={() => setVersion((v) => v + 1)} />}
    </>
  );
}

function useFruitOptions() {
  return useAsync(async () => (await get('/fruits')).map((f) => ({ value: f.fruit_id, label: f.fruit_name })), []);
}

function AdjustForm({ onClose, onSaved }) {
  const { meta } = useAuth();
  const toast = useToast();
  const fruits = useFruitOptions();
  if (!fruits.data) return null;
  return (
    <FormModal
      title="Record stock movement" submitLabel="Record" onClose={onClose}
      fields={[
        { name: 'fruit_id', label: 'Fruit', type: 'select', options: fruits.data, required: true, placeholder: 'Choose fruit' }, { name: 'packaging_size', label: 'Packaging size', type: 'select', options: meta.packaging_sizes, required: true, placeholder: 'Choose size' },
        { name: 'movement_type', label: 'Type', type: 'select', options: meta.adjustment_types, required: true, placeholder: 'Choose type', hint: 'Damaged and spoiled always remove stock; returned stock adds it.' },
        { name: 'direction', label: 'Direction (adjustment/correction)', type: 'select', options: ['IN', 'OUT'], placeholder: 'Not needed' }, { name: 'quantity', label: 'Boxes', type: 'number', min: 1, required: true },
        { name: 'reason', label: 'Reason', required: true, hint: 'e.g. Crushed in transit, stock count correction' }
      ]}
      onSubmit={async (d) => { await api('/stock/adjustments', { method: 'POST', body: d }); toast('Stock movement recorded'); onSaved(); }}
    />
  );
}

function Levels() {
  const { meta } = useAuth();
  const toast = useToast();
  const fruits = useFruitOptions();
  const [f, setF] = useState('');
  const [s, setS] = useState('');
  const [st, setSt] = useState('');
  const [minForm, setMinForm] = useState(null);
  const state = useAsync(() => get('/stock', { fruit_id: f, packaging_size: s, status: st }), [f, s, st]);
  return (
    <div className="card">
      <div className="toolbar">
        <select value={f} onChange={(e) => setF(e.target.value)}><option value="">All fruits</option>{(fruits.data || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select value={s} onChange={(e) => setS(e.target.value)}><option value="">All sizes</option>{meta.packaging_sizes.map((x) => <option key={x} value={x}>{sizeLabel(x)}</option>)}</select>
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option><option value="NORMAL">Normal</option><option value="LOW">Low</option><option value="CRITICAL">Critical</option></select>
      </div>
      <Async state={state}>
        {(rows) => (
          <Table rows={rows} emptyIcon="📦" cols={[
            { label: 'Fruit', render: (r) => <>{fruitEmoji(r.fruit_name)} <b>{r.fruit_name}</b></> }, { label: 'Packaging', render: (r) => sizeLabel(r.packaging_size) },
            { label: 'Current stock', align: 'r', render: (r) => <b>{r.available_quantity}</b> }, { label: 'Sellable', align: 'r', key: 'sellable_quantity' },
            { label: 'Expired', align: 'r', render: (r) => (r.expired_quantity ? <span className="neg">{r.expired_quantity}</span> : 0) }, { label: 'Minimum', align: 'r', key: 'minimum_quantity' },
            { label: 'Level', render: (r) => { const pct = r.minimum_quantity ? Math.min(100, (r.available_quantity / r.minimum_quantity) * 50) : 100; return <div className="meter"><i className={r.stock_status === 'CRITICAL' ? 'bad' : r.stock_status === 'LOW' ? 'warn' : ''} style={{ width: `${pct}%` }} /></div>; } },
            { label: 'Status', render: (r) => <Badge status={r.stock_status} /> }, { label: '', render: (r) => <button className="btn ghost sm" onClick={() => setMinForm(r)}>Set minimum</button> }
          ]} />
        )}
      </Async>
      {minForm && (
        <FormModal title="Minimum stock level" values={{ minimum_quantity: minForm.minimum_quantity }} onClose={() => setMinForm(null)}
          fields={[{ name: 'minimum_quantity', label: 'Alert when stock falls below (boxes)', type: 'number', min: 0, required: true }]}
          onSubmit={async (d) => { await api('/stock/minimum', { method: 'PUT', body: { fruit_id: minForm.fruit_id, packaging_size: minForm.packaging_size, minimum_quantity: d.minimum_quantity } }); toast('Minimum updated'); state.reload(); }} />
      )}
    </div>
  );
}

function Movements() {
  const { meta } = useAuth();
  const fruits = useFruitOptions();
  const [f, setF] = useState('');
  const [s, setS] = useState('');
  const [t, setT] = useState('');
  const [per, setPer] = useState({ period: 'all' });
  const [page, setPage] = useState(1);
  const state = useAsync(() => getPaged('/stock/movements', { fruit_id: f, packaging_size: s, movement_type: t, ...periodQuery(per), page }), [f, s, t, per, page]);
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };
  return (
    <div className="card">
      <div className="toolbar">
        <select value={f} onChange={reset(setF)}><option value="">All fruits</option>{(fruits.data || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select value={s} onChange={reset(setS)}><option value="">All sizes</option>{meta.packaging_sizes.map((x) => <option key={x} value={x}>{sizeLabel(x)}</option>)}</select>
        <select value={t} onChange={reset(setT)}><option value="">All movement types</option>{meta.movement_types.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
      </div>
      <PeriodBar all value={per} onChange={(p) => { setPer(p); setPage(1); }} />
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} empty="No stock movements found." emptyIcon="🔁" cols={[
              { label: 'Date', render: (m) => dt(m.created_at) }, { label: 'Fruit', render: (m) => <>{fruitEmoji(m.fruit_name)} {m.fruit_name}</> }, { label: 'Packaging', render: (m) => sizeLabel(m.packaging_size) },
              { label: 'Movement', render: (m) => <Badge status={m.movement_type} /> }, { label: 'Quantity', align: 'r', render: (m) => <span className={m.quantity > 0 ? 'pos' : 'neg'}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span> },
              { label: 'Balance after', align: 'r', key: 'balance_after' }, { label: 'Note', render: (m) => <small>{m.reason}</small> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </div>
  );
}

function Batches() {
  const toast = useToast();
  const [st, setSt] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(() => getPaged('/stock/batches', { status: st, page }), [st, page]);
  const writeOff = async () => {
    if (!window.confirm('Write off every expired batch as SPOILED?')) return;
    try { const r = await api('/stock/expired/write-off', { method: 'POST', body: {} }); toast(`${r.data.boxes_written_off} boxes written off`); state.reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="card">
      <h3>Batches (oldest first - FIFO)<button className="btn red sm" onClick={writeOff}>Write off expired</button></h3>
      <div className="toolbar"><select value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }}><option value="">All batches</option><option value="FRESH">Fresh</option><option value="NEAR_EXPIRY">Near expiry</option><option value="EXPIRED">Expired</option></select></div>
      <Async state={state}>
        {(r) => (
          <>
            <Table rows={r.data} emptyIcon="🧺" cols={[
              { label: 'Batch', render: (b) => '#' + b.batch_id }, { label: 'Fruit', render: (b) => <>{fruitEmoji(b.fruit_name)} {b.fruit_name}</> }, { label: 'Packaging', render: (b) => sizeLabel(b.packaging_size) },
              { label: 'Received', render: (b) => dt(b.received_date) }, { label: 'Expiry', render: (b) => dt(b.expiry_date) }, { label: 'Days left', align: 'r', render: (b) => (b.days_to_expiry === null ? '-' : b.days_to_expiry) },
              { label: 'Boxes left', align: 'r', render: (b) => `${b.quantity_remaining} / ${b.quantity_received}` }, { label: 'Cost / box', align: 'r', render: (b) => money(b.unit_cost) }, { label: 'Status', render: (b) => <Badge status={b.expiry_status} /> }
            ]} />
            <Pager p={r.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </div>
  );
}
