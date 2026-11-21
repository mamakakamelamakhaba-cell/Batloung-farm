const { pool, paged } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { round2, resolvePeriod } = require('../utils/helpers');
const { updateById } = require('./common');

const BAL = 'GREATEST(total_amount - returned_amount - amount_paid, 0)';

const BASE = `SELECT v.*, COALESCE(o.outstanding, 0) AS outstanding_balance,
    GREATEST(v.credit_limit - COALESCE(o.outstanding, 0), 0) AS available_credit,
    COALESCE(o.total_purchases, 0) AS total_purchases, COALESCE(o.sales_count, 0) AS sales_count
  FROM vendors v LEFT JOIN (
    SELECT vendor_id, SUM(${BAL}) AS outstanding, SUM(total_amount - returned_amount) AS total_purchases, COUNT(*) AS sales_count
    FROM sales GROUP BY vendor_id) o ON o.vendor_id = v.vendor_id`;

async function create(d) {
  const [r] = await pool.query('INSERT INTO vendors (vendor_name, phone_number, location, credit_limit) VALUES (?,?,?,?)',
    [d.vendor_name, d.phone_number, d.location, d.credit_limit || 0]);
  return getById(r.insertId);
}

/** Search by name OR phone number (?search=). */
async function list({ search, has_balance }, pg) {
  const where = [];
  const params = [];
  if (search) { where.push('(vendor_name LIKE ? OR phone_number LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (has_balance === 'true') where.push('outstanding_balance > 0');
  return paged(`SELECT * FROM (${BASE}) t ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY vendor_name`, params, pg);
}

async function getById(id) {
  const [rows] = await pool.query(`SELECT * FROM (${BASE}) t WHERE vendor_id = ?`, [id]);
  if (!rows.length) throw new HttpError(404, `Vendor ${id} not found`);
  return rows[0];
}

async function update(id, data) {
  await getById(id);
  await updateById('vendors', 'vendor_id', id, data);
  return getById(id);
}

/** Dedicated vendor profile: details, totals, histories and favourite fruits. */
async function profile(id) {
  const vendor = await getById(id);
  const [[pay]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN payment_type='PAYMENT' THEN amount ELSE -amount END),0) AS total_paid FROM payments WHERE vendor_id = ?`, [id]);
  const [sales] = await pool.query(
    `SELECT s.sale_id, s.invoice_number, s.sale_date, s.due_date, s.payment_method, s.payment_status, s.total_amount, s.returned_amount, s.amount_paid,
            ${BAL} AS balance_due, (SELECT SUM(quantity) FROM sales_details d WHERE d.sale_id = s.sale_id) AS total_boxes
     FROM sales s WHERE s.vendor_id = ? ORDER BY s.sale_date DESC LIMIT 100`, [id]);
  const [payments] = await pool.query(
    `SELECT p.payment_id, p.sale_id, s.invoice_number, p.amount, p.payment_type, p.payment_method, p.reference_number, p.payment_date, p.notes
     FROM payments p JOIN sales s ON s.sale_id = p.sale_id WHERE p.vendor_id = ? ORDER BY p.payment_date DESC LIMIT 100`, [id]);
  const [returns] = await pool.query(
    `SELECT r.return_id, s.invoice_number, f.fruit_name, d.packaging_size, r.quantity, r.reason, r.restocked_quantity, r.refund_value, r.return_date
     FROM sales_returns r JOIN sales s ON s.sale_id = r.sale_id JOIN sales_details d ON d.sales_detail_id = r.sales_detail_id
     JOIN fruits f ON f.fruit_id = d.fruit_id WHERE s.vendor_id = ? ORDER BY r.return_date DESC`, [id]);
  const [favourites] = await pool.query(
    `SELECT f.fruit_id, f.fruit_name, SUM(d.quantity - d.returned_quantity) AS boxes_bought, COUNT(DISTINCT d.sale_id) AS times_bought
     FROM sales_details d JOIN sales s ON s.sale_id = d.sale_id JOIN fruits f ON f.fruit_id = d.fruit_id
     WHERE s.vendor_id = ? GROUP BY f.fruit_id, f.fruit_name ORDER BY boxes_bought DESC LIMIT 5`, [id]);
  return {
    vendor,
    summary: {
      registration_date: vendor.registration_date, total_purchases: round2(vendor.total_purchases), total_paid: round2(pay.total_paid),
      outstanding_balance: round2(vendor.outstanding_balance), credit_limit: vendor.credit_limit, available_credit: round2(vendor.available_credit),
      number_of_sales: vendor.sales_count
    },
    purchase_history: sales, payment_history: payments, returns, most_purchased_fruits: favourites
  };
}

/** Account statement for a period: previous balance, purchases, payments, returns, current balance. */
async function statement(id, query) {
  const vendor = await getById(id);
  let { from, to } = resolvePeriod(query);
  if (!from || !to) ({ from, to } = resolvePeriod({ period: 'month' }));
  const [ledger] = await pool.query(
    `SELECT * FROM (SELECT 'SALE' AS entry_type, s.sale_date AS entry_date, s.invoice_number AS reference, CONCAT('Sale ', s.invoice_number) AS description, s.total_amount AS debit, 0 AS credit
       FROM sales s WHERE s.vendor_id = ?
     UNION ALL
     SELECT 'PAYMENT', p.payment_date, COALESCE(p.reference_number, CONCAT('PAY-', p.payment_id)), CONCAT('Payment received (', p.payment_method, ')'), 0, p.amount
       FROM payments p WHERE p.vendor_id = ? AND p.payment_type = 'PAYMENT'
     UNION ALL
     SELECT 'REFUND', p.payment_date, COALESCE(p.reference_number, CONCAT('REF-', p.payment_id)), CONCAT('Refund paid to vendor (', p.payment_method, ')'), p.amount, 0
       FROM payments p WHERE p.vendor_id = ? AND p.payment_type = 'REFUND'
     UNION ALL
     SELECT 'RETURN', r.return_date, CONCAT('RET-', r.return_id), CONCAT('Return/credit: ', r.quantity, ' x ', f.fruit_name, ' ', d.packaging_size), 0, r.refund_value
       FROM sales_returns r JOIN sales s ON s.sale_id = r.sale_id JOIN sales_details d ON d.sales_detail_id = r.sales_detail_id
       JOIN fruits f ON f.fruit_id = d.fruit_id WHERE s.vendor_id = ?) ledger
     ORDER BY entry_date, FIELD(entry_type, 'SALE', 'PAYMENT', 'RETURN', 'REFUND')`, [id, id, id, id]);

  const day = (e) => e.entry_date.slice(0, 10);
  const opening = round2(ledger.filter((e) => day(e) < from).reduce((s, e) => s + e.debit - e.credit, 0));
  const lines = ledger.filter((e) => day(e) >= from && day(e) <= to);
  let running = opening;
  const rows = lines.map((e) => { running = round2(running + e.debit - e.credit); return { ...e, balance: running }; });
  const sum = (type, col) => round2(lines.filter((e) => e.entry_type === type).reduce((s, e) => s + e[col], 0));
  return {
    vendor: { vendor_id: vendor.vendor_id, vendor_name: vendor.vendor_name, phone_number: vendor.phone_number, location: vendor.location, credit_limit: vendor.credit_limit },
    period: { from, to },
    previous_balance: opening,
    new_purchases: sum('SALE', 'debit'),
    payments_received: sum('PAYMENT', 'credit'),
    returns_credit_adjustments: sum('RETURN', 'credit'),
    refunds_paid_out: sum('REFUND', 'debit'),
    current_balance: running,
    outstanding_balance_today: round2(vendor.outstanding_balance),
    lines: rows
  };
}

module.exports = { create, list, getById, update, profile, statement };
