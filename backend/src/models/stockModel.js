/**
 * Stock model: current levels, low-stock alerts, movement history, batches/expiry,
 * and the transactional helpers (receive / remove FIFO / restore) used by purchases, sales and returns.
 */
const { pool, paged, withTransaction } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { addDateRange, whereSql, round2 } = require('../utils/helpers');

const STATUS_SQL = `CASE WHEN s.minimum_quantity = 0 THEN 'NORMAL'
  WHEN s.available_quantity <= s.minimum_quantity / 2 THEN 'CRITICAL'
  WHEN s.available_quantity < s.minimum_quantity THEN 'LOW' ELSE 'NORMAL' END`;

const BASE = `SELECT s.stock_id, s.fruit_id, f.fruit_name, s.packaging_size, s.available_quantity, s.minimum_quantity,
  COALESCE(b.sellable, 0) AS sellable_quantity, COALESCE(b.expired, 0) AS expired_quantity,
  ${STATUS_SQL} AS stock_status, s.updated_at
  FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id
  LEFT JOIN (SELECT fruit_id, packaging_size,
      SUM(CASE WHEN expiry_date IS NULL OR expiry_date >= CURDATE() THEN quantity_remaining ELSE 0 END) AS sellable,
      SUM(CASE WHEN expiry_date < CURDATE() THEN quantity_remaining ELSE 0 END) AS expired
    FROM stock_batches GROUP BY fruit_id, packaging_size) b
    ON b.fruit_id = s.fruit_id AND b.packaging_size = s.packaging_size`;

const ORDER = `ORDER BY fruit_name, FIELD(packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`;

/** Current stock for every fruit AND packaging size (optionally filtered). */
async function list({ fruit_id, packaging_size, status } = {}) {
  const where = [];
  const params = [];
  if (fruit_id) { where.push('fruit_id = ?'); params.push(fruit_id); }
  if (packaging_size) { where.push('packaging_size = ?'); params.push(packaging_size); }
  if (status) { where.push('stock_status = ?'); params.push(status); }
  const [rows] = await pool.query(`SELECT * FROM (${BASE}) t ${whereSql(where)} ${ORDER}`, params);
  return rows;
}

/** Stock that has fallen below its minimum threshold (CRITICAL first). */
async function lowStock() {
  const [rows] = await pool.query(
    `SELECT * FROM (${BASE}) t WHERE stock_status IN ('LOW','CRITICAL')
     ORDER BY FIELD(stock_status,'CRITICAL','LOW'), fruit_name, FIELD(packaging_size,'SMALL','MEDIUM','LARGE')`);
  return rows;
}

async function setMinimum({ fruit_id, packaging_size, minimum_quantity }) {
  const [r] = await pool.query('UPDATE stock SET minimum_quantity = ? WHERE fruit_id = ? AND packaging_size = ?', [minimum_quantity, fruit_id, packaging_size]);
  if (!r.affectedRows) throw new HttpError(404, 'Stock record not found for that fruit and packaging size');
  return (await list({ fruit_id, packaging_size }))[0];
}

/** Stock movement history. */
async function movements(f, pg) {
  const where = [];
  const params = [];
  if (f.fruit_id) { where.push('m.fruit_id = ?'); params.push(f.fruit_id); }
  if (f.packaging_size) { where.push('m.packaging_size = ?'); params.push(f.packaging_size); }
  if (f.movement_type) { where.push('m.movement_type = ?'); params.push(f.movement_type); }
  addDateRange(where, params, 'm.created_at', f);
  return paged(
    `SELECT m.movement_id, m.created_at, m.fruit_id, f.fruit_name, m.packaging_size, m.movement_type, m.quantity,
            m.balance_after, m.reason, m.reference_type, m.reference_id, m.batch_id, m.created_by
     FROM stock_movements m JOIN fruits f ON f.fruit_id = m.fruit_id ${whereSql(where)}
     ORDER BY m.created_at DESC, m.movement_id DESC`, params, pg);
}

/** Batches with expiry classification. status: EXPIRED | NEAR_EXPIRY | FRESH */
async function batches({ fruit_id, packaging_size, only, days }, pg) {
  const near = Number(days) || Number(process.env.NEAR_EXPIRY_DAYS) || 3;
  const where = ['b.quantity_remaining > 0'];
  const params = [near];
  if (fruit_id) { where.push('b.fruit_id = ?'); params.push(fruit_id); }
  if (packaging_size) { where.push('b.packaging_size = ?'); params.push(packaging_size); }
  const sql = `SELECT * FROM (
      SELECT b.batch_id, b.fruit_id, f.fruit_name, b.packaging_size, b.received_date, b.expiry_date,
             b.quantity_received, b.quantity_remaining, b.unit_cost,
             ROUND(b.quantity_remaining * b.unit_cost, 2) AS batch_value,
             DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry,
             CASE WHEN b.expiry_date IS NULL THEN 'FRESH'
                  WHEN b.expiry_date < CURDATE() THEN 'EXPIRED'
                  WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 'NEAR_EXPIRY' ELSE 'FRESH' END AS expiry_status
      FROM stock_batches b JOIN fruits f ON f.fruit_id = b.fruit_id ${whereSql(where)}) t
    ${only ? 'WHERE expiry_status = ?' : ''} ORDER BY received_date ASC, batch_id ASC`;
  if (only) params.push(only);
  return paged(sql, params, pg);
}

