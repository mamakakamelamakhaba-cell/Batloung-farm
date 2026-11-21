/** Reports, analytics and the dashboard. */
const { pool } = require('../../config/db');
const { round2, ymd, addDateRange, whereSql } = require('../utils/helpers');
const stockModel = require('./stockModel');

const COGS_JOIN = `LEFT JOIN (SELECT a.sales_detail_id, SUM((a.quantity - a.restocked_quantity) * b.unit_cost) AS cogs
                              FROM sale_batch_allocations a JOIN stock_batches b ON b.batch_id = a.batch_id
                              GROUP BY a.sales_detail_id) c ON c.sales_detail_id = sd.sales_detail_id`;

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

// ---- required SQL reports ------------------------------------------------
/** The five most frequently sold fruits. */
async function topFruits({ from, to, limit = 5 }) {
  const where = [];
  const params = [];
  addDateRange(where, params, 's.sale_date', { from, to });
  const [rows] = await pool.query(
    `SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity - sd.returned_quantity) AS boxes_sold,
            COUNT(DISTINCT sd.sale_id) AS number_of_sales, SUM((sd.quantity - sd.returned_quantity) * sd.unit_price) AS revenue
     FROM sales_details sd JOIN sales s ON s.sale_id = sd.sale_id JOIN fruits f ON f.fruit_id = sd.fruit_id
     ${whereSql(where)} GROUP BY f.fruit_id, f.fruit_name ORDER BY boxes_sold DESC, number_of_sales DESC LIMIT ?`, [...params, Number(limit)]);
  return rows;
}

/** Total sales revenue in a date range. */
async function revenue({ from, to }) {
  const where = [];
  const params = [];
  addDateRange(where, params, 'sale_date', { from, to });
  const [[r]] = await pool.query(
    `SELECT COUNT(*) AS number_of_sales, COALESCE(SUM(total_amount),0) AS total_sales_revenue, COALESCE(SUM(returned_amount),0) AS returns_value,
            COALESCE(SUM(total_amount - returned_amount),0) AS net_revenue, COALESCE(SUM(amount_paid),0) AS amount_collected,
            COALESCE(SUM(GREATEST(total_amount - returned_amount - amount_paid,0)),0) AS amount_outstanding
     FROM sales ${whereSql(where)}`, params);
  return { from, to, ...r };
}

/** Vendor(s) who purchased the highest number of boxes. */
async function topVendors({ from, to, limit = 1 }) {
  const where = [];
  const params = [];
  addDateRange(where, params, 's.sale_date', { from, to });
  const [rows] = await pool.query(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number, SUM(sd.quantity) AS total_boxes, COUNT(DISTINCT s.sale_id) AS number_of_sales,
            SUM(sd.quantity * sd.unit_price) AS total_spent
     FROM vendors v JOIN sales s ON s.vendor_id = v.vendor_id JOIN sales_details sd ON sd.sale_id = s.sale_id ${whereSql(where)}
     GROUP BY v.vendor_id, v.vendor_name, v.phone_number ORDER BY total_boxes DESC LIMIT ?`, [...params, Number(limit)]);
  return rows;
}

// ---- profit & loss -------------------------------------------------------
const GROUPS = {
  summary: { select: `'All sales' AS label`, group: '', order: '' },
  fruit: { select: 'f.fruit_id, f.fruit_name AS label', group: 'GROUP BY f.fruit_id, f.fruit_name', order: 'ORDER BY revenue DESC' },
  packaging: { select: 'sd.packaging_size AS label', group: 'GROUP BY sd.packaging_size', order: `ORDER BY FIELD(sd.packaging_size,'SMALL','MEDIUM','LARGE')` },
  fruit_packaging: { select: `f.fruit_id, sd.packaging_size, CONCAT(f.fruit_name, ' - ', sd.packaging_size) AS label`, group: 'GROUP BY f.fruit_id, f.fruit_name, sd.packaging_size', order: 'ORDER BY f.fruit_name, FIELD(sd.packaging_size,\'SMALL\',\'MEDIUM\',\'LARGE\')' },
  sale: { select: 's.sale_id, s.invoice_number AS label, s.sale_date, v.vendor_name', group: 'GROUP BY s.sale_id, s.invoice_number, s.sale_date, v.vendor_name', order: 'ORDER BY s.sale_date DESC' }
};

/** Gross profit = Sales revenue - Cost of goods sold (FIFO batch cost). */
async function profit({ group_by = 'summary', from, to }) {
  const g = GROUPS[group_by] || GROUPS.summary;
  const where = [];
  const params = [];
  addDateRange(where, params, 's.sale_date', { from, to });
  const [rows] = await pool.query(
    `SELECT ${g.select}, SUM((sd.quantity - sd.returned_quantity) * sd.unit_price) AS revenue, COALESCE(SUM(c.cogs), 0) AS cost_of_goods_sold,
            SUM(sd.quantity - sd.returned_quantity) AS boxes_sold
     FROM sales_details sd JOIN sales s ON s.sale_id = sd.sale_id JOIN fruits f ON f.fruit_id = sd.fruit_id JOIN vendors v ON v.vendor_id = s.vendor_id
     ${COGS_JOIN} ${whereSql(where)} ${g.group} ${g.order}`, params);
  const data = rows.filter((r) => r.revenue !== null).map((r) => {
    const gp = round2(r.revenue - r.cost_of_goods_sold);
    return { ...r, revenue: round2(r.revenue), cost_of_goods_sold: round2(r.cost_of_goods_sold), gross_profit: gp, margin_percent: r.revenue ? round2((gp / r.revenue) * 100) : 0 };
  });
  const result = { group_by: GROUPS[group_by] ? group_by : 'summary', from, to, note: 'Gross profit = sales revenue - cost of goods sold. Operating expenses are NOT deducted.', rows: data };
  if (group_by === 'summary' || !GROUPS[group_by]) {
    const ew = [];
    const ep = [];
    addDateRange(ew, ep, 'expense_date', { from, to });
    const [[e]] = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses ${whereSql(ew)}`, ep);
    const s = data[0] || { revenue: 0, cost_of_goods_sold: 0, gross_profit: 0, margin_percent: 0, boxes_sold: 0 };
    result.summary = { ...s, operating_expenses: round2(e.total), net_profit_after_expenses: round2(s.gross_profit - e.total) };
  }
  return result;
}

