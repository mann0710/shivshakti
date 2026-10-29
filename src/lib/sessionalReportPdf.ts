import jsPDF from 'jspdf';
import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { ItemTotal } from './cart';
import { formatSize } from './units';
import { rs } from './money';
import { billNumber } from './receipt';

type RGB = [number, number, number];
const M = 15;
const CW = 210 - M * 2;
const ROW = 8;

const NAVY: RGB = [26, 35, 126];
const RED: RGB = [163, 45, 45];
const GREEN: RGB = [15, 110, 86];

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function header(doc: jsPDF, title: string, color: RGB, year: number): number {
  doc.setFillColor(...color); doc.rect(M, M, CW, 14, 'F');
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(title, M + CW / 2, M + 9, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
  doc.text(`Year: ${year}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`, M, M + 20);
  return M + 28;
}

function boxes(doc: jsPDF, y: number, items: { label: string; value: string }[], color: RGB): number {
  const bw = CW / items.length - 2;
  items.forEach((b, i) => {
    const bx = M + i * (bw + 2.67);
    doc.setFillColor(240, 242, 250); doc.rect(bx, y, bw, 16, 'F');
    doc.setDrawColor(210, 214, 235); doc.rect(bx, y, bw, 16);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 120);
    doc.text(b.label, bx + bw / 2, y + 5, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
    doc.text(b.value, bx + bw / 2, y + 12, { align: 'center' });
  });
  return y + 22;
}

function table(doc: jsPDF, y: number, cols: string[], widths: number[], rows: string[][], color: RGB): number {
  const head = (top: number) => {
    doc.setFillColor(...color); doc.rect(M, top, CW, ROW, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    let cx = M + 2; cols.forEach((c, i) => { doc.text(c, cx, top + 5.5); cx += widths[i]; });
    return top + ROW;
  };
  y = head(y);
  doc.setFont('helvetica', 'normal');
  rows.forEach((cells, idx) => {
    if (y > 275) { doc.addPage(); y = head(M); doc.setFont('helvetica', 'normal'); }
    doc.setFillColor(...((idx % 2 === 0 ? [250, 250, 248] : [255, 255, 255]) as RGB)); doc.rect(M, y, CW, ROW, 'F');
    doc.setDrawColor(230, 230, 228); doc.rect(M, y, CW, ROW);
    doc.setTextColor(40, 40, 40); doc.setFontSize(7);
    let cx = M + 2; cells.forEach((c, i) => { doc.text(c, cx, y + 5.5); cx += widths[i]; });
    y += ROW;
  });
  return y + 6;
}

const section = (doc: jsPDF, y: number, text: string, color: RGB) => {
  if (y > 250) { doc.addPage(); y = M; }
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
  doc.text(text, M, y);
  return y + 5;
};

const sum = (list: { total_amount: number }[]) => list.reduce((s, o) => s + o.total_amount, 0);

export function salesReportPdf(year: number, orders: SeasonalOrder[], occName: (id?: string) => string | undefined) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(doc, 'SESSIONAL SALES REPORT', NAVY, year);
  const paid = orders.filter(o => o.is_paid);
  y = boxes(doc, y, [
    { label: 'Total Sales', value: rs(sum(orders)) },
    { label: 'Paid', value: rs(sum(paid)) },
    { label: 'Unpaid', value: rs(sum(orders) - sum(paid)) },
    { label: 'Bills', value: String(orders.length) },
  ], NAVY);
  table(doc, y, ['Bill', 'Customer', 'Phone', 'Occasion', 'Total', 'Status'], [14, 44, 26, 38, 26, 22],
    orders.map(o => [billNumber(o.bill_no, o.id), clip(o.customer_name, 26), o.phone || '-', clip(occName(o.occasion_id) ?? '-', 22), rs(o.total_amount), o.is_paid ? `Paid ${(o.payment_mode ?? '').toUpperCase()}` : 'Unpaid']), NAVY);
  doc.save(`sessional-report-${year}.pdf`);
}

export function unpaidReportPdf(year: number, orders: SeasonalOrder[], preorders: SeasonalPreorder[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(doc, 'UNPAID REPORT', RED, year);
  const unpaid = orders.filter(o => !o.is_paid);
  const due = preorders.filter(p => p.status !== 'cancelled' && p.advance_paid < p.total_amount);
  if (unpaid.length) {
    y = section(doc, y, `Unpaid bills (${unpaid.length}) - ${rs(sum(unpaid))}`, RED);
    y = table(doc, y, ['Customer', 'Phone', 'Items', 'Amount'], [45, 28, 72, 35],
      unpaid.map(o => [clip(o.customer_name, 26), o.phone || '-', clip(o.items.map(i => `${i.item_name}x${i.qty}`).join(', '), 44), rs(o.total_amount)]), RED);
  }
  if (due.length) {
    const balance = due.reduce((s, p) => s + p.total_amount - p.advance_paid, 0);
    y = section(doc, y, `Pre-bookings with balance (${due.length}) - ${rs(balance)}`, RED);
    table(doc, y, ['Customer', 'Phone', 'Total', 'Advance', 'Balance', 'Status'], [44, 27, 24, 24, 24, 22],
      due.map(p => [clip(p.customer_name, 26), p.phone || '-', rs(p.total_amount), rs(p.advance_paid), rs(p.total_amount - p.advance_paid), p.status]), RED);
  }
  if (!unpaid.length && !due.length) section(doc, y, 'Nothing pending. All bills are paid.', GREEN);
  doc.save(`unpaid-report-${year}.pdf`);
}

export function itemSalesPdf(year: number, totals: ItemTotal[], bills: number, prebookings: number) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(doc, 'ITEM SALES SUMMARY', GREEN, year);
  y = boxes(doc, y, [
    { label: 'Items', value: String(totals.length) },
    { label: 'Packs sold', value: String(totals.reduce((s, t) => s + t.packs, 0)) },
    { label: 'Bills', value: String(bills) },
    { label: 'Pre-bookings', value: String(prebookings) },
  ], GREEN);
  table(doc, y, ['Item', 'Packs', 'Quantity', 'Revenue'], [90, 25, 35, 30],
    totals.map(t => [clip(t.name, 50), String(t.packs), formatSize(t.amount, t.unit), rs(t.revenue)]), GREEN);
  doc.save(`item-sales-${year}.pdf`);
}
