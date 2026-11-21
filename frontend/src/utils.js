export const money = (n) => 'M' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n) => Number(n || 0).toLocaleString('en-US');
export const dt = (s) => (s ? String(s).slice(0, 10) : '-');
export const label = (s) => String(s ?? '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const sizeLabel = label;
export const PALETTE = ['#F77F00', '#2D6A4F', '#D62839', '#6A3D9A', '#e0a800', '#1B4332', '#52b788'];

const FRUIT_EMOJI = { apple: '🍎', banana: '🍌', orange: '🍊', mango: '🥭', grape: '🍇', pear: '🍐', lemon: '🍋', peach: '🍑', pineapple: '🍍', strawberr: '🍓', watermelon: '🍉' };
export const fruitEmoji = (name) => {
  const n = String(name).toLowerCase();
  const k = Object.keys(FRUIT_EMOJI).find((x) => n.includes(x));
  return k ? FRUIT_EMOJI[k] : '🍑';
};

/** Opens a print window with the given HTML (used for invoices and statements). */
export function printHtml(title, inner) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#222;padding:28px}h1,h2,h3{color:#1B4332}table{width:100%;border-collapse:collapse;margin:10px 0}th{background:#eaf3e3;text-align:left}th,td{padding:6px 8px;border-bottom:1px solid #ddd;font-size:13px}.r{text-align:right}.invoice-head{background:#1B4332;color:#fff;padding:14px;border-bottom:5px solid #F77F00;display:flex;justify-content:space-between}.invoice-head h3{color:#fff}.totals{margin-left:auto;width:300px}.totals div{display:flex;justify-content:space-between;padding:2px 0}.totals .big{font-weight:bold;border-top:2px solid #F77F00}.stats{display:flex;gap:10px;flex-wrap:wrap}.stat{border:1px solid #ccc;padding:8px 12px}.no-print,button{display:none}</style></head><body>${inner}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
