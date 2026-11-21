const model = require('../models/purchaseModel');
const { validatePurchase, validateId } = require('../middleware/validate');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { qInt, ok, okPaged } = require('../utils/query');

exports.create = async (req, res) => ok(res, await model.create(validatePurchase(req.body), req.admin.username), 201, 'Purchase recorded and stock updated');
exports.list = async (req, res) => {
  const pg = parsePage(req);
  okPaged(res, pagedResponse(await model.list({ supplier_id: qInt(req.query.supplier_id, 'supplier_id'), ...resolvePeriod(req.query) }, pg), pg));
};
exports.get = async (req, res) => ok(res, await model.getById(validateId(req.params.id)));
exports.costTrends = async (req, res) => ok(res, await model.costTrends({ fruit_id: qInt(req.query.fruit_id, 'fruit_id'), mode: req.query.mode }));
