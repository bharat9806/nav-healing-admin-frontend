import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WorkLog } from '@/types';

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

const CATEGORY_LABELS: Record<string, string> = {
  CALLING: 'Calling', RECEPTION: 'Reception', FOLLOW_UP: 'Follow Up',
  DATA_ENTRY: 'Data Entry', DISPATCH: 'Dispatch', MEETING: 'Meeting',
  ADMIN_WORK: 'Admin Work', OTHER: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', PENDING: 'Pending',
};

const OUTCOME_LABELS: Record<string, string> = {
  CONNECTED: 'Connected', NOT_PICKED: 'Not Picked', BUSY: 'Busy',
  SWITCHED_OFF: 'Switched Off', NOT_REACHABLE: 'Not Reachable',
  WRONG_NUMBER: 'Wrong Number', CALL_BACK: 'Call Back',
  INTERESTED: 'Interested', NOT_INTERESTED: 'Not Interested',
  ORDER_PLACED: 'Order Placed',
};

const CONNECTED_OUTCOMES = ['CONNECTED', 'INTERESTED', 'ORDER_PLACED', 'CALL_BACK'];

export interface WorkLogReportOptions {
  logs: WorkLog[];
  /** ISO date (YYYY-MM-DD) — start of the reported period. */
  dateFrom: string;
  /** ISO date (YYYY-MM-DD) — end of the reported period. Same as dateFrom for a single day. */
  dateTo: string;
  /** Name shown on the report. Omit for a multi-staff report. */
  staffName?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const fmtMinutes = (m?: number | null) => {
  if (!m) return '-';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h}h ${min}m` : `${min}m`;
};

const timeRange = (w: WorkLog) => {
  if (w.startTime && w.endTime) return `${w.startTime} - ${w.endTime}`;
  if (w.startTime) return `from ${w.startTime}`;
  return fmtMinutes(w.durationMinutes);
};

const linkedLabel = (c: WorkLog['calls'][number]) => {
  if (c.lead) return `Lead #${c.lead.id}`;
  if (c.prospect) return `Prospect #${c.prospect.id}`;
  if (c.patient) return `Patient #${c.patient.id}`;
  return 'New number';
};

