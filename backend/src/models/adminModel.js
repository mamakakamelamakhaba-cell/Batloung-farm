const { pool } = require('../../config/db');
const { hashPassword } = require('../utils/security');

async function findByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
  return rows[0];
}

/** Creates the first administrator from ADMIN_USERNAME / ADMIN_PASSWORD in .env when none exists. */
async function ensureDefaultAdmin() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM admins');
  if (n > 0) return false;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Batloung@2026';
  await pool.query('INSERT INTO admins (username, password_hash, full_name) VALUES (?,?,?)', [username, hashPassword(password), 'Batloung Farm Administrator']);
  console.log(`[AUTH] Default administrator created (username: ${username})`);
  return true;
}

module.exports = { findByUsername, ensureDefaultAdmin };
