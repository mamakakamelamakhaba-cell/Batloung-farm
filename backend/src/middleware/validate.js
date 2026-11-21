/**
 * Input validation. Each function returns a cleaned object or throws HttpError(400).
 */
const HttpError = require('../utils/httpError');
const C = require('../utils/constants');

const PHONE_RE = /^\+?[0-9][0-9\s-]{6,19}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- field parsers -------------------------------------------------
const str = (max = 255) => (v, k) => {
  const s = String(v).trim();
  if (!s) throw new Error(`${k} cannot be empty`);
  if (s.length > max) throw new Error(`${k} must be at most ${max} characters`);
  return s;
};
const int = (min = 0, max = 1e9) => (v, k) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${k} must be a whole number between ${min} and ${max}`);
  return n;
};
const money = (min = 0) => (v, k) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`${k} must be a number >= ${min}`);
  return Math.round(n * 100) / 100;
};
const positiveMoney = (v, k) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${k} must be a number greater than 0`);
  return Math.round(n * 100) / 100;
};
const date = (v, k) => {
  if (!DATE_RE.test(String(v)) || Number.isNaN(Date.parse(v))) throw new Error(`${k} must use the format YYYY-MM-DD`);
  return String(v);
};
const phone = (v, k) => {
  const s = String(v).trim();
  if (!PHONE_RE.test(s)) throw new Error(`${k} is not a valid phone number (use digits, spaces, dashes, optional +)`);
  return s;
};
const oneOf = (list) => (v, k) => {
  const found = list.find((x) => x.toLowerCase() === String(v).trim().toLowerCase());
  if (!found) throw new Error(`${k} must be one of: ${list.join(', ')}`);
  return found;
};
const upper = (list) => (v, k) => {
  const s = String(v).trim().toUpperCase().replace(/\s+/g, '_');
  if (!list.includes(s)) throw new Error(`${k} must be one of: ${list.join(', ')}`);
  return s;
};
const sizeUpper = upper(C.PACKAGING_SIZES);

/** Applies a spec {field:{parse, required, default}} to a body. partial=true => updates (all optional). */
function build(body, spec, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const out = {};
  const errors = [];
  for (const [key, rule] of Object.entries(spec)) {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (rule.required && !partial) errors.push(`${key} is required`);
      else if (rule.default !== undefined && !partial) out[key] = rule.default;
      continue;
    }
    try { out[key] = rule.parse(raw, key); } catch (e) { errors.push(e.message); }
  }
  if (partial && !errors.length && !Object.keys(out).length) errors.push('Provide at least one field to update');
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return out;
}

const supplierSpec = {
  business_name: { parse: str(150), required: true },
  contact_person: { parse: str(100), required: true },
  phone: { parse: phone, required: true },
  province: { parse: oneOf(C.PROVINCES), required: true },
  address: { parse: str(255), required: true }
};
const vendorSpec = {
  vendor_name: { parse: str(120), required: true },
  phone_number: { parse: phone, required: true },
  location: { parse: str(150), required: true },
  credit_limit: { parse: money(0), default: 0 }
};
const fruitSpec = {
  fruit_name: { parse: str(60), required: true },
  description: { parse: str(255) },
  status: { parse: upper(C.FRUIT_STATUSES), default: 'AVAILABLE' },
  shelf_life_days: { parse: int(1, 365), default: 7 }
};
const expenseSpec = {
  category: { parse: upper(C.EXPENSE_CATEGORIES), required: true },
  description: { parse: str(255), required: true },
  amount: { parse: positiveMoney, required: true },
  expense_date: { parse: date }
};

/** { SMALL: x, MEDIUM: y, LARGE: z } -> validated map. */
function sizeMap(obj, label, parser) {
  if (obj === undefined || obj === null) return null;
  if (typeof obj !== 'object' || Array.isArray(obj)) throw new HttpError(400, `${label} must be an object like {"SMALL":10,"MEDIUM":20,"LARGE":30}`);
  const out = {};
  const errors = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null) continue;
    try { out[sizeUpper(k, `${label} key`)] = parser(v, `${label}.${k}`); } catch (e) { errors.push(e.message); }
  }
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return out;
}

function validateFruit(body, partial = false) {
  const data = build(body, fruitSpec, partial);
  if (!partial) {
    data.prices = sizeMap(body.prices, 'prices', positiveMoney);
    data.minimum_stock = sizeMap(body.minimum_stock, 'minimum_stock', int(0));
  }
  return data;
}

function validatePrices(body) {
  const prices = sizeMap(body && body.prices, 'prices', positiveMoney);
  if (!prices || !Object.keys(prices).length) throw new HttpError(400, 'prices is required, e.g. {"prices":{"SMALL":90,"MEDIUM":150,"LARGE":220}}');
  return prices;
}

function validateItems(items, label = 'items') {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, `${label} must be a non-empty array`);
  if (items.length > 50) throw new HttpError(400, `${label} cannot contain more than 50 lines`);
}

const errText = (e) => (e.details ? e.details.join('; ') : e.message);

