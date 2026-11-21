const model = require('../models/expenseModel');
const { build, expenseSpec, validateId } = require('../middleware/validate');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { qEnum, ok, okPaged } = require('../utils/query');
const C = require('../utils/constants');

exports.create = async (req, res) => ok(res, await model.create(build(req.body, expenseSpec)), 201, 'Expense recorded');
exports.list = async (req, res) => {
  const pg = parsePage(req);
  okPaged(res, pagedResponse(await model.list({ category: qEnum(req.query.category, 'category', C.EXPENSE_CATEGORIES), search: req.query.search, ...resolvePeriod(req.query) }, pg), pg));
};
exports.summary = async (req, res) => ok(res, await model.summary(resolvePeriod(req.query)));
exports.get = async (req, res) => ok(res, await model.getById(validateId(req.params.id)));
exports.update = async (req, res) => ok(res, await model.update(validateId(req.params.id), build(req.body, expenseSpec, true)), 200, 'Expense updated');
exports.remove = async (req, res) => ok(res, await model.remove(validateId(req.params.id)), 200, 'Expense deleted');
