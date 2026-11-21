const { pool, withTransaction } = require('../../config/db');
const HttpError = require('../utils/httpError');
const C = require('../utils/constants');
const { updateById } = require('./common');

/** Business rule: every packaging size must have a different selling price. */
async function assertDistinctPrices(conn, fruitId) {
  const [rows] = await conn.query('SELECT packaging_size, selling_price FROM fruit_prices WHERE fruit_id = ?', [fruitId]);
  const seen = new Set(rows.map((r) => Number(r.selling_price)));
  if (seen.size !== rows.length) throw new HttpError(400, 'Each packaging size must have a different selling price (small, medium and large cannot share a price).');
}

async function attach(fruits) {
  if (!fruits.length) return fruits;
  const ids = fruits.map((f) => f.fruit_id);
  const [prices] = await pool.query('SELECT fruit_id, packaging_size, selling_price FROM fruit_prices WHERE fruit_id IN (?)', [ids]);
  const [stock] = await pool.query('SELECT fruit_id, packaging_size, available_quantity, minimum_quantity FROM stock WHERE fruit_id IN (?)', [ids]);
  return fruits.map((f) => ({
    ...f,
    prices: Object.fromEntries(prices.filter((p) => p.fruit_id === f.fruit_id).map((p) => [p.packaging_size, p.selling_price])),
    stock: Object.fromEntries(stock.filter((s) => s.fruit_id === f.fruit_id).map((s) => [s.packaging_size, { available: s.available_quantity, minimum: s.minimum_quantity }]))
  }));
}

async function list({ status, search } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (search) { where.push('fruit_name LIKE ?'); params.push(`%${search}%`); }
  const [rows] = await pool.query(`SELECT * FROM fruits ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY fruit_name`, params);
  return attach(rows);
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM fruits WHERE fruit_id = ?', [id]);
  if (!rows.length) throw new HttpError(404, `Fruit ${id} not found`);
  return (await attach(rows))[0];
}

async function create(d) {
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO fruits (fruit_name, description, status, shelf_life_days) VALUES (?,?,?,?)',
      [d.fruit_name, d.description || null, d.status, d.shelf_life_days]);
    for (const size of C.PACKAGING_SIZES) {
      await conn.query('INSERT INTO stock (fruit_id, packaging_size, available_quantity, minimum_quantity) VALUES (?,?,0,?)',
        [r.insertId, size, (d.minimum_stock && d.minimum_stock[size]) ?? 10]);
      if (d.prices && d.prices[size] !== undefined) {
        await conn.query('INSERT INTO fruit_prices (fruit_id, packaging_size, selling_price) VALUES (?,?,?)', [r.insertId, size, d.prices[size]]);
      }
    }
    await assertDistinctPrices(conn, r.insertId);
    return r.insertId;
  });
  return getById(id);
}

async function update(id, data) {
  await getById(id);
  await updateById('fruits', 'fruit_id', id, data);
  return getById(id);
}

async function setPrices(id, prices) {
  await getById(id);
  await withTransaction(async (conn) => {
    for (const [size, price] of Object.entries(prices)) {
      await conn.query(`INSERT INTO fruit_prices (fruit_id, packaging_size, selling_price) VALUES (?,?,?)
                        ON DUPLICATE KEY UPDATE selling_price = VALUES(selling_price)`, [id, size, price]);
    }
    await assertDistinctPrices(conn, id);
  });
  return getById(id);
}

module.exports = { list, getById, create, update, setPrices };
