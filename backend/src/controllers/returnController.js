const model = require('../models/returnModel');
const { validateReturn } = require('../middleware/validate');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { qInt, ok, okPaged } = require('../utils/query');

exports.create = async (req, res) => ok(res, await model.create(validateReturn(req.body), req.admin.username), 201, 'Return recorded and vendor balance adjusted');
exports.list = async (req, res) => {
  const pg = parsePage(req);
  okPaged(res, pagedResponse(await model.list({ sale_id: qInt(req.query.sale_id, 'sale_id'), vendor_id: qInt(req.query.vendor_id, 'vendor_id'), ...resolvePeriod(req.query) }, pg), pg));
};
