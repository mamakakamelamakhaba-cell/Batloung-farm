const crypto = require('crypto');
const { pool, paged, withTransaction } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { round2, addDateRange, whereSql } = require('../utils/helpers');
const stock = require('./stockModel');

const BAL = 'GREATEST(s.total_amount - s.returned_amount - s.amount_paid, 0)';

/** Re-derives returned_amount, amount_paid and payment_status (PAID / PARTIALLY_PAID / UNPAID) from the source tables. */
async function recalcSale(conn, saleId) {
  const [[a]] = await conn.query(
    `SELECT s.total_amount,
       COALESCE((SELECT SUM(refund_value) FROM sales_returns WHERE sale_id = s.sale_id), 0) AS returned,
       COALESCE((SELECT SUM(CASE WHEN payment_type = 'PAYMENT' THEN amount ELSE -amount END) FROM payments WHERE sale_id = s.sale_id), 0) AS paid
     FROM sales s WHERE s.sale_id = ?`, [saleId]);
  const returned = round2(a.returned);
  const paid = Math.max(round2(a.paid), 0);
  const net = round2(a.total_amount - returned);
  let status;
  if (net <= 0 || paid >= net) status = 'PAID';
  else if (paid <= 0) status = 'UNPAID';
  else status = 'PARTIALLY_PAID';
  await conn.query('UPDATE sales SET returned_amount = ?, amount_paid = ?, payment_status = ? WHERE sale_id = ?', [returned, paid, status, saleId]);
  return { net, paid, balance: Math.max(round2(net - paid), 0), status };
}

async function vendorOutstanding(db, vendorId) {
  const [[r]] = await db.query('SELECT COALESCE(SUM(GREATEST(total_amount - returned_amount - amount_paid, 0)), 0) AS o FROM sales WHERE vendor_id = ?', [vendorId]);
  return round2(r.o);
}

/**
 * Records a multi-item sale. EVERYTHING happens in one transaction:
 * price lookup -> automatic total -> credit-limit check -> FIFO stock deduction -> payment.
 * If any item fails (e.g. not enough stock) the whole sale is rolled back.
 */
async function create(data, user) {
  const saleId = await withTransaction(async (conn) => {
    const [[vendor]] = await conn.query('SELECT * FROM vendors WHERE vendor_id = ? FOR UPDATE', [data.vendor_id]);
    if (!vendor) throw new HttpError(404, `Vendor ${data.vendor_id} not found`);

    const ids = [...new Set(data.items.map((i) => i.fruit_id))];
    const [fruits] = await conn.query('SELECT fruit_id, fruit_name, status FROM fruits WHERE fruit_id IN (?)', [ids]);
    const [prices] = await conn.query('SELECT fruit_id, packaging_size, selling_price FROM fruit_prices WHERE fruit_id IN (?)', [ids]);

    // ---- automatic sales calculation ----
    let total = 0;
    const lines = data.items.map((it) => {
      const fruit = fruits.find((f) => f.fruit_id === it.fruit_id);
      if (!fruit) throw new HttpError(404, `Fruit ${it.fruit_id} not found - the whole sale was cancelled`);
      if (fruit.status !== 'AVAILABLE') throw new HttpError(400, `${fruit.fruit_name} is UNAVAILABLE and cannot be sold`);
      const price = prices.find((p) => p.fruit_id === it.fruit_id && p.packaging_size === it.packaging_size);
      if (!price) throw new HttpError(400, `No selling price is set for ${fruit.fruit_name} (${it.packaging_size})`);
      const lineTotal = round2(it.quantity * price.selling_price);
      total += lineTotal;
      return { ...it, fruit_name: fruit.fruit_name, unit_price: price.selling_price, line_total: lineTotal };
    });
    total = round2(total);

    // ---- payment / credit rules ----
    const method = data.payment_method;
    if (method === 'CREDIT' && data.amount_paid > 0) throw new HttpError(400, 'A CREDIT sale has no upfront payment. Use CASH or MOBILE_MONEY with amount_paid, or record payments after the sale.');
    const paid = method === 'CREDIT' ? 0 : (data.amount_paid !== undefined ? data.amount_paid : total);
    if (paid > total) throw new HttpError(400, `amount_paid (${paid}) cannot be more than the sale total (${total})`);
    const unpaid = round2(total - paid);
    if (unpaid > 0) {
      const outstanding = await vendorOutstanding(conn, vendor.vendor_id);
      const available = Math.max(round2(vendor.credit_limit - outstanding), 0);
      if (unpaid > available) {
        throw new HttpError(400, `Credit limit exceeded for ${vendor.vendor_name}: M${unpaid.toFixed(2)} would be owed on credit but only M${available.toFixed(2)} credit is available.`,
          { code: 'CREDIT_LIMIT_EXCEEDED', credit_limit: vendor.credit_limit, outstanding_balance: outstanding, available_credit: available, requested_credit: unpaid });
      }
    }

    const terms = data.payment_terms_days !== undefined ? data.payment_terms_days : (Number(process.env.DEFAULT_PAYMENT_TERMS_DAYS) || 14);
    const [[{ due }]] = await conn.query('SELECT COALESCE(?, DATE_ADD(CURDATE(), INTERVAL ? DAY)) AS due', [data.due_date || null, terms]);
    const [s] = await conn.query(
      `INSERT INTO sales (invoice_number, vendor_id, due_date, payment_method, payment_status, total_amount, notes) VALUES (?,?,?,?, 'UNPAID', ?, ?)`,
      [`TMP-${crypto.randomUUID()}`, vendor.vendor_id, due, method, total, data.notes || null]);
    const invoice = `INV-${new Date().getFullYear()}-${String(s.insertId).padStart(5, '0')}`;
    await conn.query('UPDATE sales SET invoice_number = ? WHERE sale_id = ?', [invoice, s.insertId]);

    // ---- stock deduction (FIFO) ----
    for (const l of lines) {
      const out = await stock.removeStock(conn, {
        fruit_id: l.fruit_id, fruit_name: l.fruit_name, packaging_size: l.packaging_size, quantity: l.quantity, movement_type: 'SALE',
        reference_type: 'SALE', reference_id: s.insertId, reason: `Sale ${invoice}`, user
      });
      const [d] = await conn.query('INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price, unit_cost) VALUES (?,?,?,?,?,?)',
        [s.insertId, l.fruit_id, l.packaging_size, l.quantity, l.unit_price, round2(out.total_cost / l.quantity)]);
      for (const a of out.allocations) {
        await conn.query('INSERT INTO sale_batch_allocations (sales_detail_id, batch_id, quantity) VALUES (?,?,?)', [d.insertId, a.batch_id, a.quantity]);
      }
    }

    if (paid > 0) {
      await conn.query('INSERT INTO payments (sale_id, vendor_id, amount, payment_type, payment_method, reference_number, notes) VALUES (?,?,?,?,?,?,?)',
        [s.insertId, vendor.vendor_id, paid, 'PAYMENT', method, data.reference_number || null, 'Payment at time of sale']);
    }
    await recalcSale(conn, s.insertId);
    return s.insertId;
  });
  return getById(saleId);
}