/** Group logs by their calendar date (YYYY-MM-DD), oldest first. */
function groupByDay(logs: WorkLog[]): Array<[string, WorkLog[]]> {
  const map = new Map<string, WorkLog[]>();
  for (const w of logs) {
    const key = w.logDate.slice(0, 10);
    const bucket = map.get(key);
    if (bucket) bucket.push(w);
    else map.set(key, [w]);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

// jspdf-autotable stores the last table's end position on the doc.
const lastY = (doc: jsPDF): number =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

// ── Main ─────────────────────────────────────────────────────────────────────
export function generateWorkLogReport({
  logs,
  dateFrom,
  dateTo,
  staffName,
}: WorkLogReportOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mg = 14;
  const singleDay = dateFrom === dateTo;

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
  doc.text(singleDay ? 'DAILY WORK REPORT' : 'WORK REPORT', pageW - mg, 21, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    singleDay ? fmtDateLong(dateFrom) : `${fmtDateShort(dateFrom)} to ${fmtDateShort(dateTo)}`,
    pageW - mg, 27.5, { align: 'right' },
  );

  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Staff: ${staffName || 'All staff'}`, pageW - mg, 32.5, { align: 'right' });

  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.7);
  doc.line(mg, 38, pageW - mg, 38);

  // ═══ 2 · SUMMARY BAND ══════════════════════════════════════════════════════
  const allCalls = logs.flatMap((w) => w.calls);
  const connected = allCalls.filter((c) => CONNECTED_OUTCOMES.includes(c.outcome)).length;
  const totalMinutes = logs.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);

  const summary: [string, string][] = [
    ['Tasks Logged', String(logs.length)],
    ['Calls Made', String(allCalls.length)],
    ['Connected', String(connected)],
    ['Time Logged', fmtMinutes(totalMinutes) === '-' ? '0m' : fmtMinutes(totalMinutes)],
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

  // ═══ 3 · PER-DAY SECTIONS ══════════════════════════════════════════════════
  const days = groupByDay(logs);

  if (days.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text('No work was logged for this period.', mg, y + 4);
    y += 12;
  }

  days.forEach(([day, dayLogs], dayIdx) => {
    // Day heading (skipped on single-day reports — the date is already up top)
    if (!singleDay) {
      if (y > pageH - 60) { doc.addPage(); y = 20; }
      if (dayIdx > 0) y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...GREEN_TXT);
      doc.text(fmtDateLong(day), mg, y);
      y += 4;
    }

    // ── Tasks table ──────────────────────────────────────────────────────────
    const taskBody = dayLogs.map((w, i) => [
      String(i + 1),
      timeRange(w),
      CATEGORY_LABELS[w.category] ?? w.category,
      w.description ? `${w.title}\n${w.description}` : w.title,
      w.calls.length ? String(w.calls.length) : '-',
      STATUS_LABELS[w.status] ?? w.status,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Time', 'Category', 'Task', 'Calls', 'Status']],
      body: taskBody,
      margin: { left: mg, right: mg },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
        textColor: INK,
        lineColor: BORDER,
        lineWidth: 0.1,
        valign: 'middle',
      },
      headStyles: {
        fillColor: GREEN_DARK,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8, textColor: SLATE },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'center', cellWidth: 24 },
        3: { halign: 'left' },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 22 },
      },
      theme: 'grid',
      tableLineColor: BORDER,
      tableLineWidth: 0.1,
    });

    y = lastY(doc) + 7;

    // ── Calls table for the day ──────────────────────────────────────────────
    const dayCalls = dayLogs.flatMap((w) => w.calls);
    if (dayCalls.length > 0) {
      if (y > pageH - 45) { doc.addPage(); y = 20; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GREEN_TXT);
      doc.text(`Numbers Called (${dayCalls.length})`, mg, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [['#', 'Number', 'Name', 'Outcome', 'Length', 'Linked To', 'Notes']],
        body: dayCalls.map((c, i) => [
          String(i + 1),
          c.phone,
          c.contactName || '-',
          OUTCOME_LABELS[c.outcome] ?? c.outcome,
          c.durationSeconds != null ? `${c.durationSeconds}s` : '-',
          linkedLabel(c),
          c.notes || '-',
        ]),
        margin: { left: mg, right: mg },
        styles: {
          fontSize: 8,
          cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
          textColor: INK,
          lineColor: BORDER,
          lineWidth: 0.1,
          valign: 'middle',
        },
        headStyles: {
          fillColor: GREEN_TXT,
          textColor: WHITE,
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center',
          valign: 'middle',
        },
        alternateRowStyles: { fillColor: [248, 251, 248] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8, textColor: SLATE },
          1: { halign: 'left', cellWidth: 26, fontStyle: 'bold' },
          2: { halign: 'left', cellWidth: 26 },
          3: { halign: 'center', cellWidth: 24 },
          4: { halign: 'center', cellWidth: 16 },
          5: { halign: 'center', cellWidth: 24 },
          6: { halign: 'left' },
        },
        theme: 'grid',
        tableLineColor: BORDER,
        tableLineWidth: 0.1,
      });

      y = lastY(doc) + 9;
    }
  });

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
  doc.text(staffName || 'Staff Signature', mg, sigY + 4.5);
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
      `Generated ${new Date().toLocaleString('en-GB')} | ${BRAND_NAME} - computer-generated work report`,
      mg, footY,
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - mg, footY, { align: 'right' });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const safeName = (staffName || 'All_Staff').replace(/[^a-z0-9]/gi, '_');
  const period = singleDay ? dateFrom : `${dateFrom}_to_${dateTo}`;
  doc.save(`Work_Report_${safeName}_${period}.pdf`);
}
