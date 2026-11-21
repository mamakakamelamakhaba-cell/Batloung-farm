const HttpError = require('../utils/httpError');

const DB_DOWN = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR', 'ECONNRESET', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR', 'ER_DBACCESS_DENIED_ERROR'];

function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/** Converts any error into a clean JSON response. The process never crashes because of a failed query. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Unexpected server error';
  const details = err.details;

  if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Request body is not valid JSON';
  } else if (err.code && DB_DOWN.includes(err.code)) {
    status = 503;
    message = 'The database is currently unavailable. Check that MySQL is running and the .env credentials are correct, then try again.';
    console.error(`[DB] ${err.code}: ${err.message}`);
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409; message = 'A record with the same unique value already exists.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 400; message = 'A referenced record (supplier, fruit, vendor or sale) does not exist.';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 409; message = 'This record is used by other records and cannot be deleted.';
  } else if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    status = 400; message = 'The change was rejected by a database constraint (for example, stock cannot go negative).';
  } else if (err.code === 'ER_NO_SUCH_TABLE') {
    status = 500; message = 'Database tables are missing. Run: npm run db:init';
  } else if (status === 500) {
    console.error('[ERROR]', req.method, req.originalUrl, err);
    message = process.env.NODE_ENV === 'production' ? 'Unexpected server error' : `Unexpected server error: ${err.message}`;
  }
  if (res.headersSent) return;
  res.status(status).json({ success: false, status, message, ...(details ? { details } : {}) });
}

module.exports = { notFound, errorHandler };