// ---- trends & demand -------------------------------------------------------
async function salesTrend({ granularity = 'day', from, to }) {
  const expr = { day: 'DATE(s.sale_date)', week: 'DATE_SUB(DATE(s.sale_date), INTERVAL WEEKDAY(s.sale_date) DAY)', month: `DATE_FORMAT(s.sale_date, '%Y-%m')` }[granularity] || 'DATE(s.sale_date)';
  if (!from && !to) {
    from = granularity === 'month' ? daysAgo(365) : granularity === 'week' ? daysAgo(84) : daysAgo(29);
    to = ymd(new Date());
  }
  const where = [];
  const params = [];
  addDateRange(where, params, 's.sale_date', { from, to });
  const [rows] = await pool.query(
    `SELECT ${expr} AS period, COUNT(*) AS number_of_sales, SUM(s.total_amount - s.returned_amount) AS revenue, COALESCE(SUM(b.boxes),0) AS boxes_sold
     FROM sales s LEFT JOIN (SELECT sale_id, SUM(quantity - returned_quantity) AS boxes FROM sales_details GROUP BY sale_id) b ON b.sale_id = s.sale_id
     ${whereSql(where)} GROUP BY period ORDER BY period`, params);
  const [byFruit] = await pool.query(
    `SELECT f.fruit_name, SUM(sd.quantity - sd.returned_quantity) AS boxes_sold, SUM((sd.quantity - sd.returned_quantity) * sd.unit_price) AS revenue
     FROM sales_details sd JOIN sales s ON s.sale_id = sd.sale_id JOIN fruits f ON f.fruit_id = sd.fruit_id
     ${whereSql(where)} GROUP BY f.fruit_id, f.fruit_name ORDER BY boxes_sold DESC`, params);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const best = rows.reduce((m, r) => (!m || r.revenue > m.revenue ? r : m), null);
  const worst = rows.reduce((m, r) => (!m || r.revenue < m.revenue ? r : m), null);
  return { granularity, from, to, total_revenue: round2(total), highest_period: best, lowest_period: worst, trend: rows, popular_fruits: byFruit };
}

/** Which fruits sell fast / slowly, and how many days of stock are left. */
async function fruitDemand({ from, to }) {
  if (!from || !to) { from = daysAgo(29); to = ymd(new Date()); }
  const where = [];
  const params = [];
  addDateRange(where, params, 's.sale_date', { from, to });
  const [rows] = await pool.query(
    `SELECT f.fruit_id, f.fruit_name, COALESCE(x.boxes_sold,0) AS boxes_sold, COALESCE(x.number_of_sales,0) AS number_of_sales,
            COALESCE(st.on_hand,0) AS stock_on_hand
     FROM fruits f
     LEFT JOIN (SELECT sd.fruit_id, SUM(sd.quantity - sd.returned_quantity) AS boxes_sold, COUNT(DISTINCT sd.sale_id) AS number_of_sales
                FROM sales_details sd JOIN sales s ON s.sale_id = sd.sale_id ${whereSql(where)} GROUP BY sd.fruit_id) x ON x.fruit_id = f.fruit_id
     LEFT JOIN (SELECT fruit_id, SUM(available_quantity) AS on_hand FROM stock GROUP BY fruit_id) st ON st.fruit_id = f.fruit_id
     WHERE f.status = 'AVAILABLE' ORDER BY boxes_sold DESC`, params);
  const days = Math.max(Math.round((new Date(to) - new Date(from)) / 86400000) + 1, 1);
  const avg = rows.length ? rows.reduce((s, r) => s + r.boxes_sold, 0) / rows.length : 0;
  const fruits = rows.map((r) => {
    const perDay = r.boxes_sold / days;
    const ratio = avg ? r.boxes_sold / avg : 0;
    const demand = ratio >= 1.2 ? 'FAST' : ratio <= 0.6 ? 'SLOW' : 'STEADY';
    const daysLeft = perDay > 0 ? Math.floor(r.stock_on_hand / perDay) : null;
    const advice = demand === 'FAST' ? 'High demand - prioritise this fruit in the next purchase order.'
      : demand === 'SLOW' ? 'Slow seller - buy smaller quantities to reduce spoilage.' : 'Steady demand - keep current purchasing levels.';
    return { ...r, avg_boxes_per_day: round2(perDay), days_of_stock_left: daysLeft, demand, advice };
  });
  const [bySize] = await pool.query(
    `SELECT sd.packaging_size, SUM(sd.quantity - sd.returned_quantity) AS boxes_sold FROM sales_details sd JOIN sales s ON s.sale_id = sd.sale_id
     ${whereSql(where)} GROUP BY sd.packaging_size ORDER BY FIELD(sd.packaging_size,'SMALL','MEDIUM','LARGE')`, params);
  return { from, to, days, fruits, by_packaging: bySize };
}

