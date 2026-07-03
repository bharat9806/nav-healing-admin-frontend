const fs = require('fs');
const jspdfMod = require('jspdf');
const jsPDF = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
// Patch save to write the PDF to disk instead of triggering a browser download
jsPDF.prototype.save = function (filename) {
  const ab = this.output('arraybuffer');
  fs.writeFileSync('/tmp/invoice.pdf', Buffer.from(ab));
  return this;
};
const { generateOrderInvoice } = require('./generateOrderInvoice.js');

generateOrderInvoice({
  invoiceNumber: 'NHH-2026-0142',
  date: '2026-07-03',
  customerName: 'Rajesh Kumar',
  customerPhone: '+91 98765 43210',
  address: 'H.No. 214, Sector 15, Gandhinagar, Gujarat – 382016',
  customerState: 'Gujarat (24)',
  paymentMethod: 'UPI',
  items: [
    { name: 'Ashwagandha Wellness Capsules', subtitle: 'Bottle of 60', qty: 2, unitPrice: 649 },
    { name: 'Triphala Digestive Churna', subtitle: '200 g pack', qty: 1, unitPrice: 399 },
    { name: 'Brahmi Brain Tonic Syrup', subtitle: '450 ml', qty: 1, unitPrice: 549 },
  ],
  subtotal: 2246,
  discountAmount: 224.6,
  discountLabel: 'Prepaid Discount (10%)',
  totalAmount: 2021,
});
console.log('PDF written');
