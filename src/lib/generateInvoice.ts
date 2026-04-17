import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND_NAME       = 'Nnavhealing Herbss';
const BRAND_TAGLINE    = 'Roots. Remedy. Relief.';
const BRAND_WEBSITE    = 'www.navhealingherbs.com';
const BRAND_EMAIL      = 'admin@navhealingherbs.com';
const BRAND_GREEN      = [26, 92, 56]   as [number, number, number]; // #1a5c38
const BRAND_GREEN_LIGHT= [5, 150, 105]  as [number, number, number]; // emerald
const TEXT_DARK        = [15, 23, 42]   as [number, number, number];
const TEXT_MUTED       = [100, 116, 139]as [number, number, number];
const BORDER           = [226, 232, 240]as [number, number, number];
const ROW_ALT          = [248, 250, 252]as [number, number, number];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNumber?: string;
  date: string;          // YYYY-MM-DD
  patientName: string;
  items: InvoiceItem[];  // products
  therapyPrice?: number;
  discount?: number;
  totalAmount: number;   // final amount after discount
  paymentMode: string;
  status: string;
  pendingAmount: number;
  notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const rs = (n: number) => `Rs. ${n.toFixed(2)}`;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const generateInvoiceNumber = (date: string) => {
  const d = date.replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${d}-${rand}`;
};

// ── Load logo as base64 (browser fetch) ──────────────────────────────────────
async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.svg');
    if (!res.ok) return null;
    const text = await res.text();
    // Encode SVG as base64 URI
    const base64 = btoa(unescape(encodeURIComponent(text)));
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    return null;
  }
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateInvoice(data: InvoiceData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW  = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const invoiceNo = data.invoiceNumber || generateInvoiceNumber(data.date);

  // ── Load logo ──────────────────────────────────────────────────────────────
  const logoB64 = await loadLogoBase64();

  // ── HEADER BAND ────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, pageW, 38, 'F');

  // Logo (left side of header)
  if (logoB64) {
    try {
      doc.addImage(logoB64, 'SVG', margin - 2, 3, 28, 32);
    } catch {
      // logo unavailable – skip silently
    }
  }

  // Brand name in header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(BRAND_NAME, logoB64 ? margin + 30 : margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 230, 214);
  doc.text(BRAND_TAGLINE, logoB64 ? margin + 30 : margin, 23);
  doc.text(`${BRAND_WEBSITE}  |  ${BRAND_EMAIL}`, logoB64 ? margin + 30 : margin, 30);

  // ── INVOICE TITLE (right of header) ───────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', pageW - margin, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 230, 214);
  doc.text(`# ${invoiceNo}`, pageW - margin, 24, { align: 'right' });
  doc.text(`Date: ${formatDate(data.date)}`, pageW - margin, 30, { align: 'right' });

  // ── BILLED TO / INVOICE DETAILS ROW ───────────────────────────────────────
  let y = 48;

  // Left: Billed To
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('BILLED TO', margin, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.patientName, margin, y + 6);

  // Right: invoice meta
  const metaX = pageW - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('PAYMENT MODE', metaX, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.paymentMode, metaX, y + 6, { align: 'right' });

  // Status badge area
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('STATUS', metaX, y + 14, { align: 'right' });

  const statusText  = data.status.toUpperCase();
  const statusColor = data.status.toLowerCase() === 'paid'      ? BRAND_GREEN_LIGHT
                    : data.status.toLowerCase() === 'pending'   ? [245, 158, 11] as [number, number, number]
                    : data.status.toLowerCase() === 'partial'   ? [59, 130, 246] as [number, number, number]
                    : data.status.toLowerCase() === 'cancelled' ? [239, 68, 68]  as [number, number, number]
                    : TEXT_DARK;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...statusColor);
  doc.text(statusText, metaX, y + 20, { align: 'right' });

  // Thin divider
  y += 28;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── ITEMS TABLE ────────────────────────────────────────────────────────────
  const tableRows: (string | number)[][] = data.items.map((item, i) => [
    i + 1,
    item.name,
    item.qty,
    rs(item.unitPrice),
    rs(item.unitPrice * item.qty),
  ]);

  if (data.therapyPrice && data.therapyPrice > 0) {
    tableRows.push(['', 'Therapy / Consultation', '', '', rs(data.therapyPrice)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product / Service', 'Qty', 'Unit Price', 'Total']],
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: TEXT_DARK,
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: BRAND_GREEN,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right',  cellWidth: 28 },
      4: { halign: 'right',  cellWidth: 30 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.3,
  });

  // ── TOTALS SECTION ─────────────────────────────────────────────────────────
  // @ts-expect-error – jsPDF-autotable adds lastAutoTable
  const tableEndY: number = (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || y + 40;
  let ty = tableEndY + 6;

  const totalsX     = pageW - margin;
  const totalsLabelX = totalsX - 55;

  // Compute subtotal before discount
  const productTotal = data.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const therapyTotal = data.therapyPrice || 0;
  const subtotal     = productTotal + therapyTotal;
  const discount     = data.discount || 0;

  const rowLine = (label: string, value: string, bold = false, color: [number, number, number] = TEXT_DARK) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label, totalsLabelX, ty, { align: 'right' });
    doc.setTextColor(...color);
    doc.text(value, totalsX, ty, { align: 'right' });
    ty += bold ? 7 : 6;
  };

  rowLine('Subtotal', rs(subtotal));

  if (discount > 0) {
    rowLine('Discount', `- ${rs(discount)}`, false, [239, 68, 68] as [number, number, number]);
  }

  // Total divider
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(totalsLabelX - 10, ty - 1, totalsX, ty - 1);
  ty += 2;

  rowLine('Total Amount', rs(data.totalAmount), true, BRAND_GREEN);
  ty += 1;
  rowLine('Amount Received', rs(data.totalAmount - data.pendingAmount), false, BRAND_GREEN_LIGHT);
  if (data.pendingAmount > 0) {
    rowLine('Pending Amount', rs(data.pendingAmount), false, [245, 158, 11] as [number, number, number]);
  }

  // ── NOTES ─────────────────────────────────────────────────────────────────
  if (data.notes?.trim()) {
    ty += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('NOTES', margin, ty);
    ty += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(data.notes.trim(), contentW * 0.6);
    doc.text(lines, margin, ty);
    ty += lines.length * 5;
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 18;

  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.6);
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(BRAND_TAGLINE, pageW / 2, footerY + 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `${BRAND_WEBSITE}  |  ${BRAND_EMAIL}  |  This is a computer-generated invoice`,
    pageW / 2,
    footerY + 7,
    { align: 'center' },
  );

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const safeName = data.patientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`invoice_${safeName}_${data.date}.pdf`);
}
