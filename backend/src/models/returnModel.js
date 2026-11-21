const { pool, paged, withTransaction } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { round2, addDateRange, whereSql } = require('../utils/helpers');
const stock = require('./stockModel');
const sales = require('./saleModel');

/**
 * Vendor return. For every returned line the system:
 *  1) finds the original sale line  2) records quantity + reason
 *  3) restocks the boxes ONLY if the admin says they are good AND their batch has not expired
 *  4) calculates the refund and splits it into (a) credit adjustment on the vendor balance and (b) cash refund of money already paid
 *  5) recalculates the invoice balance and payment status
 */
async function create(data, user) {
  const saleId = await withTransaction(async (conn) => {
    const [[sale]] = await conn.query('SELECT * FROM sales WHERE sale_id = ? FOR UPDATE', [data.sale_id]);
    if (!sale) throw new HttpError(404, `Sale ${data.sale_id} not found`);
    let net = round2(sale.total_amount - sale.returned_amount);
    let paid = sale.amount_paid;

    for (const it of data.items) {
      const [[d]] = await conn.query(
        `SELECT sd.*, f.fruit_name FROM sales_details sd JOIN fruits f ON f.fruit_id = sd.fruit_id
         WHERE sd.sales_detail_id = ? AND sd.sale_id = ? FOR UPDATE`, [it.sales_detail_id, data.sale_id]);
      if (!d) throw new HttpError(404, `Sale line ${it.sales_detail_id} does not belong to sale ${data.sale_id}`);
      const returnable = d.quantity - d.returned_quantity;
      if (it.quantity > returnable) {
        throw new HttpError(400, `Cannot return ${it.quantity} box(es) of ${d.fruit_name} (${d.packaging_size}): only ${returnable} of the ${d.quantity} sold can still be returned.`);
      }
      const refund = round2(it.quantity * d.unit_price);
      const credit = round2(Math.min(refund, Math.max(net - paid, 0)));   // reduces what the vendor still owes
      const cash = round2(refund - credit);                              // money already paid that goes back to the vendor

      const [r] = await conn.query(
        `INSERT INTO sales_returns (sale_id, sales_detail_id, quantity, reason, restocked_quantity, refund_value, credit_adjustment, cash_refund, processed_by)
         VALUES (?,?,?,?,0,?,?,?,?)`, [data.sale_id, d.sales_detail_id, it.quantity, it.reason, refund, credit, cash, user]);

      const [allocs] = await conn.query(
        `SELECT a.allocation_id, a.batch_id, a.quantity, a.returned_quantity,
                (b.expiry_date IS NOT NULL AND b.expiry_date < CURDATE()) AS is_expired
         FROM sale_batch_allocations a JOIN stock_batches b ON b.batch_id = a.batch_id
         WHERE a.sales_detail_id = ? AND a.quantity - a.returned_quantity > 0 ORDER BY a.allocation_id DESC FOR UPDATE`, [d.sales_detail_id]);
      let left = it.quantity;
      let restocked = 0;
      for (const a of allocs) {
        if (left <= 0) break;
        const take = Math.min(a.quantity - a.returned_quantity, left);
        const canRestock = it.restock && !a.is_expired;
        await conn.query('UPDATE sale_batch_allocations SET returned_quantity = returned_quantity + ?, restocked_quantity = restocked_quantity + ? WHERE allocation_id = ?',
          [take, canRestock ? take : 0, a.allocation_id]);
        if (canRestock) {
          await stock.restoreToBatch(conn, { fruit_id: d.fruit_id, packaging_size: d.packaging_size, quantity: take, batch_id: a.batch_id,
            reference_type: 'RETURN', reference_id: r.insertId, reason: `Return: ${it.reason}`, user });
          restocked += take;
        }
        left -= take;
      }
      await conn.query('UPDATE sales_returns SET restocked_quantity = ? WHERE return_id = ?', [restocked, r.insertId]);
      await conn.query('UPDATE sales_details SET returned_quantity = returned_quantity + ? WHERE sales_detail_id = ?', [it.quantity, d.sales_detail_id]);
      if (cash > 0) {
        await conn.query('INSERT INTO payments (sale_id, vendor_id, amount, payment_type, payment_method, notes) VALUES (?,?,?,?,?,?)',
          [data.sale_id, sale.vendor_id, cash, 'REFUND', data.refund_method, `Refund for returned ${d.fruit_name} (${d.packaging_size})`]);
      }
      net = round2(net - refund);
      paid = round2(paid - cash);
    }
    await sales.recalcSale(conn, data.sale_id);
    return data.sale_id;
  });
  return sales.getById(saleId);
}

async function list({ sale_id, vendor_id, from, to }, pg) {
  const where = [];
  const params = [];
  if (sale_id) { where.push('r.sale_id = ?'); params.push(sale_id); }
  if (vendor_id) { where.push('s.vendor_id = ?'); params.push(vendor_id); }
  addDateRange(where, params, 'r.return_date', { from, to });
  return paged(
    `SELECT r.return_id, r.sale_id, s.invoice_number, s.vendor_id, v.vendor_name, f.fruit_name, d.packaging_size, r.quantity, r.reason,
            r.restocked_quantity, r.refund_value, r.credit_adjustment, r.cash_refund, r.return_date, r.processed_by
     FROM sales_returns r JOIN sales s ON s.sale_id = r.sale_id JOIN vendors v ON v.vendor_id = s.vendor_id
     JOIN sales_details d ON d.sales_detail_id = r.sales_detail_id JOIN fruits f ON f.fruit_id = d.fruit_id
     ${whereSql(where)} ORDER BY r.return_date DESC, r.return_id DESC`, params, pg);
}

module.exports = { create, list };
