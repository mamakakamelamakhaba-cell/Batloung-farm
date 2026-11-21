const PDFDocument = require('pdfkit');

const money = (n) => `M${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (s) => String(s || '').slice(0, 10);
const ORANGE = '#F77F00';
const GREEN = '#1B4332';
const INK = '#26332b';
const MUTED = '#6b7a70';

/** Builds a professional A4 invoice/receipt and resolves with a Buffer. */
function buildInvoicePdf({ business, sale }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 96;
    // ---- header band ----
    doc.rect(0, 0, doc.page.width, 110).fill(GREEN);
    doc.rect(0, 110, doc.page.width, 5).fill(ORANGE);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text(business.name, 48, 30);
    doc.font('Helvetica').fontSize(9).fillColor('#d8f3dc')
      .text(business.address, 48, 62).text(`${business.phone}   ${business.email}`, 48, 76);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text(sale.payment_status === 'PAID' ? 'RECEIPT' : 'INVOICE', 350, 30, { width: W - 302, align: 'right' });
    doc.font('Helvetica').fontSize(10).text(sale.invoice_number, 350, 58, { width: W - 302, align: 'right' });
    doc.text(`Date: ${day(sale.sale_date)}`, 350, 72, { width: W - 302, align: 'right' });

    // ---- bill to / status ----
    let y = 135;
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('BILLED TO', 48, y);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(sale.vendor_name, 48, y + 14);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`${sale.location}\nTel: ${sale.phone_number}`, 48, y + 32);
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PAYMENT', 350, y);
    const color = { PAID: '#2d9a4b', PARTIALLY_PAID: '#d98a00', UNPAID: '#c0392b' }[sale.payment_status] || INK;
    doc.fillColor(color).fontSize(13).text(sale.payment_status.replace('_', ' '), 350, y + 14);
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`Method: ${sale.payment_method.replace('_', ' ')}\nDue date: ${day(sale.due_date)}`, 350, y + 32);

    // ---- items table ----
    y = 230;
    const cols = [48, 230, 310, 360, 440];
    doc.rect(48, y, W, 24).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    ['Fruit', 'Packaging', 'Qty', 'Unit price', 'Line total'].forEach((h, i) => {
      doc.text(h, cols[i] + 6, y + 8, { width: (cols[i + 1] || 48 + W) - cols[i] - 12, align: i >= 2 ? 'right' : 'left' });
    });
    y += 24;
    doc.font('Helvetica').fontSize(10);
    sale.items.forEach((it, idx) => {
      if (y > 720) { doc.addPage(); y = 60; }
      if (idx % 2 === 0) doc.rect(48, y, W, 22).fill('#f4f8f1');
      doc.fillColor(INK);
      const row = [it.fruit_name, it.packaging_size, String(it.quantity), money(it.unit_price), money(it.line_total)];
      row.forEach((t, i) => doc.text(t, cols[i] + 6, y + 6, { width: (cols[i + 1] || 48 + W) - cols[i] - 12, align: i >= 2 ? 'right' : 'left' }));
      y += 22;
      if (it.returned_quantity > 0) {
        doc.fillColor(MUTED).fontSize(8).text(`  returned: ${it.returned_quantity} box(es)`, cols[0] + 6, y - 6);
        doc.fontSize(10);
        y += 8;
      }
    });

    // ---- totals ----
    y += 12;
    const line = (label, value, bold, col) => {
      if (y > 760) { doc.addPage(); y = 60; }
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(col || INK);
      doc.text(label, 300, y, { width: 130 });
      doc.text(money(value), 430, y, { width: W - 382, align: 'right' });
      y += bold ? 22 : 17;
    };
    line('Sale total', sale.total_amount);
    if (sale.returned_amount > 0) line('Returns / credits', -sale.returned_amount, false, '#c0392b');
    line('Net amount', sale.net_amount, true);
    line('Amount paid', sale.amount_paid, false, '#2d9a4b');
    doc.moveTo(300, y).lineTo(48 + W, y).strokeColor(ORANGE).lineWidth(1.5).stroke();
    y += 8;
    line('Balance due', sale.balance_due, true, sale.balance_due > 0 ? '#c0392b' : '#2d9a4b');

    // ---- payments ----
    if (sale.payments.length) {
      y += 10;
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text('Payments', 48, y);
      y += 16;
      doc.font('Helvetica').fontSize(9).fillColor(INK);
      sale.payments.forEach((p) => {
        if (y > 770) { doc.addPage(); y = 60; }
        doc.text(`${day(p.payment_date)}   ${p.payment_type === 'REFUND' ? 'Refund' : 'Payment'} (${p.payment_method.replace('_', ' ')})${p.reference_number ? '  Ref: ' + p.reference_number : ''}`, 48, y);
        doc.text(`${p.payment_type === 'REFUND' ? '-' : ''}${money(p.amount)}`, 430, y, { width: W - 382, align: 'right' });
        y += 14;
      });
    }
    doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique')
      .text('Thank you for buying fresh from Batloung Farm. Please settle any balance by the due date.', 48, 790, { width: W, align: 'center' });
    doc.end();
  });
}

module.exports = { buildInvoicePdf };
