/**
 * Demonstrates MySQL transactions (BEGIN / COMMIT / ROLLBACK).   Run: npm run demo:transactions
 *  1. A sale with 3 items where the 3rd item has too little stock -> whole sale rolled back.
 *  2. A purchase with 2 items where the 2nd fruit does not exist -> whole purchase rolled back.
 *  3. A valid multi-item sale -> committed, stock reduced.
 */
require('dotenv').config();
const { pool } = require('../config/db');
const sales = require('../src/models/saleModel');
const purchases = require('../src/models/purchaseModel');

async function snapshot(label) {
  const [rows] = await pool.query(
    `SELECT f.fruit_name, s.packaging_size, s.available_quantity FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id
     WHERE (s.fruit_id = 1 AND s.packaging_size = 'LARGE') OR (s.fruit_id = 5 AND s.packaging_size = 'LARGE') OR (s.fruit_id = 2 AND s.packaging_size = 'MEDIUM')
     ORDER BY f.fruit_name`);
  const [[c]] = await pool.query('SELECT (SELECT COUNT(*) FROM sales) AS sales, (SELECT COUNT(*) FROM purchases) AS purchases');
  console.log(`\n--- ${label} ---`);
  console.table(rows);
  console.log(`Sales rows: ${c.sales} | Purchase rows: ${c.purchases}`);
}

(async () => {
  try {
    await snapshot('BEFORE');

    console.log('\n[1] SALE: 5 Apples-LARGE (ok) + 5 Bananas-MEDIUM (ok) + 500 Grapes-LARGE (too many) ...');
    try {
      await sales.create({ vendor_id: 1, payment_method: 'CASH', items: [
        { fruit_id: 1, packaging_size: 'LARGE', quantity: 5 }, { fruit_id: 2, packaging_size: 'MEDIUM', quantity: 5 }, { fruit_id: 5, packaging_size: 'LARGE', quantity: 500 }] }, 'demo');
    } catch (e) { console.log('REJECTED ->', e.message, '\nROLLBACK executed: nothing was saved.'); }
    await snapshot('AFTER FAILED SALE (identical to BEFORE)');

    console.log('\n[2] PURCHASE: item 1 valid, item 2 uses a fruit that does not exist ...');
    try {
      await purchases.create({ supplier_id: 1, items: [
        { fruit_id: 1, packaging_size: 'LARGE', unit_cost: 150, quantity: 10, quantity_ordered: 10, quantity_delivered: 10, quantity_rejected: 0 },
        { fruit_id: 999, packaging_size: 'SMALL', unit_cost: 50, quantity: 10, quantity_ordered: 10, quantity_delivered: 10, quantity_rejected: 0 }] }, 'demo');
    } catch (e) { console.log('REJECTED ->', e.message, '\nROLLBACK executed: the valid first item was NOT added to stock.'); }
    await snapshot('AFTER FAILED PURCHASE (identical to BEFORE)');

    console.log('\n[3] VALID SALE: 2 Apples-LARGE + 3 Bananas-MEDIUM, paid in cash ...');
    const sale = await sales.create({ vendor_id: 1, payment_method: 'CASH', items: [
      { fruit_id: 1, packaging_size: 'LARGE', quantity: 2 }, { fruit_id: 2, packaging_size: 'MEDIUM', quantity: 3 }] }, 'demo');
    console.log(`COMMIT executed: ${sale.invoice_number} total M${sale.total_amount}, status ${sale.payment_status}`);
    await snapshot('AFTER VALID SALE (stock reduced)');
  } catch (err) {
    console.error('Demo could not run:', err.code || err.message, '- is MySQL running and has "npm run db:init" been executed?');
  } finally {
    await pool.end();
  }
})();
