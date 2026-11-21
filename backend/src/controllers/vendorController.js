const model = require('../models/vendorModel');
const payments = require('../models/paymentModel');
const { build, vendorSpec, validateId, validatePayment } = require('../middleware/validate');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { ok, okPaged } = require('../utils/query');

exports.create = async (req, res) => ok(res, await model.create(build(req.body, vendorSpec)), 201, 'Vendor registered');
exports.list = async (req, res) => {
  const pg = parsePage(req);
  okPaged(res, pagedResponse(await model.list({ search: req.query.search || req.query.q, has_balance: req.query.has_balance }, pg), pg));
};
exports.get = async (req, res) => ok(res, await model.getById(validateId(req.params.id)));
exports.update = async (req, res) => ok(res, await model.update(validateId(req.params.id), build(req.body, vendorSpec, true)), 200, 'Vendor updated');
exports.profile = async (req, res) => ok(res, await model.profile(validateId(req.params.id)));
exports.statement = async (req, res) => ok(res, await model.statement(validateId(req.params.id), req.query));
exports.pay = async (req, res) => ok(res, await payments.addForVendor(validateId(req.params.id), validatePayment(req.body)), 201, 'Payment recorded');
