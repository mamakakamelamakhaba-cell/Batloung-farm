import { useState } from 'react';
import { api, get, getPaged } from '../api';
import { useAuth, useToast } from '../context';
import { Async, FormModal, HBars, Pager, PeriodBar, Table, periodQuery, useAsync } from '../components/ui';
import { dt, label, money } from '../utils';

export default function Expenses() {
  const { meta } = useAuth();
  const toast = useToast();
  const [per, setPer] = useState({ period: 'month' });
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const list = useAsync(() => getPaged('/expenses', { ...periodQuery(per), category: cat, page }), [per, cat, page]);
  const sum = useAsync(() => get('/expenses/summary', periodQuery(per)), [per]);
  const reload = () => { list.reload(); sum.reload(); };
  const remove = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await api(`/expenses/${id}`, { method: 'DELETE' }); toast('Expense deleted'); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <div className="grid g2">
        <div className="card"><h3>Where the money goes</h3>
          <Async state={sum}>{(s) => <><div style={{ fontSize: 26, fontFamily: 'var(--display)', color: 'var(--leaf)' }}>{money(s.total)}</div><HBars data={s.by_category.map((c) => ({ label: label(c.category), value: c.total }))} fmt={money} /></>}</Async>
        </div>
        <div className="card"><h3>Add expense</h3><p className="hint">Transport, fuel, packaging, storage, employee and other costs.</p><button className="btn" onClick={() => setForm({ expense: null })}>+ Record expense</button></div>
      </div>
      <div className="card">
        <PeriodBar all value={per} onChange={(p) => { setPer(p); setPage(1); }} />
        <div className="toolbar"><select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">All categories</option>{meta.expense_categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></div>
        <Async state={list}>
          {(r) => (
            <>
              <Table rows={r.data} empty="No expenses in this period." emptyIcon="🧮" cols={[
                { label: 'Date', render: (e) => dt(e.expense_date) }, { label: 'Category', render: (e) => <span className="badge">{label(e.category)}</span> }, { label: 'Description', key: 'description' },
                { label: 'Amount', align: 'r', render: (e) => money(e.amount) },
                { label: '', render: (e) => <div className="actions"><button className="btn ghost sm" onClick={() => setForm({ expense: e })}>Edit</button><button className="btn ghost sm" onClick={() => remove(e.expense_id)}>Delete</button></div> }
              ]} />
              <Pager p={r.pagination} onPage={setPage} />
            </>
          )}
        </Async>
      </div>
      {form && (
        <FormModal title={form.expense ? 'Edit expense' : 'Record expense'} values={form.expense || {}} onClose={() => setForm(null)}
          fields={[
            { name: 'category', label: 'Category', type: 'select', options: meta.expense_categories, required: true, placeholder: 'Choose category' }, { name: 'amount', label: 'Amount (M)', type: 'number', step: '0.01', min: 0, required: true },
            { name: 'description', label: 'Description', required: true, full: true }, { name: 'expense_date', label: 'Date', type: 'date', value: new Date().toISOString().slice(0, 10) }
          ]}
          onSubmit={async (d) => { await api(form.expense ? `/expenses/${form.expense.expense_id}` : '/expenses', { method: form.expense ? 'PUT' : 'POST', body: d }); toast('Expense saved'); reload(); }} />
      )}
    </>
  );
}