async function list({ vendor_id, payment_status, search, from, to }, pg) {
  const where = [];
  const params = [];
  if (vendor_id) { where.push('s.vendor_id = ?'); params.push(vendor_id); }
  if (payment_status) { where.push('s.payment_status = ?'); params.push(payment_status); }
  if (search) { where.push('(s.invoice_number LIKE ? OR v.vendor_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  addDateRange(where, params, 's.sale_date', { from, to });
  return paged(
    `SELECT s.sale_id, s.invoice_number, s.vendor_id, v.vendor_name, s.sale_date, s.due_date, s.payment_method, s.payment_status,
            s.total_amount, s.returned_amount, s.amount_paid, ${BAL} AS balance_due,
            (SELECT COALESCE(SUM(quantity),0) FROM sales_details d WHERE d.sale_id = s.sale_id) AS total_boxes
     FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id ${whereSql(where)}
     ORDER BY s.sale_date DESC, s.sale_id DESC`, params, pg);
}

/** Full sale (works with the pool or a transaction connection). */
async function fetchSale(db, id) {
  const [rows] = await db.query(
    `SELECT s.*, v.vendor_name, v.phone_number, v.location, v.credit_limit,
            ROUND(s.total_amount - s.returned_amount, 2) AS net_amount, ${BAL} AS balance_due
     FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id WHERE s.sale_id = ?`, [id]);
  if (!rows.length) throw new HttpError(404, `Sale ${id} not found`);
  const [items] = await db.query(
    `SELECT d.*, f.fruit_name, ROUND(d.quantity * d.unit_price, 2) AS line_total, (d.quantity - d.returned_quantity) AS returnable_quantity
     FROM sales_details d JOIN fruits f ON f.fruit_id = d.fruit_id WHERE d.sale_id = ? ORDER BY d.sales_detail_id`, [id]);
  const [payments] = await db.query('SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date, payment_id', [id]);
  const [returns] = await db.query(
    `SELECT r.*, f.fruit_name, d.packaging_size FROM sales_returns r JOIN sales_details d ON d.sales_detail_id = r.sales_detail_id
     JOIN fruits f ON f.fruit_id = d.fruit_id WHERE r.sale_id = ? ORDER BY r.return_id`, [id]);
  return { ...rows[0], items, payments, returns };
}

const getById = (id) => fetchSale(pool, id);

async function invoice(id) {
  const sale = await getById(id);
  return {
    business: {
      name: process.env.BUSINESS_NAME || 'Batloung Farm', address: process.env.BUSINESS_ADDRESS || 'Maseru, Lesotho',
      phone: process.env.BUSINESS_PHONE || '', email: process.env.BUSINESS_EMAIL || ''
    },
    invoice_number: sale.invoice_number, sale
  };
}

module.exports = { create, list, getById, fetchSale, invoice, recalcSale, vendorOutstanding };
