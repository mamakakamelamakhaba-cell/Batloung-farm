const { pool, paged } = require('../../config/db');
const HttpError = require('../utils/httpError');
const { addDateRange, whereSql, round2 } = require('../utils/helpers');
const { updateById } = require('./common');

async function create(d) {
  const [r] = await pool.query('INSERT INTO expenses (category, description, amount, expense_date) VALUES (?,?,?,COALESCE(?, CURDATE()))',
    [d.category, d.description, d.amount, d.expense_date || null]);
  return getById(r.insertId);
}

async function list({ category, search, from, to }, pg) {
  const where = [];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (search) { where.push('description LIKE ?'); params.push(`%${search}%`); }
  addDateRange(where, params, 'expense_date', { from, to });
  return paged(`SELECT * FROM expenses ${whereSql(where)} ORDER BY expense_date DESC, expense_id DESC`, params, pg);
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM expenses WHERE expense_id = ?', [id]);
  if (!rows.length) throw new HttpError(404, `Expense ${id} not found`);
  return rows[0];
}

async function update(id, data) {
  await getById(id);
  await updateById('expenses', 'expense_id', id, data);
  return getById(id);
}

async function remove(id) {
  const e = await getById(id);
  await pool.query('DELETE FROM expenses WHERE expense_id = ?', [id]);
  return e;
}

async function summary({ from, to }) {
  const where = [];
  const params = [];
  addDateRange(where, params, 'expense_date', { from, to });
  const [rows] = await pool.query(`SELECT category, COUNT(*) AS entries, SUM(amount) AS total FROM expenses ${whereSql(where)} GROUP BY category ORDER BY total DESC`, params);
  return { from, to, total: round2(rows.reduce((s, r) => s + r.total, 0)), by_category: rows };
}

module.exports = { create, list, getById, update, remove, summary };
