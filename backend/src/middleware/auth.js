const HttpError = require('../utils/httpError');
const { verifyToken } = require('../utils/security');

/** Protects every /api route except login & health. Set AUTH_ENABLED=false in .env to disable while testing. */
function authenticate(req, res, next) {
  if (process.env.AUTH_ENABLED === 'false') {
    req.admin = { username: 'admin' };
    return next();
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token; // ?token= lets PDFs open in a new tab
  const payload = verifyToken(token);
  if (!payload) return next(new HttpError(401, 'Authentication required. Please log in as administrator.'));
  req.admin = payload;
  next();
}

module.exports = { authenticate };
