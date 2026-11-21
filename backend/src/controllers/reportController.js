const model = require('../models/reportModel');
const stock = require('../models/stockModel');
const payments = require('../models/paymentModel');
const C = require('../utils/constants');
const { resolvePeriod } = require('../utils/helpers');
const { qInt, qEnum, ok } = require('../utils/query');

exports.meta = async (req, res) => ok(res, {
  packaging_sizes: C.PACKAGING_SIZES, provinces: C.PROVINCES, payment_methods: C.PAYMENT_METHODS, sale_payment_methods: C.SALE_PAYMENT_METHODS,
  expense_categories: C.EXPENSE_CATEGORIES, movement_types: C.MOVEMENT_TYPES, adjustment_types: C.ADJUSTMENT_TYPES,
  business: { name: process.env.BUSINESS_NAME || 'Batloung Farm' }
});
exports.dashboard = async (req, res) => ok(res, await model.dashboard());
exports.topFruits = async (req, res) => ok(res, await model.topFruits({ ...resolvePeriod(req.query), limit: qInt(req.query.limit, 'limit') || 5 }));
exports.revenue = async (req, res) => ok(res, await model.revenue(resolvePeriod(req.query, { required: true })));
exports.topVendor = async (req, res) => ok(res, await model.topVendors({ ...resolvePeriod(req.query), limit: qInt(req.query.limit, 'limit') || 1 }));
exports.stockLevels = async (req, res) => ok(res, await stock.list({}));
exports.profit = async (req, res) => ok(res, await model.profit({ group_by: qEnum(req.query.group_by, 'group_by', ['SUMMARY', 'FRUIT', 'PACKAGING', 'FRUIT_PACKAGING', 'SALE'])?.toLowerCase() || 'summary', ...resolvePeriod(req.query) }));
exports.salesTrend = async (req, res) => ok(res, await model.salesTrend({ granularity: (qEnum(req.query.granularity, 'granularity', ['DAY', 'WEEK', 'MONTH']) || 'DAY').toLowerCase(), ...resolvePeriod(req.query) }));
exports.fruitDemand = async (req, res) => ok(res, await model.fruitDemand(resolvePeriod(req.query)));
exports.overdue = async (req, res) => ok(res, await payments.outstanding({ overdueOnly: true }));
