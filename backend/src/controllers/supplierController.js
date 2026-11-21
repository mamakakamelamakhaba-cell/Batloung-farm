const model = require('../models/supplierModel');
const { build, supplierSpec, validateId } = require('../middleware/validate');
const { parsePage, pagedResponse } = require('../utils/helpers');
const { ok, okPaged } = require('../utils/query');
const C = require('../utils/constants');

exports.create = async (req, res) => ok(res, await model.create(build(req.body, supplierSpec)), 201, 'Supplier registered');
exports.list = async (req, res) => {
  const pg = parsePage(req);
  const province = req.query.province && C.PROVINCES.find((p) => p.toLowerCase() === String(req.query.province).toLowerCase());
  okPaged(res, pagedResponse(await model.list({ search: req.query.search, province }, pg), pg));
};
exports.get = async (req, res) => ok(res, await model.getById(validateId(req.params.id)));
exports.update = async (req, res) => ok(res, await model.update(validateId(req.params.id), build(req.body, supplierSpec, true)), 200, 'Supplier updated');
exports.remove = async (req, res) => ok(res, await model.remove(validateId(req.params.id)), 200, 'Supplier deleted');
exports.performanceAll = async (req, res) => ok(res, await model.performance());
exports.performanceOne = async (req, res) => ok(res, await model.performance(validateId(req.params.id)));
