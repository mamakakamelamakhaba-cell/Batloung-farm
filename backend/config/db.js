/**
 * Database configuration.
 * All credentials come from the .env file - nothing is hard-coded here.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  decimalNumbers: true, // DECIMAL columns come back as JS numbers
  dateStrings: true // DATE/DATETIME come back as plain strings
});

/** Try to open one connection. Never throws - returns {ok, error}. */
async function checkConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

/**
 * Paginated query helper. `sql` must not end with LIMIT.
 * Returns { rows, total } using a COUNT over the same query.
 */
async function paged(sql, params, { limit, offset }) {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM (${sql}) AS counted`, params);
  const [rows] = await pool.query(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}

/**
 * Runs `work(connection)` inside a MySQL transaction using explicit
 * BEGIN / COMMIT / ROLLBACK. If anything throws, everything is rolled back
 * and the error is re-thrown to the caller.
 */
async function withTransaction(work) {
  const conn = await pool.getConnection(); // throws if MySQL is down (handled by errorHandler)
  try {
    await conn.query('BEGIN');
    const result = await work(conn);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await conn.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('ROLLBACK failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, checkConnection, paged, withTransaction };
