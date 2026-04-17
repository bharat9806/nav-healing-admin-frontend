import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Logo loader (webp → canvas → PNG dataURL) ────────────────────────────────
interface LogoData { dataUrl: string; w: number; h: number; }

async function fetchLogo(): Promise<LogoData | null> {
  try {
    const resp = await fetch('/logo.webp');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch { return null; }
}

// ── Brand ─────────────────────────────────────────────────────────────────────
const BRAND_NAME     = 'Nnavhealing Herbss';
const BRAND_TAGLINE  = 'Roots. Remedy. Relief.';
const BRAND_WEBSITE  = 'www.navhealingherbs.com';
const BRAND_EMAIL    = 'nnavhealingherbss@gmail.com';
const BRAND_ADDR1    = 'BATHRI, TO, KAHNPUR KHUHI ROAD';
const BRAND_ADDR2    = 'Bhangal, Nangal, Punjab 140126';

// Palette
const G_DARK  : [number,number,number] = [20,  80,  45 ];
const G_MID   : [number,number,number] = [26,  92,  56 ];
const G_LIGHT : [number,number,number] = [5,  150, 105 ];
const G_PALE  : [number,number,number] = [232,245,238  ];
const WHITE   : [number,number,number] = [255,255,255  ];
const INK     : [number,number,number] = [15,  23,  42 ];
const SLATE   : [number,number,number] = [71,  85, 105 ];
const BORDER  : [number,number,number] = [203,213,225  ];
const ROW_ALT : [number,number,number] = [248,250,252  ];
const RED     : [number,number,number] = [220, 38,  38 ];
const AMBER   : [number,number,number] = [180, 90,   0 ];
const BLUE    : [number,number,number] = [37,  99, 235 ];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNumber?: string;
  date: string;
  patientName: string;
  items: InvoiceItem[];
  therapyPrice?: number;
  discount?: number;
  totalAmount: number;
  paymentMode: string;
  status: string;
  pendingAmount: number;
  notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const rs = (n: number) => `Rs. ${n.toFixed(2)}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
const genInvNo = (date: string) =>
  `INV-${date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

function label(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text(text.toUpperCase(), x, y);
}

// ── Draw white meditation logo at (cx, cy) with radius r ─────────────────────
function drawLogoWhite(doc: jsPDF, cx: number, cy: number, r: number) {
  doc.setDrawColor(...WHITE);
  doc.setFillColor(...WHITE);

  // Outer ring
  doc.setLineWidth(r * 0.065);
  doc.circle(cx, cy, r, 'S');

  // Head
  doc.circle(cx, cy - r * 0.57, r * 0.13, 'F');

  // Torso outline
  doc.setLineWidth(r * 0.075);
  const ty1 = cy - r * 0.43;
  const ty2 = cy + r * 0.13;
  doc.line(cx - r*0.11, ty1, cx - r*0.21, ty2);
  doc.line(cx + r*0.11, ty1, cx + r*0.21, ty2);
  doc.line(cx - r*0.21, ty2, cx + r*0.21, ty2);

  // Arms
  doc.setLineWidth(r * 0.07);
  doc.line(cx - r*0.17, cy - r*0.08, cx - r*0.47, cy + r*0.14);
  doc.line(cx + r*0.17, cy - r*0.08, cx + r*0.47, cy + r*0.14);

  // Hands
  doc.circle(cx - r*0.49, cy + r*0.16, r*0.055, 'F');
  doc.circle(cx + r*0.49, cy + r*0.16, r*0.055, 'F');

  // Legs
  doc.setLineWidth(r * 0.065);
  doc.line(cx - r*0.1, ty2, cx - r*0.38, cy + r*0.5);
  doc.line(cx + r*0.1, ty2, cx + r*0.38, cy + r*0.5);

  // Ground waves
  doc.setLineWidth(r * 0.07);  doc.line(cx - r*0.5, cy + r*0.6,  cx + r*0.5, cy + r*0.6);
  doc.setLineWidth(r * 0.055); doc.line(cx - r*0.62, cy + r*0.72, cx + r*0.62, cy + r*0.72);
  doc.setLineWidth(r * 0.04);  doc.line(cx - r*0.74, cy + r*0.83, cx + r*0.74, cy + r*0.83);
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function generateInvoice(data: InvoiceData): Promise<void> {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const mg    = 15;  // margin
  const colW  = pageW - mg * 2;
  const invNo = data.invoiceNumber || genInvNo(data.date);

  // Load real logo (webp → canvas → PNG) — fallback to programmatic drawing
  const logo = await fetchLogo();

  // ══════════════════════════════════════════════════════════════════════════
  // 1 · HEADER
  // ══════════════════════════════════════════════════════════════════════════
  const hH = 52;  // slightly taller to accommodate logo image comfortably
  // Main green band
  doc.setFillColor(...G_DARK);
  doc.rect(0, 0, pageW, hH, 'F');

  // Diagonal lighter accent
  doc.setFillColor(24, 88, 50);
  doc.lines([[pageW * 0.45, 0],[0, hH],[-pageW * 0.45, 0]], pageW * 0.55, 0, [1,1], 'F');

  let tx: number;   // x where brand text starts

  if (logo) {
    // Real logo: keep aspect ratio, fit within 38mm wide × 36mm tall box
    const logoH = Math.min(36, (38 * logo.h) / logo.w);
    const logoW = (logoH * logo.w) / logo.h;
    const logoX = mg;
    const logoY = (hH - logoH) / 2;

    // White rounded backing so white-bg image blends on dark header
    doc.setFillColor(...WHITE);
    doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 2, 2, 'F');
    doc.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoW, logoH);

    tx = logoX + logoW + 5;
  } else {
    // Fallback: programmatic white meditation figure
    const lx = mg + 16;
    drawLogoWhite(doc, lx, hH / 2 - 1, 16);
    tx = lx + 22;
  }

  // Brand text (to the right of logo)
  const ly = hH / 2 - 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text(BRAND_NAME, tx, ly - 7);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(185, 225, 205);
  doc.text(BRAND_TAGLINE, tx, ly + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 210, 185);
  doc.text(BRAND_EMAIL, tx, ly + 8);
  doc.text(`${BRAND_ADDR1}, ${BRAND_ADDR2}`, tx, ly + 15);

  // INVOICE label (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...WHITE);
  doc.text('INVOICE', pageW - mg, ly - 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(185, 225, 205);
  doc.text(`# ${invNo}`, pageW - mg, ly, { align: 'right' });
  doc.text(fmtDate(data.date), pageW - mg, ly + 7, { align: 'right' });

  // Thin green left accent strip
  doc.setFillColor(...G_LIGHT);
  doc.rect(0, hH, 3, pageH - hH, 'F');

  // ══════════════════════════════════════════════════════════════════════════
  // 2 · BILLED TO  /  FROM  (side by side)
  // ══════════════════════════════════════════════════════════════════════════
  let y = hH + 10;
  const halfW = (colW - 5) / 2;

  // Billed To box
  doc.setFillColor(...G_PALE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(mg, y, halfW, 32, 2, 2, 'FD');
  // green top bar
  doc.setFillColor(...G_MID);
  doc.roundedRect(mg, y, halfW, 5, 2, 2, 'F');
  doc.rect(mg, y + 3, halfW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...WHITE);
  doc.text('BILLED TO', mg + 4, y + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(data.patientName, mg + 4, y + 16);

  // From box
  const fromX = mg + halfW + 5;
  doc.setFillColor(...G_PALE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(fromX, y, halfW, 32, 2, 2, 'FD');
  doc.setFillColor(...G_MID);
  doc.roundedRect(fromX, y, halfW, 5, 2, 2, 'F');
  doc.rect(fromX, y + 3, halfW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...WHITE);
  doc.text('FROM', fromX + 4, y + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(BRAND_NAME, fromX + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(BRAND_ADDR1, fromX + 4, y + 19.5);
  doc.text(BRAND_ADDR2, fromX + 4, y + 25);
  doc.text(BRAND_EMAIL, fromX + 4, y + 30.5);

  y += 32 + 6;

  // ══════════════════════════════════════════════════════════════════════════
  // 3 · PAYMENT / STATUS / INVOICE# CHIPS
  // ══════════════════════════════════════════════════════════════════════════
  const chipH = 14;
  const chipW = (colW - 8) / 3;

  const drawChip = (lbl: string, val: string, x: number, valColor: [number,number,number] = INK) => {
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, chipW, chipH, 2, 2, 'FD');
    label(doc, lbl, x + 4, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...valColor);
    doc.text(val, x + 4, y + 11.5);
  };

  const statusColor: [number,number,number] =
    data.status.toLowerCase() === 'paid'      ? G_LIGHT :
    data.status.toLowerCase() === 'pending'   ? AMBER   :
    data.status.toLowerCase() === 'partial'   ? BLUE    :
    data.status.toLowerCase() === 'cancelled' ? RED     : INK;

  drawChip('Payment Mode',  data.paymentMode,            mg,                    INK);
  drawChip('Status',        data.status.toUpperCase(),   mg + chipW + 4,        statusColor);
  drawChip('Invoice No.',   invNo,                       mg + (chipW + 4) * 2,  SLATE);

  y += chipH + 7;

  // ══════════════════════════════════════════════════════════════════════════
  // 4 · ITEMS TABLE
  // ══════════════════════════════════════════════════════════════════════════
  const rows: (string | number)[][] = data.items.map((it, i) => [
    i + 1, it.name, it.qty, rs(it.unitPrice), rs(it.unitPrice * it.qty),
  ]);
  if (data.therapyPrice && data.therapyPrice > 0) {
    rows.push(['', 'Therapy / Consultation', '', '—', rs(data.therapyPrice)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Product / Service', 'Qty', 'Unit Price', 'Amount']],
    body: rows,
    margin: { left: mg, right: mg },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      fillColor: G_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      valign: 'middle',
      minCellHeight: 10,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12,  textColor: SLATE, valign: 'middle' },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 18,  valign: 'middle' },
      3: { halign: 'right',  cellWidth: 30 },
      4: { halign: 'right',  cellWidth: 32,  fontStyle: 'bold' },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.3,
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5 · TOTALS  (right)  +  NOTES  (left, same row)
  // ══════════════════════════════════════════════════════════════════════════
  // @ts-expect-error autotable adds lastAutoTable
  const tableEndY: number = (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = tableEndY + 6;

  const productTotal = data.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const therapyTotal = data.therapyPrice || 0;
  const subtotal     = productTotal + therapyTotal;
  const discount     = data.discount || 0;
  const amountPaid   = data.totalAmount - data.pendingAmount;

  // Totals box
  const totW    = 82;
  const totX    = pageW - mg - totW;
  const numRows = 3 + (discount > 0 ? 1 : 0) + (data.pendingAmount > 0 ? 1 : 0);
  const totH    = numRows * 8 + 18;

  // ── If table pushed near bottom, start totals on a fresh page ──────────
  // Need: totH + banner (12) + footer (20) + some padding ≈ totH + 45
  if (y + totH + 45 > pageH) {
    doc.addPage();
    // Re-draw the green left accent strip on the new page
    doc.setFillColor(...G_LIGHT);
    doc.rect(0, 0, 3, pageH, 'F');
    y = mg;
  }

  doc.setFillColor(...G_PALE);
  doc.setDrawColor(...G_MID);
  doc.setLineWidth(0.4);
  doc.roundedRect(totX, y, totW, totH, 2, 2, 'FD');

  let ty = y + 9;
  const lbX = totX + 5;
  const vlX = totX + totW - 5;

  const totRow = (
    lbl: string, val: string,
    bold = false,
    color: [number,number,number] = INK,
    bg?: [number,number,number],
  ) => {
    if (bg) {
      doc.setFillColor(...bg);
      doc.rect(totX + 0.4, ty - 6, totW - 0.8, 9, 'F');
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 8.5);
    doc.setTextColor(...SLATE);
    doc.text(lbl, lbX, ty);
    doc.setTextColor(...color);
    doc.text(val, vlX, ty, { align: 'right' });
    ty += 8;
  };

  totRow('Subtotal', rs(subtotal));
  if (discount > 0) totRow('Discount', `– ${rs(discount)}`, false, RED);

  // Separator
  doc.setDrawColor(...G_MID);
  doc.setLineWidth(0.5);
  doc.line(lbX, ty - 3, vlX, ty - 3);

  totRow('Total Amount', rs(data.totalAmount), true, G_DARK, G_PALE);
  ty -= 2; // small extra gap after total
  totRow('Amount Received', rs(amountPaid), false, G_LIGHT);
  if (data.pendingAmount > 0) totRow('Pending Amount', rs(data.pendingAmount), false, AMBER);

  // Notes box (left of totals, same vertical position)
  if (data.notes?.trim()) {
    const notesX  = mg;
    const notesW  = totX - mg - 5;
    const notesTxtW = notesW - 12;
    const wrapped = doc.splitTextToSize(data.notes.trim(), notesTxtW);
    const notesH  = Math.max(totH, wrapped.length * 5 + 16);

    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(notesX, y, notesW, notesH, 2, 2, 'FD');

    // Green left bar
    doc.setFillColor(...G_MID);
    doc.roundedRect(notesX, y, 3, notesH, 1.5, 1.5, 'F');

    label(doc, 'Notes', notesX + 7, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(wrapped, notesX + 7, y + 14);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6 · THANK YOU BANNER + FOOTER
  // Position banner just below content (with min breathing room),
  // or at fixed bottom — whichever is lower so it never overlaps.
  // ══════════════════════════════════════════════════════════════════════════

  // Find the lowest content point
  const totalsBottom = y + numRows * 8 + 18 + 10;        // totals box bottom + gap
  const contentBottom = data.notes?.trim()
    ? Math.max(totalsBottom, y + 30 + 10)                 // notes box height + gap
    : totalsBottom;

  // Banner sits at content bottom, but never closer than 30mm to page bottom
  const bannerY = Math.max(contentBottom, pageH - 30);

  // Fill remaining page area with subtle background so no stark white gap
  if (bannerY > contentBottom) {
    doc.setFillColor(250, 252, 250);
    doc.rect(0, contentBottom - 4, pageW, bannerY - contentBottom + 4, 'F');
  }

  doc.setFillColor(...G_DARK);
  doc.rect(0, bannerY, pageW, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Thank you for choosing ${BRAND_NAME}!`, pageW / 2, bannerY + 7.5, { align: 'center' });

  const fY = bannerY + 14;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `${BRAND_TAGLINE}  ·  ${BRAND_WEBSITE}  ·  ${BRAND_EMAIL}  ·  ${BRAND_ADDR2}`,
    pageW / 2, fY + 3, { align: 'center' },
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(160, 170, 185);
  doc.text(
    'This is a computer-generated invoice and does not require a physical signature.',
    pageW / 2, fY + 9, { align: 'center' },
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const safe = data.patientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`invoice_${safe}_${data.date}.pdf`);
}
