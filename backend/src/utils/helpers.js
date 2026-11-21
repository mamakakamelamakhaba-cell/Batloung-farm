const HttpError = require('./httpError');

/** Wraps async route handlers so rejected promises reach the error middleware instead of crashing Node. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Reads ?page & ?limit from the query string. */
function parsePage(req, defLimit = 20, maxLimit = 200) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

const pagedResponse = ({ rows, total }, { page, limit }) => ({
  data: rows,
  pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
});

/**
 * Turns ?period=today|week|month|last_month|year|custom (+ from/to) into {from,to} (YYYY-MM-DD, inclusive).
 */
function resolvePeriod(query, { required = false } = {}) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { period } = query;
  let from = query.from || null;
  let to = query.to || null;

  if (period && period !== 'custom' && period !== 'all') {
    if (period === 'today') from = to = ymd(today);
    else if (period === 'week') {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      from = ymd(monday);
      to = ymd(today);
    } else if (period === 'month') {
      from = ymd(new Date(today.getFullYear(), today.getMonth(), 1));
      to = ymd(today);
    } else if (period === 'last_month') {
      from = ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      to = ymd(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (period === 'year') {
      from = ymd(new Date(today.getFullYear(), 0, 1));
      to = ymd(today);
    } else throw new HttpError(400, 'period must be one of: today, week, month, last_month, year, custom, all');
  }
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if ((from && !ok(from)) || (to && !ok(to))) throw new HttpError(400, 'Dates must use the format YYYY-MM-DD');
  if (required && (!from || !to)) throw new HttpError(400, 'Both "from" and "to" dates (YYYY-MM-DD) are required, or use ?period=');
  if (from && to && from > to) throw new HttpError(400, '"from" date cannot be after "to" date');
  return { from, to };
}

/** Appends `col >= from AND col < to+1day` conditions to a WHERE list. */
function addDateRange(where, params, col, { from, to }) {
  if (from) { where.push(`${col} >= ?`); params.push(from); }
  if (to) { where.push(`${col} < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(to); }
}

const whereSql = (where) => (where.length ? `WHERE ${where.join(' AND ')}` : '');

module.exports = { asyncHandler, round2, ymd, parsePage, pagedResponse, resolvePeriod, addDateRange, whereSql };