async function expiryAlerts(days) {
  const near = await batches({ only: 'NEAR_EXPIRY', days }, { limit: 200, offset: 0 });
  const expired = await batches({ only: 'EXPIRED', days }, { limit: 200, offset: 0 });
  return { near_expiry: near.rows, expired: expired.rows };
}

// =====================================================================
//  Transactional helpers - always called with a connection inside withTransaction()
// =====================================================================
async function lockStock(conn, fruitId, size) {
  await conn.query('INSERT IGNORE INTO stock (fruit_id, packaging_size) VALUES (?, ?)', [fruitId, size]);
  const [rows] = await conn.query('SELECT stock_id, available_quantity FROM stock WHERE fruit_id = ? AND packaging_size = ? FOR UPDATE', [fruitId, size]);
  return rows[0];
}

async function logMovement(conn, o) {
  const [[row]] = await conn.query('SELECT available_quantity AS bal FROM stock WHERE fruit_id = ? AND packaging_size = ?', [o.fruit_id, o.packaging_size]);
  await conn.query(
    `INSERT INTO stock_movements (fruit_id, packaging_size, movement_type, quantity, balance_after, batch_id, reference_type, reference_id, reason, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [o.fruit_id, o.packaging_size, o.movement_type, o.quantity, row.bal, o.batch_id || null, o.reference_type || null, o.reference_id || null, o.reason || null, o.user || 'admin']);
}

/** Adds a new batch and INCREASES stock. */
async function receiveBatch(conn, o) {
  await lockStock(conn, o.fruit_id, o.packaging_size);
  const received = o.received_date || null;
  let expiry = o.expiry_date || null;
  if (!expiry) {
    const [[f]] = await conn.query('SELECT DATE_ADD(COALESCE(?, CURDATE()), INTERVAL shelf_life_days DAY) AS d FROM fruits WHERE fruit_id = ?', [received, o.fruit_id]);
    expiry = f.d;
  }
  const [r] = await conn.query(
    `INSERT INTO stock_batches (fruit_id, packaging_size, purchase_detail_id, received_date, expiry_date, quantity_received, quantity_remaining, unit_cost, source)
     VALUES (?,?,?,COALESCE(?, CURDATE()),?,?,?,?,?)`,
    [o.fruit_id, o.packaging_size, o.purchase_detail_id || null, received, expiry, o.quantity, o.quantity, o.unit_cost || 0, o.source || 'PURCHASE']);
  await conn.query('UPDATE stock SET available_quantity = available_quantity + ? WHERE fruit_id = ? AND packaging_size = ?', [o.quantity, o.fruit_id, o.packaging_size]);
  await logMovement(conn, { ...o, movement_type: o.movement_type || 'PURCHASE', quantity: o.quantity, batch_id: r.insertId });
  return r.insertId;
}

/**
 * DECREASES stock using FIFO (oldest batch first). Rejects when there is not enough stock and never lets stock go negative.
 * Sales exclude expired batches; write-offs/adjustments include them (includeExpired).
 */
async function removeStock(conn, o) {
  await lockStock(conn, o.fruit_id, o.packaging_size);
  let sql = `SELECT batch_id, quantity_remaining, unit_cost FROM stock_batches
             WHERE fruit_id = ? AND packaging_size = ? AND quantity_remaining > 0`;
  const params = [o.fruit_id, o.packaging_size];
  if (o.batch_id) { sql += ' AND batch_id = ?'; params.push(o.batch_id); }
  if (!o.includeExpired) sql += ' AND (expiry_date IS NULL OR expiry_date >= CURDATE())';
  sql += ' ORDER BY (expiry_date IS NOT NULL AND expiry_date < CURDATE()) DESC, received_date ASC, batch_id ASC FOR UPDATE';
  const [batchRows] = await conn.query(sql, params);
  const available = batchRows.reduce((s, b) => s + b.quantity_remaining, 0);
  if (available < o.quantity) {
    throw new HttpError(400, `Insufficient stock for ${o.fruit_name} (${o.packaging_size}): requested ${o.quantity}, available ${available}.`,
      { code: 'INSUFFICIENT_STOCK', fruit_id: o.fruit_id, fruit_name: o.fruit_name, packaging_size: o.packaging_size, requested: o.quantity, available });
  }
  let need = o.quantity;
  let cost = 0;
  const allocations = [];
  for (const b of batchRows) {
    if (need <= 0) break;
    const take = Math.min(b.quantity_remaining, need);
    const [u1] = await conn.query('UPDATE stock_batches SET quantity_remaining = quantity_remaining - ? WHERE batch_id = ? AND quantity_remaining >= ?', [take, b.batch_id, take]);
    const [u2] = await conn.query('UPDATE stock SET available_quantity = available_quantity - ? WHERE fruit_id = ? AND packaging_size = ? AND available_quantity >= ?', [take, o.fruit_id, o.packaging_size, take]);
    if (!u1.affectedRows || !u2.affectedRows) throw new HttpError(409, 'Stock changed while the transaction was running. Nothing was saved - please retry.');
    await logMovement(conn, { ...o, quantity: -take, batch_id: b.batch_id });
    allocations.push({ batch_id: b.batch_id, quantity: take, unit_cost: b.unit_cost });
    cost += take * b.unit_cost;
    need -= take;
  }
  return { allocations, total_cost: round2(cost) };
}

/** Puts returned boxes back into the batch they came from. */
async function restoreToBatch(conn, o) {
  await lockStock(conn, o.fruit_id, o.packaging_size);
  await conn.query('UPDATE stock_batches SET quantity_remaining = quantity_remaining + ? WHERE batch_id = ?', [o.quantity, o.batch_id]);
  await conn.query('UPDATE stock SET available_quantity = available_quantity + ? WHERE fruit_id = ? AND packaging_size = ?', [o.quantity, o.fruit_id, o.packaging_size]);
  await logMovement(conn, { ...o, movement_type: 'RETURN', quantity: o.quantity });
}

/** Manual adjustment / damaged / spoiled / correction / returned stock. */
async function adjust(data, user) {
  return withTransaction(async (conn) => {
    const [[fruit]] = await conn.query('SELECT fruit_id, fruit_name FROM fruits WHERE fruit_id = ?', [data.fruit_id]);
    if (!fruit) throw new HttpError(404, `Fruit ${data.fruit_id} not found`);
    const base = { fruit_id: data.fruit_id, fruit_name: fruit.fruit_name, packaging_size: data.packaging_size, quantity: data.quantity,
      movement_type: data.movement_type, reason: data.reason, reference_type: 'ADJUSTMENT', user };
    if (data.direction === 'OUT') {
      await removeStock(conn, { ...base, includeExpired: true, batch_id: data.batch_id });
    } else {
      let cost = data.unit_cost;
      if (cost === undefined) {
        const [[last]] = await conn.query('SELECT unit_cost FROM stock_batches WHERE fruit_id = ? AND packaging_size = ? ORDER BY batch_id DESC LIMIT 1', [data.fruit_id, data.packaging_size]);
        cost = last ? last.unit_cost : 0;
      }
      await receiveBatch(conn, { ...base, unit_cost: cost, expiry_date: data.expiry_date, source: 'ADJUSTMENT' });
    }
    const [[row]] = await conn.query('SELECT fruit_id, packaging_size, available_quantity FROM stock WHERE fruit_id = ? AND packaging_size = ?', [data.fruit_id, data.packaging_size]);
    return row;
  });
}

/** Writes all remaining boxes of expired batches off as SPOILED. */
async function writeOffExpired(user, batchIds) {
  return withTransaction(async (conn) => {
    let sql = `SELECT b.batch_id, b.fruit_id, f.fruit_name, b.packaging_size, b.quantity_remaining
               FROM stock_batches b JOIN fruits f ON f.fruit_id = b.fruit_id
               WHERE b.quantity_remaining > 0 AND b.expiry_date < CURDATE()`;
    const params = [];
    if (batchIds && batchIds.length) { sql += ' AND b.batch_id IN (?)'; params.push(batchIds); }
    sql += ' ORDER BY b.batch_id FOR UPDATE';
    const [rows] = await conn.query(sql, params);
    let boxes = 0;
    for (const b of rows) {
      await removeStock(conn, { fruit_id: b.fruit_id, fruit_name: b.fruit_name, packaging_size: b.packaging_size, quantity: b.quantity_remaining,
        movement_type: 'SPOILED', reason: 'Expired batch written off', reference_type: 'ADJUSTMENT', user, includeExpired: true, batch_id: b.batch_id });
      boxes += b.quantity_remaining;
    }
    return { batches_written_off: rows.length, boxes_written_off: boxes };
  });
}

module.exports = { list, lowStock, setMinimum, movements, batches, expiryAlerts, adjust, writeOffExpired, receiveBatch, removeStock, restoreToBatch, lockStock };
