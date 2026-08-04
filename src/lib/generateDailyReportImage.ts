import { DailyReport, DailyReportTotals } from '@/types';

// ── Brand constants (kept in sync with generateOrderInvoice) ─────────────────
const BRAND_NAME = 'Nav Healing Herbs';
const BRAND_TAGLINE = 'Roots. Remedy. Relief.';

// ── Palette ──────────────────────────────────────────────────────────────────
const GREEN_DARK = '#1f5230';
const GREEN_TXT = '#1b4a2c';
const GREEN_PALE = '#d6ead6';
const AMBER = '#b5851f';
const WHITE = '#ffffff';
const INK = '#111827';
const SLATE = '#5a646e';
const LIGHT = '#78828c';
const BORDER = '#e1e6e4';
const ZEBRA = '#f8fbf8';

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ── Layout (logical px; the canvas is rendered at 2x for a crisp image) ──────
const SCALE = 2;
const WIDTH = 1000;
const MARGIN = 40;
const CONTENT_W = WIDTH - MARGIN * 2;
const ROW_H = 38;
const HEAD_H = 44;

export interface DailyReportImageOptions {
  rows: DailyReport[];
  totals: DailyReportTotals;
  /** ISO date (YYYY-MM-DD) — start of the reported period. */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD) — end of the reported period. */
  dateTo?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// reportDate is a DATE column, so read it in UTC to avoid a day shift.
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

type Align = 'left' | 'center' | 'right';

