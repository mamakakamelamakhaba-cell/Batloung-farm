const { pool, paged, withTransaction } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { round2, addDateRange, whereSql } = require('../utils/helpers');
const stock = require('./stockModel');

/** Records a purchase with many items, calculates the total and INCREASES stock - all in one transaction. */
async function create(data, user) {
  const purchaseId = await withTransaction(async (conn) => {
    const [[supplier]] = await conn.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [data.supplier_id]);
    if (!supplier) throw new HttpError(404, `Supplier ${data.supplier_id} not found`);

    const ids = [...new Set(data.items.map((i) => i.fruit_id))];
    const [fruits] = await conn.query('SELECT fruit_id, fruit_name, status FROM fruits WHERE fruit_id IN (?)', [ids]);
    for (const it of data.items) {
      const f = fruits.find((x) => x.fruit_id === it.fruit_id);
      if (!f) throw new HttpError(404, `Fruit ${it.fruit_id} not found - the whole purchase was cancelled`);
      if (f.status !== 'AVAILABLE') throw new HttpError(400, `${f.fruit_name} is UNAVAILABLE and cannot be purchased`);
    }

    const [[{ today }]] = await conn.query('SELECT CURDATE() AS today');
    const purchaseDate = data.purchase_date || today;
    const deliveryDate = data.delivery_date || purchaseDate;
    const [p] = await conn.query(
      'INSERT INTO purchases (supplier_id, purchase_date, expected_delivery_date, delivery_date, total_amount, notes) VALUES (?,?,?,?,0,?)',
      [data.supplier_id, purchaseDate, data.expected_delivery_date || null, deliveryDate, data.notes || null]);

    let total = 0;
    for (const it of data.items) {
      const fruit = fruits.find((x) => x.fruit_id === it.fruit_id);
      const [d] = await conn.query(
        `INSERT INTO purchase_details (purchase_id, fruit_id, packaging_size, quantity, unit_cost, quantity_ordered, quantity_delivered, quantity_rejected, rejection_reason, expiry_date)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [p.insertId, it.fruit_id, it.packaging_size, it.quantity, it.unit_cost, it.quantity_ordered, it.quantity_delivered, it.quantity_rejected, it.rejection_reason || null, it.expiry_date || null]);
      if (it.quantity > 0) {
        await stock.receiveBatch(conn, {
          fruit_id: it.fruit_id, fruit_name: fruit.fruit_name, packaging_size: it.packaging_size, quantity: it.quantity, unit_cost: it.unit_cost,
          received_date: deliveryDate, expiry_date: it.expiry_date, purchase_detail_id: d.insertId, movement_type: 'PURCHASE',
          reference_type: 'PURCHASE', reference_id: p.insertId,
          reason: it.quantity_rejected ? `Purchase #${p.insertId} (${it.quantity_rejected} rejected)` : `Purchase #${p.insertId}`, user
        });
      }
      total += it.quantity * it.unit_cost;   // total is calculated automatically from ACCEPTED boxes
    }
    await conn.query('UPDATE purchases SET total_amount = ? WHERE purchase_id = ?', [round2(total), p.insertId]);
    return p.insertId;
  });
  return getById(purchaseId);
}

async function list({ supplier_id, from, to }, pg) {
  const where = [];
  const params = [];
  if (supplier_id) { where.push('p.supplier_id = ?'); params.push(supplier_id); }
  addDateRange(where, params, 'p.purchase_date', { from, to });
  return paged(
    `SELECT p.purchase_id, p.supplier_id, s.business_name AS supplier_name, s.province, p.purchase_date, p.expected_delivery_date, p.delivery_date,
            p.total_amount, p.notes, x.item_count, x.boxes_accepted, x.boxes_rejected
     FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id
     LEFT JOIN (SELECT purchase_id, COUNT(*) AS item_count, SUM(quantity) AS boxes_accepted, SUM(quantity_rejected) AS boxes_rejected
                FROM purchase_details GROUP BY purchase_id) x ON x.purchase_id = p.purchase_id
     ${whereSql(where)} ORDER BY p.purchase_date DESC, p.purchase_id DESC`, params, pg);
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT p.*, s.business_name AS supplier_name, s.contact_person, s.phone, s.province
     FROM purchases p JOIN suppliers s ON s.supplier_id = p.supplier_id WHERE p.purchase_id = ?`, [id]);
  if (!rows.length) throw new HttpError(404, `Purchase ${id} not found`);
  const [items] = await pool.query(
    `SELECT pd.*, f.fruit_name, ROUND(pd.quantity * pd.unit_cost, 2) AS line_total,
            (pd.quantity_ordered - pd.quantity_delivered) AS short_delivered
     FROM purchase_details pd JOIN fruits f ON f.fruit_id = pd.fruit_id WHERE pd.purchase_id = ? ORDER BY pd.purchase_detail_id`, [id]);
  return { ...rows[0], items };
}

/** Purchase cost tracking: previous vs current cost per fruit and packaging size. */
async function costTrends({ fruit_id, mode }) {
  const params = [];
  const where = fruit_id ? 'WHERE pd.fruit_id = ?' : '';
  if (fruit_id) params.push(fruit_id);
  const [rows] = await pool.query(
    `SELECT * FROM (
       SELECT pd.fruit_id, f.fruit_name, pd.packaging_size, p.purchase_date, pd.unit_cost AS current_cost,
              LAG(pd.unit_cost) OVER w AS previous_cost,
              pd.unit_cost - LAG(pd.unit_cost) OVER w AS difference,
              ROW_NUMBER() OVER (PARTITION BY pd.fruit_id, pd.packaging_size ORDER BY p.purchase_date DESC, pd.purchase_detail_id DESC) AS recency
       FROM purchase_details pd JOIN purchases p ON p.purchase_id = pd.purchase_id JOIN fruits f ON f.fruit_id = pd.fruit_id
       ${where}
       WINDOW w AS (PARTITION BY pd.fruit_id, pd.packaging_size ORDER BY p.purchase_date, pd.purchase_detail_id)
     ) t ${mode === 'history' ? '' : 'WHERE recency = 1'}
     ORDER BY fruit_name, FIELD(packaging_size,'SMALL','MEDIUM','LARGE'), purchase_date DESC`, params);
  return rows.map(({ recency, ...r }) => r);
}

module.exports = { create, list, getById, costTrends };
