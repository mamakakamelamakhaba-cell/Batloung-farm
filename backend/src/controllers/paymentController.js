const model = require('../models/paymentModel');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { qInt, qEnum, ok, okPaged } = require('../utils/query');
const C = require('../utils/constants');

exports.list = async (req, res) => {
  const pg = parsePage(req);
  const f = { vendor_id: qInt(req.query.vendor_id, 'vendor_id'), payment_method: qEnum(req.query.payment_method, 'payment_method', C.PAYMENT_METHODS), payment_type: qEnum(req.query.payment_type, 'payment_type', ['PAYMENT', 'REFUND']), ...resolvePeriod(req.query) };
  okPaged(res, pagedResponse(await model.list(f, pg), pg));
};
exports.outstanding = async (req, res) => ok(res, await model.outstanding());
exports.overdue = async (req, res) => ok(res, await model.outstanding({ overdueOnly: true }));
