const model = require('../models/stockModel');
const HttpError = require('../utils/httpError');
const C = require('../utils/constants');
const { validateAdjustment, validateId, build, int } = require('../middleware/validate');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { qInt, qSize, qEnum, ok, okPaged } = require('../utils/query');

exports.list = async (req, res) => ok(res, await model.list({
  fruit_id: qInt(req.query.fruit_id, 'fruit_id'), packaging_size: qSize(req.query.packaging_size), status: qEnum(req.query.status, 'status', ['NORMAL', 'LOW', 'CRITICAL'])
}));
exports.byFruit = async (req, res) => ok(res, await model.list({ fruit_id: validateId(req.params.fruitId, 'fruitId') }));
exports.low = async (req, res) => ok(res, await model.lowStock());
exports.setMinimum = async (req, res) => {
  const d = build(req.body, { fruit_id: { parse: int(1), required: true }, packaging_size: { parse: (v) => { const s = String(v).toUpperCase(); if (!C.PACKAGING_SIZES.includes(s)) throw new Error('packaging_size must be SMALL, MEDIUM or LARGE'); return s; }, required: true }, minimum_quantity: { parse: int(0), required: true } });
  ok(res, await model.setMinimum(d), 200, 'Minimum stock level updated');
};
exports.movements = async (req, res) => {
  const pg = parsePage(req, 25);
  const f = { fruit_id: qInt(req.query.fruit_id, 'fruit_id'), packaging_size: qSize(req.query.packaging_size), movement_type: qEnum(req.query.movement_type, 'movement_type', C.MOVEMENT_TYPES), ...resolvePeriod(req.query) };
  okPaged(res, pagedResponse(await model.movements(f, pg), pg));
};
exports.batches = async (req, res) => {
  const pg = parsePage(req, 50);
  const only = qEnum(req.query.status, 'status', ['EXPIRED', 'NEAR_EXPIRY', 'FRESH']);
  okPaged(res, pagedResponse(await model.batches({ fruit_id: qInt(req.query.fruit_id, 'fruit_id'), packaging_size: qSize(req.query.packaging_size), only, days: req.query.days }, pg), pg));
};
exports.expiry = async (req, res) => ok(res, await model.expiryAlerts(req.query.days));
exports.adjust = async (req, res) => ok(res, await model.adjust(validateAdjustment(req.body), req.admin.username), 201, 'Stock movement recorded');
exports.writeOff = async (req, res) => {
  const ids = req.body && req.body.batch_ids;
  if (ids !== undefined && (!Array.isArray(ids) || ids.some((i) => !Number.isInteger(i)))) throw new HttpError(400, 'batch_ids must be an array of batch ids');
  ok(res, await model.writeOffExpired(req.admin.username, ids), 200, 'Expired stock written off');
};
