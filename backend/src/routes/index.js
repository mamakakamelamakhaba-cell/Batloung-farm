const express = require('express');
const { asyncHandler: h } = require('../utils/helpers');
const { authenticate } = require('../middleware/auth');
const auth = require('../controllers/authController');
const sup = require('../controllers/supplierController');
const fruit = require('../controllers/fruitController');
const stock = require('../controllers/stockController');
const vendor = require('../controllers/vendorController');
const purchase = require('../controllers/purchaseController');
const sale = require('../controllers/saleController');
const pay = require('../controllers/paymentController');
const ret = require('../controllers/returnController');
const exp = require('../controllers/expenseController');
const rep = require('../controllers/reportController');

const router = express.Router();

// ---- public ----
router.post('/auth/login', h(auth.login));

// ---- everything below needs the administrator token ----
router.use(authenticate);
router.get('/auth/me', h(auth.me));
router.get('/meta', h(rep.meta));
router.get('/dashboard', h(rep.dashboard));

// Suppliers
router.route('/suppliers').get(h(sup.list)).post(h(sup.create));
router.get('/suppliers/performance', h(sup.performanceAll));
router.route('/suppliers/:id').get(h(sup.get)).put(h(sup.update)).delete(h(sup.remove));
router.get('/suppliers/:id/performance', h(sup.performanceOne));

// Fruits
router.route('/fruits').get(h(fruit.list)).post(h(fruit.create));
router.get('/fruits/available', h(fruit.available));
router.route('/fruits/:id').get(h(fruit.get)).put(h(fruit.update));
router.route('/fruits/:id/prices').get(h(fruit.getPrices)).put(h(fruit.setPrices));

// Stock
router.get('/stock', h(stock.list));
router.get('/stock/low', h(stock.low));
router.get('/stock/movements', h(stock.movements));
router.get('/stock/batches', h(stock.batches));
router.get('/stock/expiry', h(stock.expiry));
router.get('/stock/fruit/:fruitId', h(stock.byFruit));
router.put('/stock/minimum', h(stock.setMinimum));
router.post('/stock/adjustments', h(stock.adjust));
router.post('/stock/expired/write-off', h(stock.writeOff));

// Vendors
router.route('/vendors').get(h(vendor.list)).post(h(vendor.create));
router.get('/vendors/search', h(vendor.list));
router.route('/vendors/:id').get(h(vendor.get)).put(h(vendor.update));
router.get('/vendors/:id/profile', h(vendor.profile));
router.get('/vendors/:id/statement', h(vendor.statement));
router.post('/vendors/:id/payments', h(vendor.pay));

// Purchases
router.route('/purchases').get(h(purchase.list)).post(h(purchase.create));
router.get('/purchases/cost-trends', h(purchase.costTrends));
router.get('/purchases/:id', h(purchase.get));

// Sales
router.route('/sales').get(h(sale.list)).post(h(sale.create));
router.get('/sales/:id', h(sale.get));
router.get('/sales/:id/invoice', h(sale.invoice));
router.get('/sales/:id/invoice.pdf', h(sale.invoicePdf));
router.route('/sales/:id/payments').get(h(sale.payments)).post(h(sale.addPayment));

// Payments & reminders
router.get('/payments', h(pay.list));
router.get('/payments/outstanding', h(pay.outstanding));
router.get('/payments/overdue', h(pay.overdue));

// Returns
router.route('/returns').get(h(ret.list)).post(h(ret.create));

// Expenses
router.route('/expenses').get(h(exp.list)).post(h(exp.create));
router.get('/expenses/summary', h(exp.summary));
router.route('/expenses/:id').get(h(exp.get)).put(h(exp.update)).delete(h(exp.remove));

// Reports
router.get('/reports/dashboard', h(rep.dashboard));
router.get('/reports/top-fruits', h(rep.topFruits));
router.get('/reports/revenue', h(rep.revenue));
router.get('/reports/top-vendor', h(rep.topVendor));
router.get('/reports/stock-levels', h(rep.stockLevels));
router.get('/reports/profit', h(rep.profit));
router.get('/reports/sales-trend', h(rep.salesTrend));
router.get('/reports/fruit-demand', h(rep.fruitDemand));
router.get('/reports/overdue-payments', h(rep.overdue));

module.exports = router;