// ---- dashboard -----------------------------------------------------------
async function dashboard() {
  const q = async (sql, p = []) => (await pool.query(sql, p))[0];
  const today = ymd(new Date());
  const first = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [salesToday, salesMonth, purchMonth, purchTotal, stockVal, vendors, owed, expMonth, recentPurch, recentSales, lowStock, expiry, top, trend, gp] = await Promise.all([
    q(`SELECT COUNT(*) AS n, COALESCE(SUM(total_amount - returned_amount),0) AS amount FROM sales WHERE sale_date >= CURDATE() AND sale_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`),
    q(`SELECT COUNT(*) AS n, COALESCE(SUM(total_amount - returned_amount),0) AS amount FROM sales WHERE sale_date >= ?`, [first]),
    q(`SELECT COALESCE(SUM(total_amount),0) AS amount FROM purchases WHERE purchase_date >= ?`, [first]),
    q(`SELECT COALESCE(SUM(total_amount),0) AS amount, COUNT(*) AS n FROM purchases`),
    q(`SELECT COALESCE(SUM(quantity_remaining * unit_cost),0) AS cost_value, COALESCE(SUM(quantity_remaining),0) AS boxes FROM stock_batches`),
    q(`SELECT COUNT(*) AS n FROM vendors`),
    q(`SELECT COALESCE(SUM(GREATEST(total_amount - returned_amount - amount_paid,0)),0) AS outstanding,
              COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN GREATEST(total_amount - returned_amount - amount_paid,0) ELSE 0 END),0) AS overdue,
              COUNT(DISTINCT CASE WHEN total_amount - returned_amount - amount_paid > 0 THEN vendor_id END) AS vendors_owing FROM sales`),
    q(`SELECT COALESCE(SUM(amount),0) AS amount FROM expenses WHERE expense_date >= ?`, [first]),
    q(`SELECT p.purchase_id, s.business_name AS supplier_name, p.purchase_date, p.total_amount FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id ORDER BY p.purchase_date DESC, p.purchase_id DESC LIMIT 5`),
    q(`SELECT s.sale_id, s.invoice_number, v.vendor_name, s.sale_date, s.total_amount, s.payment_status FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id ORDER BY s.sale_date DESC, s.sale_id DESC LIMIT 5`),
    stockModel.lowStock(),
    stockModel.expiryAlerts(),
    topFruits({ from: daysAgo(29), to: today, limit: 5 }),
    salesTrend({ granularity: 'day', from: daysAgo(13), to: today }),
    profit({ group_by: 'summary', from: first, to: today })
  ]);
  return {
    generated_at: new Date().toISOString(),
    sales_today: round2(salesToday[0].amount), sales_today_count: salesToday[0].n,
    sales_this_month: round2(salesMonth[0].amount), sales_this_month_count: salesMonth[0].n,
    purchases_this_month: round2(purchMonth[0].amount), total_purchases: round2(purchTotal[0].amount), purchase_count: purchTotal[0].n,
    current_stock_value: round2(stockVal[0].cost_value), stock_boxes_on_hand: stockVal[0].boxes,
    registered_vendors: vendors[0].n,
    outstanding_vendor_payments: round2(owed[0].outstanding), overdue_payments: round2(owed[0].overdue), vendors_owing: owed[0].vendors_owing,
    expenses_this_month: round2(expMonth[0].amount),
    gross_profit_this_month: gp.summary.gross_profit,
    low_stock_alerts: lowStock,
    near_expiry: expiry.near_expiry, expired: expiry.expired,
    top_fruits: top, sales_trend: trend.trend,
    recent_purchases: recentPurch, recent_sales: recentSales
  };
}

module.exports = { topFruits, revenue, topVendors, profit, salesTrend, fruitDemand, dashboard };
