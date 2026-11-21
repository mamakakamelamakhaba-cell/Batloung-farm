import { api, get } from '../api';
import { useToast } from '../context';
import { Async, Badge, CountUp, Empty, HBars, LineChart, Stat, Table, useAsync } from '../components/ui';
import { dt, fruitEmoji, money, sizeLabel } from '../utils';

export default function Dashboard() {
  const state = useAsync(() => get('/dashboard'), []);
  const toast = useToast();
  const writeOff = async () => {
    if (!window.confirm('Write off all expired boxes as spoiled?')) return;
    try { const r = await api('/stock/expired/write-off', { method: 'POST', body: {} }); toast(`${r.data.boxes_written_off} boxes written off`); state.reload(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Async state={state}>
      {(d) => {
        const expiry = [...d.expired.map((e) => ({ ...e, bad: true })), ...d.near_expiry];
        const M = ({ v }) => <CountUp value={v} isMoney />;
        return (
          <>
            <div className="stats">
              <Stat cls="o" emoji="💰" title="Sales today"><M v={d.sales_today} /></Stat>
              <Stat cls="g" emoji="📅" title="Sales this month"><M v={d.sales_this_month} /></Stat>
              <Stat cls="p" emoji="🚚" title="Total purchases"><M v={d.total_purchases} /></Stat>
              <Stat cls="t" emoji="📦" title={`Stock value (${d.stock_boxes_on_hand} boxes)`}><M v={d.current_stock_value} /></Stat>
              <Stat cls="y" emoji="🤝" title="Registered vendors"><CountUp value={d.registered_vendors} /></Stat>
              <Stat cls="r" emoji="⏰" title={`Outstanding (${d.vendors_owing} vendors)`}><M v={d.outstanding_vendor_payments} /></Stat>
              <Stat cls="r" emoji="🔥" title="Overdue payments"><M v={d.overdue_payments} /></Stat>
              <Stat cls="g" emoji="📈" title="Gross profit this month"><M v={d.gross_profit_this_month} /></Stat>
            </div>
            <div className="grid g2">
              <div className="card">
                <h3>🔔 Low-stock alerts <span className={`badge ${d.low_stock_alerts.length ? 'bad' : 'good'}`}>{d.low_stock_alerts.length}</span></h3>
                {d.low_stock_alerts.length ? d.low_stock_alerts.map((a, i) => (
                  <div key={i} className={`alert-row ${a.stock_status === 'CRITICAL' ? 'critical' : ''}`}>
                    <span className="dotp" />
                    <div style={{ flex: 1 }}><b>{fruitEmoji(a.fruit_name)} {a.fruit_name}</b> - {sizeLabel(a.packaging_size)}<br /><small>{a.available_quantity} boxes left, minimum {a.minimum_quantity}</small></div>
                    <Badge status={a.stock_status} />
                  </div>
                )) : <Empty icon="✅">All stock levels are healthy.</Empty>}
              </div>
              <div className="card">
                <h3>⏳ Expiry alerts <span className={`badge ${expiry.length ? 'warn' : 'good'}`}>{expiry.length}</span></h3>
                {expiry.length ? expiry.map((e, i) => (
                  <div key={i} className={`alert-row ${e.bad ? 'critical' : ''}`}>
                    <span className="dotp" />
                    <div style={{ flex: 1 }}><b>{fruitEmoji(e.fruit_name)} {e.fruit_name}</b> - {sizeLabel(e.packaging_size)}<br /><small>{e.quantity_remaining} boxes, expiry {dt(e.expiry_date)}</small></div>
                    <Badge status={e.expiry_status} />
                  </div>
                )) : <Empty icon="🌿">No batches near expiry.</Empty>}
                {d.expired.length > 0 && <button className="btn red sm" onClick={writeOff}>Write off expired stock</button>}
              </div>
            </div>
            <div className="grid g2">
              <div className="card"><h3>Sales - last 14 days</h3><LineChart points={d.sales_trend.map((t) => ({ label: t.period, value: t.revenue }))} /></div>
              <div className="card"><h3>🏆 Most frequently sold fruits (30 days)</h3><HBars data={d.top_fruits.map((f) => ({ label: `${fruitEmoji(f.fruit_name)} ${f.fruit_name}`, value: f.boxes_sold }))} fmt={(v) => v + ' boxes'} /></div>
            </div>
            <div className="grid g2">
              <div className="card">
                <h3>Recent sales <a className="btn ghost sm" href="#/sales">View all</a></h3>
                <Table rows={d.recent_sales} cols={[{ label: 'Invoice', key: 'invoice_number' }, { label: 'Vendor', key: 'vendor_name' }, { label: 'Total', align: 'r', render: (r) => money(r.total_amount) }, { label: 'Status', render: (r) => <Badge status={r.payment_status} /> }]} />
              </div>
              <div className="card">
                <h3>Recent purchases <a className="btn ghost sm" href="#/purchases">View all</a></h3>
                <Table rows={d.recent_purchases} cols={[{ label: 'Date', render: (r) => dt(r.purchase_date) }, { label: 'Supplier', key: 'supplier_name' }, { label: 'Total', align: 'r', render: (r) => money(r.total_amount) }]} />
              </div>
            </div>
          </>
        );
      }}
    </Async>
  );
}
