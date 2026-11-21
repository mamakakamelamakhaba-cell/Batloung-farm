import { useState } from 'react';
import { api, get } from '../api';
import { useAuth, useToast } from '../context';
import { Async, Badge, FormModal, useAsync } from '../components/ui';
import { fruitEmoji, money, sizeLabel } from '../utils';

export default function Fruits() {
  const { meta } = useAuth();
  const toast = useToast();
  const state = useAsync(() => get('/fruits'), []);
  const [dialog, setDialog] = useState(null); // {type:'add'|'edit'|'prices', fruit}
  const sizes = meta.packaging_sizes;
  const close = () => setDialog(null);
  const done = (msg) => () => { toast(msg); state.reload(); };

  return (
    <>
      <div className="toolbar"><div className="grow"><span className="hint">Every packaging size has its own selling price and stock level.</span></div><button className="btn" onClick={() => setDialog({ type: 'add' })}>+ Register fruit</button></div>
      <Async state={state}>
        {(fruits) => (
          <div className="grid g3">
            {fruits.map((f) => (
              <div className="fruit-card" key={f.fruit_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><span className="emoji">{fruitEmoji(f.fruit_name)}</span></div>
                <h3 style={{ marginTop: 6 }}>{f.fruit_name}</h3>
                <p className="hint">{f.description} Shelf life: {f.shelf_life_days} days.</p>
                <div className="hint" style={{ fontWeight: 700 }}>Selling price per box</div>
                <div className="chips">{sizes.map((s) => <div className="chip" key={s}>{sizeLabel(s)}<b>{f.prices[s] !== undefined ? money(f.prices[s]) : 'not set'}</b></div>)}</div>
                <div className="hint" style={{ fontWeight: 700 }}>Stock on hand</div>
                <div className="chips">{sizes.map((s) => { const st = f.stock[s] || { available: 0, minimum: 0 }; return <div className="chip" key={s}>{sizeLabel(s)}<b className={st.minimum && st.available < st.minimum ? 'neg' : ''}>{st.available}</b></div>; })}</div>
                <div className="actions"><button className="btn ghost sm" onClick={() => setDialog({ type: 'edit', fruit: f })}>Edit</button><button className="btn sm" onClick={() => setDialog({ type: 'prices', fruit: f })}>Set prices</button></div>
              </div>
            ))}
            {!fruits.length && <div className="empty">No fruits registered.</div>}
          </div>
        )}
      </Async>

      {dialog?.type === 'add' && (
        <FormModal
          title="Register new fruit" wide onClose={close}
          fields={[
            { name: 'fruit_name', label: 'Fruit name', required: true }, { name: 'shelf_life_days', label: 'Shelf life (days)', type: 'number', min: 1, value: 7, required: true },
            { name: 'description', label: 'Description', full: true }, { name: 'status', label: 'Status', type: 'select', options: ['AVAILABLE', 'UNAVAILABLE'], value: 'AVAILABLE' },
            ...sizes.map((s) => ({ name: 'price_' + s, label: `${sizeLabel(s)} selling price (M)`, type: 'number', step: '0.01', min: 0, required: true })),
            ...sizes.map((s) => ({ name: 'min_' + s, label: `${sizeLabel(s)} minimum stock`, type: 'number', min: 0, value: 10 }))
          ]}
          onSubmit={async (d) => {
            const body = { fruit_name: d.fruit_name, description: d.description, status: d.status, shelf_life_days: d.shelf_life_days, prices: {}, minimum_stock: {} };
            sizes.forEach((s) => { body.prices[s] = d['price_' + s]; if (d['min_' + s] !== undefined) body.minimum_stock[s] = d['min_' + s]; });
            await api('/fruits', { method: 'POST', body });
            done('Fruit registered')();
          }}
        />
      )}
      {dialog?.type === 'edit' && (
        <FormModal
          title={`Edit ${dialog.fruit.fruit_name}`} values={dialog.fruit} onClose={close}
          fields={[{ name: 'fruit_name', label: 'Fruit name', required: true }, { name: 'status', label: 'Status', type: 'select', options: ['AVAILABLE', 'UNAVAILABLE'] }, { name: 'description', label: 'Description', full: true }, { name: 'shelf_life_days', label: 'Shelf life (days)', type: 'number', min: 1 }]}
          onSubmit={async (d) => { await api(`/fruits/${dialog.fruit.fruit_id}`, { method: 'PUT', body: d }); done('Fruit updated')(); }}
        />
      )}
      {dialog?.type === 'prices' && (
        <FormModal
          title={`Selling prices - ${dialog.fruit.fruit_name}`} submitLabel="Save prices" values={dialog.fruit.prices} onClose={close}
          fields={sizes.map((s) => ({ name: s, label: `${sizeLabel(s)} box (M)`, type: 'number', step: '0.01', min: 0, required: true, hint: s === 'SMALL' ? 'Each size must have a different price.' : '' }))}
          onSubmit={async (d) => { await api(`/fruits/${dialog.fruit.fruit_id}/prices`, { method: 'PUT', body: { prices: d } }); done('Prices updated')(); }}
        />
      )}
    </>
  );
}
