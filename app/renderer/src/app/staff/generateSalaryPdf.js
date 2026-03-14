import { jsPDF } from 'jspdf';

// ── Colours (match dark theme translated to print-friendly palette) ──────────
const C = {
  bg: [15, 23, 42],          // slate-900
  card: [30, 41, 59],        // slate-800
  cardAlt: [51, 65, 85],     // slate-700/40
  white: [255, 255, 255],
  green: [52, 211, 153],
  amber: [251, 191, 36],
  red: [248, 113, 113],
  blue: [96, 165, 250],
  purple: [167, 139, 250],
  slate400: [148, 163, 184],
  slate500: [100, 116, 139],
  slate600: [71, 85, 105],
};

function setFill(doc, rgb) { doc.setFillColor(...rgb); }
function setTextColor(doc, rgb) { doc.setTextColor(...rgb); }
function setDrawColor(doc, rgb) { doc.setDrawColor(...rgb); }

function rect(doc, x, y, w, h, rgb, radius = 3) {
  setFill(doc, rgb);
  doc.roundedRect(x, y, w, h, radius, radius, 'F');
}

function text(doc, str, x, y, rgb, size = 9, bold = false) {
  setTextColor(doc, rgb);
  doc.setFontSize(size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.text(String(str ?? ''), x, y);
}

function label(doc, str, x, y) { text(doc, str, x, y, C.slate500, 7); }
function value(doc, str, x, y, color = C.white, size = 9, bold = false) { text(doc, str, x, y, color, size, bold); }

function statBox(doc, x, y, w, h, labelStr, valueStr, valueColor = C.white, subStr = '') {
  rect(doc, x, y, w, h, C.cardAlt);
  label(doc, labelStr, x + 3, y + 7);
  value(doc, valueStr, x + 3, y + 14, valueColor, 9, true);
  if (subStr) text(doc, subStr, x + 3, y + 20, C.slate600, 6.5);
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateSalaryPdf({
  emp,
  salaryMonth,
  attendanceSummary,
  monthlySummary,
  monthHistory,
  lastMonthBalance,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210; // page width mm
  const PH = 297;
  const M = 14;   // margin
  const W = PW - M * 2; // usable width

  // ── Full background ──────────────────────────────────────────────────────
  rect(doc, 0, 0, PW, PH, C.bg, 0);

  let y = 14;

  // ── Header ───────────────────────────────────────────────────────────────
  text(doc, `Salary Report — ${emp.name}`, M, y, C.white, 16, true);
  y += 6;
  text(doc, `Monthly Salary: PKR ${Number(emp.monthlySalary || 0).toLocaleString()}`, M, y, C.green, 9);
  text(doc, `Period: ${salaryMonth}`, PW - M - 35, y, C.slate400, 9);
  y += 3;

  // divider
  setDrawColor(doc, C.cardAlt);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 6;

  // ── Attendance Summary card ───────────────────────────────────────────────
  rect(doc, M, y, W, 62, C.card);
  text(doc, 'Attendance Summary', M + 4, y + 7, C.white, 10, true);

  const bw = (W - 8 - 6) / 4; // 4 stat boxes
  const bx = [M + 4, M + 4 + bw + 2, M + 4 + (bw + 2) * 2, M + 4 + (bw + 2) * 3];
  const by = y + 11;
  const bh = 18;

  statBox(doc, bx[0], by, bw, bh, 'Present Days', String(attendanceSummary.presentDays));
  statBox(doc, bx[1], by, bw, bh, 'Absent Days', String(attendanceSummary.absentDays));
  statBox(doc, bx[2], by, bw, bh, 'Total Hours', String(attendanceSummary.totalHours));
  statBox(doc, bx[3], by, bw, bh, 'Hourly Rate', `PKR ${attendanceSummary.hourlyRate.toLocaleString()}`);

  // Salary from attendance row
  const earnedY = by + bh + 3;
  rect(doc, M + 4, earnedY, W - 8, 16, C.cardAlt);
  label(doc, `Salary from attendance (${attendanceSummary.from} to ${attendanceSummary.to})`, M + 7, earnedY + 6);
  value(doc, `PKR ${monthlySummary.earned.toLocaleString()}`, M + 7, earnedY + 12, C.green, 11, true);

  y += 62 + 4;

  // ── Last month carry-over banner ──────────────────────────────────────────
  if (lastMonthBalance !== 0) {
    const bannerColor = lastMonthBalance > 0 ? [120, 80, 10] : [100, 20, 20];
    const textColor   = lastMonthBalance > 0 ? C.amber : C.red;
    const bannerLabel = lastMonthBalance > 0 ? 'Advance carried from last month' : 'Pending underpayment from last month';
    rect(doc, M, y, W, 10, bannerColor);
    text(doc, bannerLabel, M + 4, y + 6.5, textColor, 8);
    text(doc, `PKR ${Math.abs(lastMonthBalance).toLocaleString()}`, PW - M - 35, y + 6.5, textColor, 8, true);
    y += 14;
  }

  // ── Payment Summary — 4 boxes ─────────────────────────────────────────────
  rect(doc, M, y, W, 28, C.card);
  const sb4w = (W - 8 - 6) / 4;
  const sb4y = y + 4;

  const { salaryPaid, advancePaid, totalAdvanceAllTime, totalDue, remainingDue } = monthlySummary;

  statBox(doc, M + 4, sb4y, sb4w, 20, 'Salary Paid', `PKR ${salaryPaid.toLocaleString()}`, C.green);
  statBox(doc, M + 4 + sb4w + 2, sb4y, sb4w, 20, 'Advance',
    `PKR ${advancePaid.toLocaleString()}`, C.amber,
    totalAdvanceAllTime > advancePaid ? `Total: PKR ${totalAdvanceAllTime.toLocaleString()}` : '');

  statBox(doc, M + 4 + (sb4w + 2) * 2, sb4y, sb4w, 20, 'Total Due',
    `PKR ${totalDue.toLocaleString()}`, C.white,
    lastMonthBalance !== 0 ? `${lastMonthBalance > 0 ? '+' : ''}${lastMonthBalance.toLocaleString()} last mo.` : 'Salary + Advance');

  const remColor = remainingDue > 0 ? C.amber : remainingDue < 0 ? C.red : C.white;
  const remLabel = remainingDue > 0 ? 'Got Advance' : remainingDue < 0 ? 'Underpaid' : 'Settled';
  const remBg    = remainingDue > 0 ? [90, 55, 5] : remainingDue < 0 ? [80, 10, 10] : C.cardAlt;
  rect(doc, M + 4 + (sb4w + 2) * 3, sb4y, sb4w, 20, remBg);
  label(doc, remLabel, M + 4 + (sb4w + 2) * 3 + 3, sb4y + 7);
  value(doc, `PKR ${Math.abs(remainingDue).toLocaleString()}`, M + 4 + (sb4w + 2) * 3 + 3, sb4y + 14, remColor, 9, true);

  y += 32;

  // ── Payment History table ─────────────────────────────────────────────────
  text(doc, 'Payment History', M, y, C.white, 10, true);
  text(doc, salaryMonth, PW - M - 20, y, C.slate500, 8);
  y += 5;

  if (monthHistory.length === 0) {
    rect(doc, M, y, W, 12, C.card);
    text(doc, 'No payments this month', M + W / 2, y + 7.5, C.slate600, 8);
    y += 16;
  } else {
    // Table header
    rect(doc, M, y, W, 8, C.cardAlt);
    const cols = { date: M + 3, amount: M + 35, type: M + 70, source: M + 100, notes: M + 130 };
    const hy = y + 5.5;
    text(doc, 'DATE', cols.date, hy, C.slate400, 7, true);
    text(doc, 'AMOUNT', cols.amount, hy, C.slate400, 7, true);
    text(doc, 'TYPE', cols.type, hy, C.slate400, 7, true);
    text(doc, 'SOURCE', cols.source, hy, C.slate400, 7, true);
    text(doc, 'NOTES', cols.notes, hy, C.slate400, 7, true);
    y += 8;

    const TYPE_COLORS = { salary: C.blue, bonus: C.green, advance: C.amber };
    const rowH = 10;

    for (let i = 0; i < monthHistory.length; i++) {
      const rec = monthHistory[i];
      const rowBg = i % 2 === 0 ? C.card : [22, 32, 50];
      rect(doc, M, y, W, rowH, rowBg);
      const ry = y + 6.5;
      text(doc, rec.payDate, cols.date, ry, C.slate400, 7.5);
      text(doc, `PKR ${Number(rec.amount || 0).toLocaleString()}`, cols.amount, ry, C.white, 7.5, true);
      const typeColor = TYPE_COLORS[rec.type] || C.blue;
      text(doc, rec.type ? rec.type.charAt(0).toUpperCase() + rec.type.slice(1) : 'Salary', cols.type, ry, typeColor, 7.5);
      const srcColor = rec.paymentSource === 'today_sale' ? C.blue : C.purple;
      text(doc, rec.paymentSource === 'today_sale' ? 'From Sale' : 'Net Profit', cols.source, ry, srcColor, 7.5);
      if (rec.notes) {
        const noteStr = rec.notes.length > 25 ? rec.notes.slice(0, 25) + '…' : rec.notes;
        text(doc, noteStr, cols.notes, ry, C.slate500, 7);
      }
      y += rowH;

      // Page overflow guard
      if (y > PH - 20) {
        doc.addPage();
        rect(doc, 0, 0, PW, PH, C.bg, 0);
        y = 14;
      }
    }
    y += 4;
  }

  // ── Calculation breakdown ─────────────────────────────────────────────────
  y += 2;
  text(doc, 'Calculation Breakdown', M, y, C.slate400, 8, true);
  y += 5;
  rect(doc, M, y, W, 22, C.card);
  const calcY = y + 5;
  const step = (W - 8) / 4;
  const items = [
    { label: 'Earned (Attendance)', value: `PKR ${monthlySummary.earned.toLocaleString()}`, color: C.green },
    { label: 'Salary Paid', value: `PKR ${salaryPaid.toLocaleString()}`, color: C.white },
    { label: 'Advance Paid', value: `PKR ${advancePaid.toLocaleString()}`, color: C.amber },
    { label: remainingDue > 0 ? 'Employee Got Advance' : 'Remaining Due', value: `PKR ${Math.abs(remainingDue).toLocaleString()}`, color: remColor },
  ];
  items.forEach((item, i) => {
    label(doc, item.label, M + 4 + i * step, calcY);
    value(doc, item.value, M + 4 + i * step, calcY + 8, item.color, 8.5, true);
  });
  y += 26;

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = PH - 8;
  setDrawColor(doc, C.cardAlt);
  doc.setLineWidth(0.2);
  doc.line(M, footY - 4, PW - M, footY - 4);
  text(doc, `Generated on ${new Date().toLocaleString()}`, M, footY, C.slate600, 7);
  text(doc, `${emp.name} · ${salaryMonth}`, PW - M - 40, footY, C.slate600, 7);

  // ── Save ──────────────────────────────────────────────────────────────────
  doc.save(`salary_${emp.name.replace(/\s+/g, '_')}_${salaryMonth}.pdf`);
}