function validatePurchase(body) {
  const head = build(body, {
    supplier_id: { parse: int(1), required: true },
    purchase_date: { parse: date },
    expected_delivery_date: { parse: date },
    delivery_date: { parse: date },
    notes: { parse: str(255) }
  });
  validateItems(body.items);
  const errors = [];
  const items = body.items.map((raw, i) => {
    try {
      const it = build(raw, {
        fruit_id: { parse: int(1), required: true },
        packaging_size: { parse: sizeUpper, required: true },
        unit_cost: { parse: positiveMoney, required: true },
        quantity: { parse: int(0, 1e6) },
        quantity_ordered: { parse: int(0, 1e6) },
        quantity_delivered: { parse: int(0, 1e6) },
        quantity_rejected: { parse: int(0, 1e6), default: 0 },
        rejection_reason: { parse: str(255) },
        expiry_date: { parse: date }
      });
      if (it.quantity === undefined && it.quantity_delivered === undefined) throw new Error('needs "quantity" (accepted boxes) or "quantity_delivered"');
      if (it.quantity === undefined) it.quantity = it.quantity_delivered - it.quantity_rejected;
      if (it.quantity < 0) throw new Error('quantity_rejected cannot exceed quantity_delivered');
      if (it.quantity_delivered === undefined) it.quantity_delivered = it.quantity + it.quantity_rejected;
      if (it.quantity_delivered !== it.quantity + it.quantity_rejected) throw new Error('quantity_delivered must equal accepted quantity + quantity_rejected');
      if (it.quantity_ordered === undefined) it.quantity_ordered = it.quantity_delivered;
      if (it.quantity_delivered === 0) throw new Error('no boxes delivered');
      if (it.quantity_rejected > 0 && !it.rejection_reason) it.rejection_reason = 'Rejected on delivery';
      return it;
    } catch (e) {
      errors.push(`items[${i}]: ${errText(e)}`);
      return null;
    }
  });
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return { ...head, items };
}

function validateSale(body) {
  const head = build(body, {
    vendor_id: { parse: int(1), required: true },
    payment_method: { parse: upper(C.SALE_PAYMENT_METHODS), default: 'CASH' },
    amount_paid: { parse: money(0) },
    payment_terms_days: { parse: int(0, 365) },
    due_date: { parse: date },
    reference_number: { parse: str(60) },
    notes: { parse: str(255) }
  });
  validateItems(body.items);
  const errors = [];
  const merged = new Map();
  body.items.forEach((raw, i) => {
    try {
      const it = build(raw, {
        fruit_id: { parse: int(1), required: true },
        packaging_size: { parse: sizeUpper, required: true },
        quantity: { parse: int(1, 1e6), required: true }
      });
      const key = `${it.fruit_id}-${it.packaging_size}`;
      if (merged.has(key)) merged.get(key).quantity += it.quantity; // same fruit+size twice -> add together
      else merged.set(key, it);
    } catch (e) {
      errors.push(`items[${i}]: ${errText(e)}`);
    }
  });
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  const items = [...merged.values()].sort((a, b) => a.fruit_id - b.fruit_id || a.packaging_size.localeCompare(b.packaging_size));
  return { ...head, items };
}

function validatePayment(body) {
  return build(body, {
    amount: { parse: positiveMoney, required: true },
    payment_method: { parse: upper(C.PAYMENT_METHODS), required: true },
    reference_number: { parse: str(60) },
    notes: { parse: str(255) }
  });
}

function validateReturn(body) {
  const head = build(body, {
    sale_id: { parse: int(1), required: true },
    refund_method: { parse: upper(C.PAYMENT_METHODS), default: 'CASH' }
  });
  validateItems(body.items);
  const errors = [];
  const items = body.items.map((raw, i) => {
    try {
      const it = build(raw, {
        sales_detail_id: { parse: int(1), required: true },
        quantity: { parse: int(1, 1e6), required: true },
        reason: { parse: str(255), required: true }
      });
      it.restock = raw.restock === true || raw.restock === 'true';
      return it;
    } catch (e) {
      errors.push(`items[${i}]: ${errText(e)}`);
      return null;
    }
  });
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return { ...head, items };
}

function validateAdjustment(body) {
  const data = build(body, {
    fruit_id: { parse: int(1), required: true },
    packaging_size: { parse: sizeUpper, required: true },
    movement_type: { parse: upper(C.ADJUSTMENT_TYPES), required: true },
    direction: { parse: upper(['IN', 'OUT']) },
    quantity: { parse: int(1, 1e6), required: true },
    reason: { parse: str(255), required: true },
    batch_id: { parse: int(1) },
    unit_cost: { parse: money(0) },
    expiry_date: { parse: date }
  });
  if (['DAMAGED', 'SPOILED'].includes(data.movement_type)) data.direction = 'OUT';
  else if (data.movement_type === 'RETURN') data.direction = 'IN';
  else if (!data.direction) throw new HttpError(400, 'Validation failed', ['direction (IN or OUT) is required for ADJUSTMENT and CORRECTION']);
  return data;
}

function validateId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${label} must be a positive whole number`);
  return n;
}

module.exports = {
  build, supplierSpec, vendorSpec, expenseSpec, validateFruit, validatePrices, validatePurchase, validateSale,
  validatePayment, validateReturn, validateAdjustment, validateId, sizeUpper, int, date
};
