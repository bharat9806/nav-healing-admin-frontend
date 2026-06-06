import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Seller (your business) constants ─────────────────────────────────────────
const BRAND_NAME   = 'NNavhealing Herbss';
const BRAND_TAGLINE = 'Roots. Remedy. Relief.';
const GSTIN        = '03NCQPS6429L1ZM';
const SELLER_STATE = 'Punjab (03)';
const SELLER_ADDR  = ['Village Bhangal, P.O. Bathri,', 'Distt. Rupnagar, Punjab – 140126'];
const SELLER_PHONE = '+91 99158 33099';
const MFG_LIC      = 'Mfg. Lic. No. 880/AY-PB';
const MANUFACTURER = 'AKS Lifesciences';
const DEFAULT_HSN  = '3004';
const GST_RATE     = 0.05; // 5% IGST, prices are GST-inclusive

// ── Palette (matches sample) ─────────────────────────────────────────────────
const GREEN_DARK : [number, number, number] = [31,  82,  48];   // table head / brand
const GREEN_TXT  : [number, number, number] = [27,  74,  44];
const GREEN_PALE : [number, number, number] = [214, 234, 214];  // grand-total highlight
const AMBER      : [number, number, number] = [181, 133, 31];   // tagline / divider
const WHITE      : [number, number, number] = [255, 255, 255];
const INK        : [number, number, number] = [17,  24,  39];
const SLATE      : [number, number, number] = [90, 100, 110];
const LIGHT      : [number, number, number] = [120, 130, 140];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OrderInvoiceItem {
  name: string;
  qty: number;
  unitPrice: number; // GST-inclusive
  hsn?: string;
  subtitle?: string;
}

