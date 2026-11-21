const model = require('../models/fruitModel');
const { validateFruit, validatePrices, validateId } = require('../middleware/validate');
const { ok } = require('../utils/query');

exports.list = async (req, res) => ok(res, await model.list({ status: req.query.status && String(req.query.status).toUpperCase(), search: req.query.search }));
exports.available = async (req, res) => ok(res, await model.list({ status: 'AVAILABLE' }));
exports.get = async (req, res) => ok(res, await model.getById(validateId(req.params.id)));
exports.create = async (req, res) => ok(res, await model.create(validateFruit(req.body)), 201, 'Fruit registered');
exports.update = async (req, res) => ok(res, await model.update(validateId(req.params.id), validateFruit(req.body, true)), 200, 'Fruit updated');
exports.getPrices = async (req, res) => ok(res, (await model.getById(validateId(req.params.id))).prices);
exports.setPrices = async (req, res) => ok(res, await model.setPrices(validateId(req.params.id), validatePrices(req.body)), 200, 'Selling prices updated');
