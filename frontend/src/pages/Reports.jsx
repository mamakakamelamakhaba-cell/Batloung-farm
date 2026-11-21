import { useState } from 'react';
import { get } from '../api';
import { Async, Badge, HBars, LineChart, PeriodBar, Stat, Table, periodQuery, useAsync } from '../components/ui';
import { fruitEmoji, money, sizeLabel } from '../utils';

export default function Reports() {
  const [per, setPer] = useState({ period: 'month' });
  const [groupBy, setGroupBy] = useState('fruit');
  const [gran, setGran] = useState('day');
  const q = periodQuery(per);

  const base = useAsync(async () => {
    const [rev, summary, top, vend, demand, stock] = await Promise.all([
      get('/reports/revenue', q), get('/reports/profit', { ...q, group_by: 'summary' }), get('/reports/top-fruits', q), get('/reports/top-vendor', { ...q, limit: 3 }), get('/reports/fruit-demand', q), get('/reports/stock-levels')
    ]);
    return { rev, ps: summary.summary, top, vend, demand, stock };
  }, [per]);
  const profit = useAsync(() => get('/reports/profit', { ...q, group_by: groupBy }), [per, groupBy]);
  const trend = useAsync(() => get('/reports/sales-trend', { ...q, granularity: gran }), [per, gran]);

  return (
    <>
      <div className="card"><h3>Reporting period</h3><PeriodBar value={per} onChange={setPer} /></div>
      <Async state={base}>
        {({ rev, ps, top, vend, demand, stock }) => (
          <>
            <div className="stats">
              <Stat cls="o" emoji="💰" title="Total sales revenue" sub={`${rev.number_of_sales} sales, net of returns ${money(rev.net_revenue)}`}>{money(rev.total_sales_revenue)}</Stat>
              <Stat cls="g" emoji="📈" title="Gross profit" sub={`Margin ${ps.margin_percent}%`}>{money(ps.gross_profit)}</Stat>
              <Stat cls="t" emoji="🧮" title="Operating expenses" sub={`Net after expenses ${money(ps.net_profit_after_expenses)}`}>{money(ps.operating_expenses)}</Stat>
              <Stat cls="r" emoji="⏰" title="Still owed on these sales" sub={`Collected ${money(rev.amount_collected)}`}>{money(rev.amount_outstanding)}</Stat>
            </div>

            <div className="card">
              <h3>Profitability
                <select style={{ width: 'auto' }} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                  <option value="fruit">By fruit</option><option value="packaging">By packaging size</option><option value="fruit_packaging">By fruit and size</option><option value="sale">By sale transaction</option>
                </select>
              </h3>
              <p className="hint">Gross profit = sales revenue - cost of goods sold (FIFO batch cost). Operating expenses are not deducted here.</p>
              <Async state={profit}>
                {(p) => (
                  <Table rows={p.rows} empty="No sales in this period." emptyIcon="📉" cols={[
                    { label: groupBy === 'sale' ? 'Invoice' : 'Group', render: (r) => r.label },
                    ...(groupBy === 'sale' ? [{ label: 'Vendor', key: 'vendor_name' }] : []),
                    { label: 'Boxes', align: 'r', key: 'boxes_sold' }, { label: 'Revenue', align: 'r', render: (r) => money(r.revenue) }, { label: 'Cost of goods', align: 'r', render: (r) => money(r.cost_of_goods_sold) },
                    { label: 'Gross profit', align: 'r', render: (r) => <b className={r.gross_profit >= 0 ? 'pos' : 'neg'}>{money(r.gross_profit)}</b> }, { label: 'Margin', align: 'r', render: (r) => r.margin_percent + '%' }
                  ]} />
                )}
              </Async>
            </div>

            <div className="grid g2">
              <div className="card"><h3>🏆 Top 5 most frequently sold fruits</h3><HBars data={top.map((f) => ({ label: `${fruitEmoji(f.fruit_name)} ${f.fruit_name}`, value: f.boxes_sold }))} fmt={(v) => v + ' boxes'} /></div>
              <div className="card"><h3>🥇 Vendors buying the most boxes</h3>
                <Table rows={vend} empty="No sales yet." cols={[{ label: 'Vendor', render: (v) => <b>{v.vendor_name}</b> }, { label: 'Boxes', align: 'r', key: 'total_boxes' }, { label: 'Sales', align: 'r', key: 'number_of_sales' }, { label: 'Spent', align: 'r', render: (v) => money(v.total_spent) }]} />
              </div>
            </div>

            <div className="card">
              <h3>Sales trend
                <select style={{ width: 'auto' }} value={gran} onChange={(e) => setGran(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select>
              </h3>
              <Async state={trend}>
                {(t) => (
                  <>
                    <LineChart points={t.trend.map((x) => ({ label: x.period, value: x.revenue }))} />
                    <p className="hint">{t.highest_period ? `Highest: ${t.highest_period.period} (${money(t.highest_period.revenue)}). Lowest: ${t.lowest_period.period} (${money(t.lowest_period.revenue)}). Total ${money(t.total_revenue)}.` : ''}</p>
                  </>
                )}
              </Async>
            </div>

            <div className="card">
              <h3>Fruit demand analysis</h3>
              <p className="hint">Based on {demand.days} days of sales ({demand.from} to {demand.to}).</p>
              <Table rows={demand.fruits} cols={[
                { label: 'Fruit', render: (f) => <>{fruitEmoji(f.fruit_name)} <b>{f.fruit_name}</b></> }, { label: 'Boxes sold', align: 'r', key: 'boxes_sold' }, { label: 'Per day', align: 'r', key: 'avg_boxes_per_day' }, { label: 'In stock', align: 'r', key: 'stock_on_hand' },
                { label: 'Days of stock', align: 'r', render: (f) => (f.days_of_stock_left === null ? '-' : f.days_of_stock_left) }, { label: 'Demand', render: (f) => <Badge status={f.demand} /> }, { label: 'Suggestion', render: (f) => <small>{f.advice}</small> }
              ]} />
              <h3 style={{ marginTop: 14 }}>By packaging size</h3>
              <HBars data={demand.by_packaging.map((p) => ({ label: sizeLabel(p.packaging_size), value: p.boxes_sold }))} fmt={(v) => v + ' boxes'} />
            </div>

            <div className="card">
              <h3>Current stock levels by fruit and packaging size</h3>
              <Table rows={stock} cols={[
                { label: 'Fruit', render: (r) => <>{fruitEmoji(r.fruit_name)} {r.fruit_name}</> }, { label: 'Packaging', render: (r) => sizeLabel(r.packaging_size) }, { label: 'Available', align: 'r', render: (r) => <b>{r.available_quantity}</b> },
                { label: 'Minimum', align: 'r', key: 'minimum_quantity' }, { label: 'Status', render: (r) => <Badge status={r.stock_status} /> }
              ]} />
            </div>
          </>
        )}
      </Async>
    </>
  );
}
