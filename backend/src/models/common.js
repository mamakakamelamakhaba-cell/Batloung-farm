const { pool } = require('../../config/db');

/** UPDATE table SET <validated keys> WHERE id. Keys always come from validated specs, never from raw input. */
async function updateById(table, idCol, id, data) {
  const keys = Object.keys(data);
  const [r] = await pool.query(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${idCol} = ?`, [...keys.map((k) => data[k]), id]);
  return r.affectedRows;
}

module.exports = { updateById };