export interface OrderInvoiceData {
  invoiceNumber: string;
  date: string;            // ISO date
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  address?: string;        // combined "address, city, state, pincode"
  customerState?: string;  // optional parsed state line e.g. "Telangana (36)"
  paymentMethod?: string;  // 'UPI' | 'COD' or a label
  items: OrderInvoiceItem[];
  subtotal?: number;       // pre-discount total (sum of items)
  discountAmount?: number; // prepaid discount, if any
  totalAmount: number;     // final payable
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const money = (n: number) => n.toFixed(2);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd} / ${mm} / ${d.getFullYear()}`;
};

const paymentLabel = (pm?: string) => {
  if (!pm) return 'Cash on Delivery';
  const v = pm.toUpperCase();
  if (v === 'COD') return 'Cash on Delivery';
  if (v === 'UPI') return 'UPI / Online';
  return pm;
};

// Indian-English number-to-words for whole rupees
function numberToWords(num: number): string {
  const rupees = Math.round(num);
  if (rupees === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o ? '-' + ones[o] : '');
  };

  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (h) str += ones[h] + ' Hundred';
    if (rest) str += (h ? ' ' : '') + twoDigits(rest);
    return str;
  };

  let n = rupees;
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(' ').trim() + ' Rupees Only';
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function generateOrderInvoice(data: OrderInvoiceData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const mg = 14;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 · HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  // Brand (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GREEN_DARK);
  doc.text(BRAND_NAME, mg, 22);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...AMBER);
  doc.text(BRAND_TAGLINE, mg, 27.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  let ay = 34;
  SELLER_ADDR.forEach((line) => { doc.text(line, mg, ay); ay += 4.4; });
  doc.text(`Phone: ${SELLER_PHONE}`, mg, ay);

  // TAX INVOICE (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...GREEN_TXT);
  doc.text('TAX INVOICE', pageW - mg, 22, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(`GSTIN: ${GSTIN}`, pageW - mg, 28.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`State: ${SELLER_STATE}`, pageW - mg, 33.5, { align: 'right' });

  // Gold divider
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.7);
  doc.line(mg, 47, pageW - mg, 47);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 · BILL TO  (left)  +  META  (right)
  // ═══════════════════════════════════════════════════════════════════════════
  let y = 56;

  // BILL TO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GREEN_TXT);
  doc.text('BILL TO', mg, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(data.customerName, mg, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  let by = y + 13;
  const addrLines = data.address
    ? doc.splitTextToSize(data.address, 95)
    : [];
  addrLines.forEach((line: string) => { doc.text(line, mg, by); by += 4.6; });
  if (data.customerPhone) { doc.text(`Phone: ${data.customerPhone}`, mg, by); by += 4.6; }
  if (data.customerState) { doc.text(`State: ${data.customerState}`, mg, by); by += 4.6; }

  // META (right) — label/value rows
  const metaRows: [string, string][] = [
    ['Invoice No.', data.invoiceNumber],
    ['Date', fmtDate(data.date)],
    ['Payment Mode', paymentLabel(data.paymentMethod)],
    ['Supply Type', 'Inter-State (IGST)'],
  ];
  const metaLabelX = pageW - mg - 62;
  const metaValX = pageW - mg;
  let my = y + 1;
  metaRows.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN_TXT);
    doc.text(lbl, metaLabelX, my);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(val, metaValX, my, { align: 'right' });
    my += 7.5;
  });

  const tableStartY = Math.max(by, my) + 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 · ITEMS TABLE
  // ═══════════════════════════════════════════════════════════════════════════
  let sumTaxable = 0;
  let sumIgst = 0;
  const body = data.items.map((it, i) => {
    const lineTotal = it.unitPrice * it.qty;
    const taxable = lineTotal / (1 + GST_RATE);
    const igst = lineTotal - taxable;
    sumTaxable += taxable;
    sumIgst += igst;
    const desc = it.subtitle ? `${it.name}\n${it.subtitle}` : it.name;
    return [
      String(i + 1),
      desc,
      it.hsn || DEFAULT_HSN,
      String(it.qty),
      money(taxable),
      money(igst),
      money(lineTotal),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Item Description', 'HSN', 'Qty', 'Taxable\nValue', 'IGST\n5%', 'Total\n(Rs)']],
    body,
    margin: { left: mg, right: mg },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: INK,
      lineColor: [225, 230, 228],
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, textColor: SLATE },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
    },
    theme: 'grid',
    tableLineColor: [225, 230, 228],
    tableLineWidth: 0.1,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4 · TOTALS (right)
  // ═══════════════════════════════════════════════════════════════════════════
  // @ts-expect-error autotable adds lastAutoTable
  const finalY: number = (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = finalY + 8;

  const totLabelX = pageW - mg - 70;
  const totValX = pageW - mg;
  const rowH = 8.5;

  const totRow = (lbl: string, val: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(lbl, totLabelX, y);
    doc.text(val, totValX, y, { align: 'right' });
    y += rowH;
  };

  const discount = data.discountAmount ?? 0;
  const subtotal = data.subtotal ?? (sumTaxable + sumIgst);

  totRow('Taxable Value', `Rs ${money(sumTaxable)}`);
  totRow('IGST @ 5%', `Rs ${money(sumIgst)}`);
  if (discount > 0) {
    totRow('Subtotal', `Rs ${money(subtotal)}`);
    // green discount line
    doc.setTextColor(...GREEN_TXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Prepaid Discount (10%)', totLabelX, y);
    doc.text(`- Rs ${money(discount)}`, totValX, y, { align: 'right' });
    doc.setTextColor(...INK);
    y += rowH;
  }
  totRow('Shipping', 'Free');

  // Grand total highlighted band
  doc.setFillColor(...GREEN_PALE);
  doc.rect(totLabelX - 4, y - 6, pageW - mg - (totLabelX - 4), 9.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_TXT);
  doc.text('Grand Total', totLabelX, y);
  doc.text(`Rs ${money(data.totalAmount)}`, totValX, y, { align: 'right' });
  y += rowH + 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 · AMOUNT IN WORDS
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `Amount in words: ${numberToWords(data.totalAmount)}. Prices are inclusive of GST.`,
    mg, y + 2,
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 6 · FOOTER
  // ═══════════════════════════════════════════════════════════════════════════
  const footY = pageH - 32;
  doc.setDrawColor(225, 230, 228);
  doc.setLineWidth(0.3);
  doc.line(mg, footY, pageW - mg, footY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_TXT);
  doc.text(`Thank you for choosing ${BRAND_NAME}!`, pageW / 2, footY + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...LIGHT);
  doc.text(
    'Use products as directed. For best results, consult your physician. | Computer-generated invoice; no signature required.',
    pageW / 2, footY + 14, { align: 'center' },
  );
  doc.text(
    `${MFG_LIC} | Manufactured by ${MANUFACTURER}`,
    pageW / 2, footY + 19, { align: 'center' },
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const safe = data.customerName.replace(/[^a-z0-9]/gi, '_');
  doc.save(`Invoice_${safe}_${data.invoiceNumber}.pdf`);
}
