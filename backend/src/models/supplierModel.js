const { pool, paged } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { updateById } = require('./common');

async function create(d) {
  const [r] = await pool.query('INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES (?,?,?,?,?)',
    [d.business_name, d.contact_person, d.phone, d.province, d.address]);
  return getById(r.insertId);
}

async function list({ search, province }, pg) {
  const where = [];
  const params = [];
  if (search) { where.push('(business_name LIKE ? OR contact_person LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (province) { where.push('province = ?'); params.push(province); }
  return paged(`SELECT * FROM suppliers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY business_name`, params, pg);
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM suppliers WHERE supplier_id = ?', [id]);
  if (!rows.length) throw new HttpError(404, `Supplier ${id} not found`);
  return rows[0];
}

async function update(id, data) {
  await getById(id);
  await updateById('suppliers', 'supplier_id', id, data);
  return getById(id);
}

/** Business constraint: a supplier with recorded purchases cannot be deleted (history must be preserved). */
async function remove(id) {
  const supplier = await getById(id);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?', [id]);
  if (n > 0) throw new HttpError(409, `Cannot delete "${supplier.business_name}": it has ${n} recorded purchase(s). Suppliers with purchase history cannot be removed.`);
  await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
  return supplier;
}

function rate(row) {
  if (!row.deliveries) return { score: null, rating: 'No data' };
  const delayRate = row.delayed_deliveries / row.deliveries;
  const damagedRate = row.damaged_deliveries / row.deliveries;
  const rejectRate = row.qty_delivered ? row.qty_rejected / row.qty_delivered : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - delayRate * 35 - damagedRate * 40 - rejectRate * 100)));
  const rating = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Needs attention' : 'Poor';
  return { score, rating };
}

/** Supplier performance: deliveries, delays, damaged/rejected fruit, reliability, average cost. */
async function performance(supplierId) {
  const [rows] = await pool.query(
    `SELECT s.supplier_id, s.business_name, s.province,
        COALESCE(pa.deliveries,0) AS deliveries, COALESCE(pa.total_purchases,0) AS total_purchases,
        COALESCE(pa.delayed_deliveries,0) AS delayed_deliveries, COALESCE(pa.avg_delay_days,0) AS avg_delay_days,
        COALESCE(da.damaged_deliveries,0) AS damaged_deliveries, COALESCE(da.qty_ordered,0) AS qty_ordered,
        COALESCE(da.qty_delivered,0) AS qty_delivered, COALESCE(da.qty_accepted,0) AS qty_accepted,
        COALESCE(da.qty_rejected,0) AS qty_rejected, COALESCE(da.avg_unit_cost,0) AS avg_unit_cost
     FROM suppliers s
     LEFT JOIN (SELECT supplier_id, COUNT(*) AS deliveries, SUM(total_amount) AS total_purchases,
          SUM(CASE WHEN delivery_date > expected_delivery_date THEN 1 ELSE 0 END) AS delayed_deliveries,
          ROUND(AVG(CASE WHEN delivery_date IS NOT NULL AND expected_delivery_date IS NOT NULL
                         THEN GREATEST(DATEDIFF(delivery_date, expected_delivery_date), 0) END), 1) AS avg_delay_days
        FROM purchases GROUP BY supplier_id) pa ON pa.supplier_id = s.supplier_id
     LEFT JOIN (SELECT p.supplier_id,
          COUNT(DISTINCT CASE WHEN pd.quantity_rejected > 0 THEN p.purchase_id END) AS damaged_deliveries,
          SUM(pd.quantity_ordered) AS qty_ordered, SUM(pd.quantity_delivered) AS qty_delivered,
          SUM(pd.quantity) AS qty_accepted, SUM(pd.quantity_rejected) AS qty_rejected,
          ROUND(SUM(pd.unit_cost * pd.quantity) / NULLIF(SUM(pd.quantity), 0), 2) AS avg_unit_cost
        FROM purchases p JOIN purchase_details pd ON pd.purchase_id = p.purchase_id GROUP BY p.supplier_id) da
        ON da.supplier_id = s.supplier_id
     ${supplierId ? 'WHERE s.supplier_id = ?' : ''} ORDER BY s.business_name`, supplierId ? [supplierId] : []);
  if (supplierId && !rows.length) throw new HttpError(404, `Supplier ${supplierId} not found`);
  const out = rows.map((r) => ({ ...r, ...rate(r) }));
  return supplierId ? out[0] : out;
}

module.exports = { create, list, getById, update, remove, performance };
