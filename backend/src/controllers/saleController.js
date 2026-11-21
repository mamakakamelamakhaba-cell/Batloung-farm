const model = require('../models/saleModel');
const payments = require('../models/paymentModel');
const { validateSale, validatePayment, validateId } = require('../middleware/validate');
const { buildInvoicePdf } = require('../utils/invoicePdf');
const { parsePage, pagedResponse, resolvePeriod } = require('../utils/helpers');
const { qInt, qEnum, ok, okPaged } = require('../utils/query');

exports.create = async (req, res) => ok(res, await model.create(validateSale(req.body), req.admin.username), 201, 'Sale recorded, stock reduced and invoice generated');
exports.list = async (req, res) => {
  const pg = parsePage(req);
  const f = { vendor_id: qInt(req.query.vendor_id, 'vendor_id'), payment_status: qEnum(req.query.payment_status, 'payment_status', ['PAID', 'PARTIALLY_PAID', 'UNPAID']), search: req.query.search, ...resolvePeriod(req.query) };
  okPaged(res, pagedResponse(await model.list(f, pg), pg));
};
exports.get = async (req, res) => ok(res, await model.getById(validateId(req.params.id)));
exports.invoice = async (req, res) => ok(res, await model.invoice(validateId(req.params.id)));
exports.invoicePdf = async (req, res) => {
  const inv = await model.invoice(validateId(req.params.id));
  const buffer = await buildInvoicePdf(inv);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${inv.invoice_number}.pdf"`);
  res.send(buffer);
};
exports.payments = async (req, res) => {
  const pg = { page: 1, limit: 200, offset: 0 };
  ok(res, (await payments.list({ sale_id: validateId(req.params.id) }, pg)).rows);
};
exports.addPayment = async (req, res) => ok(res, await payments.addToSale(validateId(req.params.id), validatePayment(req.body)), 201, 'Payment recorded');
