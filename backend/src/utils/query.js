/** Query-string helpers that raise 400 instead of silently passing bad values to SQL. */
const HttpError = require('./httpError');
const C = require('./constants');

const qInt = (v, name) => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${name} must be a positive whole number`);
  return n;
};
const qEnum = (v, name, list) => {
  if (v === undefined || v === '') return undefined;
  const s = String(v).toUpperCase();
  if (!list.includes(s)) throw new HttpError(400, `${name} must be one of: ${list.join(', ')}`);
  return s;
};
const qSize = (v) => qEnum(v, 'packaging_size', C.PACKAGING_SIZES);
const ok = (res, data, status = 200, message) => res.status(status).json({ success: true, ...(message ? { message } : {}), data });
const okPaged = (res, payload) => res.status(200).json({ success: true, ...payload });

module.exports = { qInt, qEnum, qSize, ok, okPaged };
