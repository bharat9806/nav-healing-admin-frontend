import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyReport, DailyReportTotals } from '@/types';

// ── Brand constants (kept in sync with generateOrderInvoice) ─────────────────
const BRAND_NAME = 'Nav Healing Herbs';
const BRAND_TAGLINE = 'Roots. Remedy. Relief.';

// ── Palette ──────────────────────────────────────────────────────────────────
const GREEN_DARK: [number, number, number] = [31, 82, 48];
const GREEN_TXT: [number, number, number] = [27, 74, 44];
const GREEN_PALE: [number, number, number] = [214, 234, 214];
const AMBER: [number, number, number] = [181, 133, 31];
const WHITE: [number, number, number] = [255, 255, 255];
const INK: [number, number, number] = [17, 24, 39];
const SLATE: [number, number, number] = [90, 100, 110];
const LIGHT: [number, number, number] = [120, 130, 140];
const BORDER: [number, number, number] = [225, 230, 228];

export interface DailyReportPdfOptions {
  rows: DailyReport[];
  totals: DailyReportTotals;
  /** ISO date (YYYY-MM-DD) — start of the reported period. */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD) — end of the reported period. */
  dateTo?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
};

const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// jspdf-autotable stores the last table's end position on the doc.
const lastY = (doc: jsPDF): number =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

// ── Main ─────────────────────────────────────────────────────────────────────
export function generateDailyReport({
  rows,
  totals,
  dateFrom,
  dateTo,
}: DailyReportPdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mg = 14;

  // Fall back to the span of the data when no explicit filter was applied.
  const sorted = [...rows].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const from = dateFrom || sorted[0]?.reportDate;
  const to = dateTo || sorted[sorted.length - 1]?.reportDate;

  // ═══ 1 · HEADER ════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...GREEN_DARK);
  doc.text(BRAND_NAME, mg, 21);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...AMBER);
  doc.text(BRAND_TAGLINE, mg, 26.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...GREEN_TXT);
  doc.text('DAILY SALES REPORT', pageW - mg, 21, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    from && to
      ? (from === to ? fmtDateShort(from) : `${fmtDateShort(from)} to ${fmtDateShort(to)}`)
      : 'All dates',
    pageW - mg, 27.5, { align: 'right' },
  );

  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`${rows.length} day${rows.length === 1 ? '' : 's'} recorded`, pageW - mg, 32.5, {
    align: 'right',
  });

  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.7);
  doc.line(mg, 38, pageW - mg, 38);

  // ═══ 2 · SUMMARY BAND ══════════════════════════════════════════════════════
  const summary: [string, string][] = [
    ['Total Calls', String(totals.totalCalls)],
    ['Verified Orders', String(totals.verifiedOrders)],
    ['10% Off Orders', String(totals.tenPercentOffOrders)],
    ['Total Sale', `Rs ${money(totals.totalSale)}`],
  ];

  const bandY = 44;
  const bandH = 16;
  const cellW = (pageW - mg * 2) / summary.length;

  doc.setFillColor(...GREEN_PALE);
  doc.rect(mg, bandY, pageW - mg * 2, bandH, 'F');

  summary.forEach(([label, value], i) => {
    const cx = mg + cellW * i + cellW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREEN_TXT);
    doc.text(label.toUpperCase(), cx, bandY + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...GREEN_DARK);
    doc.text(value, cx, bandY + 12.5, { align: 'center' });
    if (i > 0) {
      doc.setDrawColor(...WHITE);
      doc.setLineWidth(0.4);
      doc.line(mg + cellW * i, bandY + 3, mg + cellW * i, bandY + bandH - 3);
    }
  });

  let y = bandY + bandH + 8;

  // ═══ 3 · TABLE ═════════════════════════════════════════════════════════════
  const hasNotes = rows.some((r) => r.notes);

  const head = ['Date', 'Total Calls', 'Verified Orders', '10% Off Orders', 'Total Sale (Rs.)'];
  if (hasNotes) head.push('Notes');

  const body = sorted.map((r) => {
    const row = [
      fmtDate(r.reportDate),
      String(r.totalCalls),
      String(r.verifiedOrders),
      String(r.tenPercentOffOrders),
      money(r.totalSale),
    ];
    if (hasNotes) row.push(r.notes || '-');
    return row;
  });

  const totalRow = [
    'TOTAL',
    String(totals.totalCalls),
    String(totals.verifiedOrders),
    String(totals.tenPercentOffOrders),
    money(totals.totalSale),
  ];
  if (hasNotes) totalRow.push('');
  body.push(totalRow);

  const lastRowIndex = body.length - 1;

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: mg, right: mg },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      textColor: INK,
      lineColor: BORDER,
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
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'right', cellWidth: hasNotes ? 30 : 32, fontStyle: 'bold' },
      5: { halign: 'left' },
    },
    alternateRowStyles: { fillColor: [248, 251, 248] },
    // Bold, shaded TOTAL row to match the on-screen table.
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === lastRowIndex) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = GREEN_PALE;
        data.cell.styles.textColor = GREEN_TXT;
      }
    },
    theme: 'grid',
    tableLineColor: BORDER,
    tableLineWidth: 0.1,
  });

  y = lastY(doc) + 10;

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text('No reports were recorded for this period.', mg, y);
    y += 10;
  }

  // ═══ 4 · SIGN-OFF ══════════════════════════════════════════════════════════
  if (y > pageH - 40) { doc.addPage(); y = 24; }

  const sigY = Math.max(y + 6, pageH - 42);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(mg, sigY, mg + 55, sigY);
  doc.line(pageW - mg - 55, sigY, pageW - mg, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('Prepared By', mg, sigY + 4.5);
  doc.text('Verified By', pageW - mg, sigY + 4.5, { align: 'right' });

  // ═══ 5 · FOOTER ════════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const footY = pageH - 14;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(mg, footY - 5, pageW - mg, footY - 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT);
    doc.text(
      `Generated ${new Date().toLocaleString('en-GB')} | ${BRAND_NAME} - computer-generated report`,
      mg, footY,
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - mg, footY, { align: 'right' });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const period = from && to
    ? (from === to ? from.slice(0, 10) : `${from.slice(0, 10)}_to_${to.slice(0, 10)}`)
    : 'all';
  doc.save(`Daily_Sales_Report_${period}.pdf`);
}
