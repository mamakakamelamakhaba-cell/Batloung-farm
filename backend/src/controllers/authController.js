const adminModel = require('../models/adminModel');
const HttpError = require('../utils/httpError');
const { verifyPassword, signToken } = require('../utils/security');
const { ok } = require('../utils/query');

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) throw new HttpError(400, 'username and password are required');
  let admin = await adminModel.findByUsername(String(username));
  if (!admin && (await adminModel.ensureDefaultAdmin())) admin = await adminModel.findByUsername(String(username)); // first login after db:init
  if (!admin || !verifyPassword(String(password), admin.password_hash)) throw new HttpError(401, 'Incorrect username or password');
  const token = signToken({ id: admin.admin_id, username: admin.username });
  ok(res, { token, admin: { username: admin.username, full_name: admin.full_name } }, 200, 'Login successful');
}

async function me(req, res) {
  ok(res, { username: req.admin.username });
}

module.exports = { login, me };