/** Truncate with an ellipsis so text never bleeds out of its column. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxW) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  w: number,
  centreY: number,
  align: Align,
  pad = 12,
) {
  const safe = fit(ctx, text, w - pad * 2);
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const tx = align === 'left' ? x + pad : align === 'right' ? x + w - pad : x + w / 2;
  ctx.fillText(safe, tx, centreY);
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function generateDailyReportImage({
  rows,
  totals,
  dateFrom,
  dateTo,
}: DailyReportImageOptions): void {
  const sorted = [...rows].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const hasNotes = sorted.some((r) => r.notes);

  // Fall back to the span of the data when no explicit filter was applied.
  const from = dateFrom || sorted[0]?.reportDate;
  const to = dateTo || sorted[sorted.length - 1]?.reportDate;

  const headers = ['Date', 'Total Calls', 'Verified Orders', '10% Off Orders', 'Total Sale (Rs.)'];
  const aligns: Align[] = ['center', 'center', 'center', 'center', 'right'];
  const fractions = hasNotes
    ? [0.16, 0.13, 0.16, 0.15, 0.17, 0.23]
    : [0.22, 0.17, 0.21, 0.20, 0.20];
  if (hasNotes) {
    headers.push('Notes');
    aligns.push('left');
  }

  const widths = fractions.map((f) => CONTENT_W * f);
  const xs: number[] = [];
  widths.reduce((acc, w) => { xs.push(acc); return acc + w; }, MARGIN);

  // Body rows + the TOTAL row.
  const bodyCount = sorted.length + 1;
  const tableTop = 210;
  const tableH = HEAD_H + ROW_H * bodyCount;
  const height = tableTop + tableH + 78;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(SCALE, SCALE);

  // Opaque background — a transparent PNG looks broken when pasted into chat.
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, height);

  // ═══ 1 · HEADER ════════════════════════════════════════════════════════════
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = GREEN_DARK;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText(BRAND_NAME, MARGIN, 56);

  ctx.fillStyle = AMBER;
  ctx.font = `italic 15px ${FONT}`;
  ctx.fillText(BRAND_TAGLINE, MARGIN, 78);

  ctx.textAlign = 'right';
  ctx.fillStyle = GREEN_TXT;
  ctx.font = `bold 27px ${FONT}`;
  ctx.fillText('DAILY SALES REPORT', WIDTH - MARGIN, 54);

  ctx.fillStyle = INK;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(
    from && to
      ? (from === to ? fmtDateShort(from) : `${fmtDateShort(from)} to ${fmtDateShort(to)}`)
      : 'All dates',
    WIDTH - MARGIN, 76,
  );

  ctx.fillStyle = SLATE;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(
    `${sorted.length} day${sorted.length === 1 ? '' : 's'} recorded`,
    WIDTH - MARGIN, 96,
  );

  // Gold divider
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 112);
  ctx.lineTo(WIDTH - MARGIN, 112);
  ctx.stroke();

  // ═══ 2 · SUMMARY BAND ══════════════════════════════════════════════════════
  const summary: [string, string][] = [
    ['Total Calls', String(totals.totalCalls)],
    ['Verified Orders', String(totals.verifiedOrders)],
    ['10% Off Orders', String(totals.tenPercentOffOrders)],
    ['Total Sale', `Rs ${money(totals.totalSale)}`],
  ];

  const bandY = 132;
  const bandH = 56;
  const cellW = CONTENT_W / summary.length;

  ctx.fillStyle = GREEN_PALE;
  ctx.fillRect(MARGIN, bandY, CONTENT_W, bandH);

  summary.forEach(([label, value], i) => {
    const cx = MARGIN + cellW * i + cellW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = GREEN_TXT;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(label.toUpperCase(), cx, bandY + 22);
    ctx.fillStyle = GREEN_DARK;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(value, cx, bandY + 46);
    if (i > 0) {
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN + cellW * i, bandY + 10);
      ctx.lineTo(MARGIN + cellW * i, bandY + bandH - 10);
      ctx.stroke();
    }
  });

  // ═══ 3 · TABLE ═════════════════════════════════════════════════════════════
  // Header
  ctx.fillStyle = GREEN_DARK;
  ctx.fillRect(MARGIN, tableTop, CONTENT_W, HEAD_H);
  ctx.fillStyle = WHITE;
  ctx.font = `bold 14px ${FONT}`;
  headers.forEach((h, i) => {
    drawCell(ctx, h, xs[i], widths[i], tableTop + HEAD_H / 2, 'center');
  });

  // Body
  sorted.forEach((r, i) => {
    const rowY = tableTop + HEAD_H + ROW_H * i;
    if (i % 2 === 1) {
      ctx.fillStyle = ZEBRA;
      ctx.fillRect(MARGIN, rowY, CONTENT_W, ROW_H);
    }

    const values = [
      fmtDate(r.reportDate),
      String(r.totalCalls),
      String(r.verifiedOrders),
      String(r.tenPercentOffOrders),
      money(r.totalSale),
    ];
    if (hasNotes) values.push(r.notes || '-');

    values.forEach((v, c) => {
      ctx.fillStyle = INK;
      ctx.font = c === 4 ? `bold 15px ${FONT}` : `15px ${FONT}`;
      drawCell(ctx, v, xs[c], widths[c], rowY + ROW_H / 2, aligns[c]);
    });
  });

  // TOTAL row
  const totalY = tableTop + HEAD_H + ROW_H * sorted.length;
  ctx.fillStyle = GREEN_PALE;
  ctx.fillRect(MARGIN, totalY, CONTENT_W, ROW_H);

  const totalValues = [
    'TOTAL',
    String(totals.totalCalls),
    String(totals.verifiedOrders),
    String(totals.tenPercentOffOrders),
    money(totals.totalSale),
  ];
  if (hasNotes) totalValues.push('');

  ctx.fillStyle = GREEN_TXT;
  ctx.font = `bold 15px ${FONT}`;
  totalValues.forEach((v, c) => {
    drawCell(ctx, v, xs[c], widths[c], totalY + ROW_H / 2, aligns[c]);
  });

  // Grid lines
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  for (let r = 0; r <= bodyCount; r++) {
    const ly = tableTop + HEAD_H + ROW_H * r;
    ctx.beginPath();
    ctx.moveTo(MARGIN, ly);
    ctx.lineTo(WIDTH - MARGIN, ly);
    ctx.stroke();
  }
  xs.slice(1).forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, tableTop);
    ctx.lineTo(x, tableTop + tableH);
    ctx.stroke();
  });
  ctx.strokeRect(MARGIN, tableTop, CONTENT_W, tableH);

  // Empty-state note
  if (sorted.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = SLATE;
    ctx.font = `italic 15px ${FONT}`;
    ctx.fillText('No reports were recorded for this period.', WIDTH / 2, tableTop + tableH + 34);
  }

  // ═══ 4 · FOOTER ════════════════════════════════════════════════════════════
  const footY = height - 30;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, footY - 18);
  ctx.lineTo(WIDTH - MARGIN, footY - 18);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = LIGHT;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(
    `Generated ${new Date().toLocaleString('en-GB')} | ${BRAND_NAME} - computer-generated report`,
    MARGIN, footY,
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const period = from && to
    ? (from === to ? from.slice(0, 10) : `${from.slice(0, 10)}_to_${to.slice(0, 10)}`)
    : 'all';

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daily_Sales_Report_${period}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
