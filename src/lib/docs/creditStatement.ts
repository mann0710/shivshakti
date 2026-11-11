// A4 credit statement for one customer: every bill given on credit, every payment, the running balance and a UPI QR.
import { Account } from '../credit/accounts';
import { ledgerOf, ledgerTotals } from '../credit/ledger';
import { DocContext, docContext } from './context';
import { page, esc, money } from './theme';
import { header, docTable, upiBox, endLine, footerText } from './parts';
import { Doc, fileSafe } from './quotationDoc';
import { amountInWords } from '../gst';
import { formatDateIST } from '../ist';
import { formatPhone } from '../people';

const day = (d: string) => formatDateIST(d, 'dd MMM yyyy');
const cell = (n: number) => (n ? money(n) : '');

export function creditStatementDoc(a: Account, today: string, ctx: DocContext = docContext()): Doc {
  const s = ctx.settings;
  const rows = ledgerOf(a);
  const tot = ledgerTotals(rows);
  const due = a.owed;
  const from = rows[0]?.day ?? today;
  const status = due > 0 ? 'Amount due' : a.advance > 0 ? 'Advance with us' : 'Nothing due';

  const table = docTable(['Date', 'Details', 'Given', 'Received', 'Balance'],
    rows.map(r => [day(r.day), `${esc(r.what)}<div class="muted">${esc(r.sub)}</div>`, cell(r.given), cell(r.got), `<b>${money(r.balance)}</b>`]),
    ['', 'Total', money(tot.given), money(tot.got), money(due - a.advance)], 2);
  const still = a.open.map(i => `${esc(i.label)} (${day(i.day)}) ${money(i.due)}`).join(' · ');

  const body = `${header(ctx, 'Credit statement', esc(a.name), `As of ${day(today)}`, s.sweets_name)}
<div class="wrap">
  <div class="intro">
    <div class="fact"><span class="lbl">To</span><span class="big">${esc(a.name)}</span><span class="muted num">+91 ${esc(formatPhone(a.phone))}</span></div>
    <div class="fact" style="text-align:right"><span class="lbl">${status}</span><span class="big num">${money(due > 0 ? due : a.advance)}</span>
      <span class="muted">${day(from)} – ${day(today)}</span></div>
  </div>
  <section>${rows.length ? table : '<p class="muted">No credit yet.</p>'}</section>
  ${due > 0 ? `<section><span class="lbl">Still due</span><div>${still}</div><div class="muted" style="margin-top:4px">${esc(amountInWords(due))}</div></section>` : ''}
  ${due > 0 ? upiBox(ctx, due, `Scan to pay ${money(due)}`, `Credit ${a.name}`) : ''}
  <p class="muted" style="margin-top:12px">Paid already? Please ignore this statement, or send us the UPI reference.</p>
</div>
${endLine(ctx, `Thank you for shopping at ${s.sweets_name}`)}`;

  return {
    html: page(`Credit statement - ${a.name}`, s.accent, body),
    fileName: `${fileSafe(['Statement', a.name, day(today)].join(' '))}.pdf`,
    footer: footerText('Credit statement', a.name, s.sweets_name),
  };
}
