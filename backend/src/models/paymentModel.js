const { pool, paged, withTransaction } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { round2, addDateRange, whereSql } = require('../utils/helpers');
const sales = require('./saleModel');

/** Records one payment against a sale (several payments per sale are allowed). */
async function addToSale(saleId, d) {
  await withTransaction(async (conn) => {
    const [[sale]] = await conn.query('SELECT * FROM sales WHERE sale_id = ? FOR UPDATE', [saleId]);
    if (!sale) throw new HttpError(404, `Sale ${saleId} not found`);
    const balance = round2(sale.total_amount - sale.returned_amount - sale.amount_paid);
    if (balance <= 0) throw new HttpError(400, `Invoice ${sale.invoice_number} is already fully paid`);
    if (d.amount > balance) throw new HttpError(400, `Payment of M${d.amount.toFixed(2)} is more than the outstanding balance of M${balance.toFixed(2)} on ${sale.invoice_number}`);
    await conn.query('INSERT INTO payments (sale_id, vendor_id, amount, payment_type, payment_method, reference_number, notes) VALUES (?,?,?,?,?,?,?)',
      [saleId, sale.vendor_id, d.amount, 'PAYMENT', d.payment_method, d.reference_number || null, d.notes || null]);
    await sales.recalcSale(conn, saleId);
  });
  return sales.getById(saleId);
}

/** One lump-sum payment from a vendor, applied to the OLDEST unpaid invoices first. */
async function addForVendor(vendorId, d) {
  return withTransaction(async (conn) => {
    const [[vendor]] = await conn.query('SELECT vendor_id, vendor_name FROM vendors WHERE vendor_id = ? FOR UPDATE', [vendorId]);
    if (!vendor) throw new HttpError(404, `Vendor ${vendorId} not found`);
    const [open] = await conn.query(
      `SELECT sale_id, invoice_number, total_amount - returned_amount - amount_paid AS balance FROM sales
       WHERE vendor_id = ? AND total_amount - returned_amount - amount_paid > 0 ORDER BY due_date, sale_id FOR UPDATE`, [vendorId]);
    const owed = round2(open.reduce((s, r) => s + r.balance, 0));
    if (owed <= 0) throw new HttpError(400, `${vendor.vendor_name} has no outstanding balance`);
    if (d.amount > owed) throw new HttpError(400, `Payment of M${d.amount.toFixed(2)} is more than the total outstanding balance of M${owed.toFixed(2)}`);
    let left = d.amount;
    const applied = [];
    for (const s of open) {
      if (left <= 0) break;
      const part = round2(Math.min(left, s.balance));
      await conn.query('INSERT INTO payments (sale_id, vendor_id, amount, payment_type, payment_method, reference_number, notes) VALUES (?,?,?,?,?,?,?)',
        [s.sale_id, vendorId, part, 'PAYMENT', d.payment_method, d.reference_number || null, d.notes || 'Lump-sum payment applied to oldest invoices']);
      await sales.recalcSale(conn, s.sale_id);
      applied.push({ invoice_number: s.invoice_number, amount_applied: part });
      left = round2(left - part);
    }
    return { vendor_id: vendorId, vendor_name: vendor.vendor_name, amount: d.amount, applied, remaining_balance: round2(owed - d.amount) };
  });
}

async function list({ sale_id, vendor_id, payment_method, payment_type, from, to }, pg) {
  const where = [];
  const params = [];
  if (sale_id) { where.push('p.sale_id = ?'); params.push(sale_id); }
  if (vendor_id) { where.push('p.vendor_id = ?'); params.push(vendor_id); }
  if (payment_method) { where.push('p.payment_method = ?'); params.push(payment_method); }
  if (payment_type) { where.push('p.payment_type = ?'); params.push(payment_type); }
  addDateRange(where, params, 'p.payment_date', { from, to });
  return paged(
    `SELECT p.payment_id, p.sale_id, s.invoice_number, p.vendor_id, v.vendor_name, p.amount, p.payment_type, p.payment_method,
            p.reference_number, p.payment_date, p.notes
     FROM payments p JOIN sales s ON s.sale_id = p.sale_id JOIN vendors v ON v.vendor_id = p.vendor_id ${whereSql(where)}
     ORDER BY p.payment_date DESC, p.payment_id DESC`, params, pg);
}

/** Vendors with outstanding balances, overdue amounts and last payment date (payment reminders). */
async function outstanding({ overdueOnly } = {}) {
  const bal = 'GREATEST(s.total_amount - s.returned_amount - s.amount_paid, 0)';
  const [rows] = await pool.query(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number, v.location, v.credit_limit,
            SUM(${bal}) AS outstanding,
            GREATEST(v.credit_limit - SUM(${bal}), 0) AS available_credit,
            SUM(CASE WHEN s.due_date < CURDATE() THEN ${bal} ELSE 0 END) AS overdue_amount,
            SUM(CASE WHEN ${bal} > 0 THEN 1 ELSE 0 END) AS unpaid_invoices,
            MIN(CASE WHEN ${bal} > 0 THEN s.due_date END) AS oldest_due_date,
            DATEDIFF(CURDATE(), MIN(CASE WHEN ${bal} > 0 AND s.due_date < CURDATE() THEN s.due_date END)) AS days_overdue,
            (SELECT MAX(p.payment_date) FROM payments p WHERE p.vendor_id = v.vendor_id AND p.payment_type = 'PAYMENT') AS last_payment_date
     FROM vendors v JOIN sales s ON s.vendor_id = v.vendor_id
     GROUP BY v.vendor_id, v.vendor_name, v.phone_number, v.location, v.credit_limit
     HAVING outstanding > 0 ${overdueOnly ? 'AND overdue_amount > 0' : ''}
     ORDER BY overdue_amount DESC, outstanding DESC`);
  return rows;
}

module.exports = { addToSale, addForVendor, list, outstanding };
