# Shiv Shakti — Catering & Sweets

Web app for Shiv Shakti's two businesses:

- **Catering:** customers, bookings, quotations (single and multi-day), invoices, payments, calendar and finance.
- **Sweets (Sessional):** a tap-to-bill POS, pre-bookings, and an item catalog priced per kg.

Built with React 18 + TypeScript (Create React App), TanStack Query and Supabase (Postgres + PostgREST). Printed documents are HTML templates; real PDF files come from a small PDF service (`api/pdf.js`, headless Chrome on Vercel).

## Quick start

```bash
npm ci
npm start
```

Create `.env.local` (not committed):

```
REACT_APP_SUPABASE_URL=https://<project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon key>
```

### Security: staff login (do this first)

The Supabase Security Advisor reported 22 errors and 1 warning:
- row-level security was off on every table;
- the five existing policies allowed everything to everyone;
- the `documents` storage bucket let anyone list, upload or delete files.

Because the anon key is public (it ships inside the website), anyone could read or wipe all data. The app now requires a staff login, and the database only serves signed-in staff.

1. Supabase → **Authentication → Users → Add user → Create new user**: your email and a password, with **Auto Confirm User** ticked.
2. Optional but recommended: Authentication → Sign In / Providers → turn off **Allow new users to sign up**.
3. SQL Editor: open [`supabase/migrations/20261031_security_rls.sql`](supabase/migrations/20261031_security_rls.sql), replace `owner@example.com` with your login email (add a line per staff member), and run it.
   - Every table gets row-level security with a single rule: only signed-in emails listed in the `staff` table can read or write. The check (`private.is_staff()`) lives in a schema the API doesn't expose.
   - The open policies are removed.
   - The documents bucket stays viewable by direct link, but only staff can list, upload, replace or delete files.
4. Open the app and sign in. To add staff later, run `insert into public.staff (email) values ('name@example.com');` and create their user in Authentication.

A signed-in email that isn't on the staff list sees an "Access not set up" screen. Sign out is at the bottom of the sidebar, and in the phone **More** menu.

Done on the live project on 30 Oct 2026, after a full data backup (`backups/`, gitignored). Security Advisor: 0 errors, 0 warnings. The pack-sizes update below was also applied.

### One-time database update (required for the new sweets features)

Open Supabase → **SQL Editor**, paste and run
[`supabase/migrations/20261030_sessional_pack_sizes.sql`](supabase/migrations/20261030_sessional_pack_sizes.sql).
It is safe to run more than once. It:

- adds `unit`, `rate`, `pack_sizes`, `pack_prices` and `category` to `seasonal_items`, and fills `unit` and `rate` from the old rows;
- adds `pack_sizes` (shop default sizes) to `data_center`;
- adds running bill numbers (`bill_no`) to `seasonal_orders`.

### Invoice and quote numbers

Run [`supabase/migrations/20261102_doc_numbers.sql`](supabase/migrations/20261102_doc_numbers.sql) **before** deploying this version: new invoices and quotations get their number from a database trigger (continuing from the highest existing one). Applied on the live project on 30 Oct 2026.

### Older advances

Run [`supabase/migrations/20261103_backfill_advances.sql`](supabase/migrations/20261103_backfill_advances.sql) once: invoices made before payment history existed kept the advance only as a total. This gives each a payment row so it shows in history. (The app also does this automatically the first time such an invoice is saved or paid, so the advance is never lost.) Applied on the live project on 30 Oct 2026.

### Pre-booking pickup / delivery and hand-over payments

Run [`supabase/migrations/20261104_preorder_fulfillment.sql`](supabase/migrations/20261104_preorder_fulfillment.sql) (adds `fulfillment`, `delivered_at`, `balance_paid`, `balance_mode` to `seasonal_preorders`; safe to re-run). Until it is run, the app skips these fields: pickup/delivery is guessed from the address, and the hand-over payment mode overwrites the advance mode as before. **Not yet applied on the live project.**

### Document settings

Run [`supabase/migrations/20261105_doc_settings.sql`](supabase/migrations/20261105_doc_settings.sql) (adds `data_center.doc_settings`; safe to re-run). Until it is run, Data Center → Documents shows a notice and every document uses the defaults. **Not yet applied on the live project.**

### Quotation options and price ranges

Run [`supabase/migrations/20261106_quote_options.sql`](supabase/migrations/20261106_quote_options.sql) (adds `option_group`, `option_label`, `option_name`, `per_plate_max`, `total_max` to `quotations`; safe to re-run). Until it is run, "+ Add option" stays hidden and price ranges are not stored (choice groups still work, inside the dishes). **Not yet applied on the live project.**

### PDF service (Vercel)

`api/pdf.js` turns a document into a PDF with headless Chrome (`puppeteer-core` + `@sparticuz/chromium`). It needs no setup beyond the usual `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` environment variables in Vercel (it also accepts `SUPABASE_URL` / `SUPABASE_ANON_KEY`).
- Only signed-in staff can use it (it calls `is_staff` with the user's token).
- The page may load nothing but embedded images and Google Fonts.
- Every page gets "Page X of Y" and the document reference in the footer.
- `GET /api/pdf` is a health check (Node version and whether the PDF libraries load). Live and checked on 31 Oct 2026: a staff request returns a PDF in about 4–5 s on a cold start.
- If the service cannot be reached (local `npm start`, offline), the app opens the print window instead; choose "Save as PDF".
- To try it locally: `CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"` and call `require('./api/pdf').render(html, footer)` from Node.

### Item prices and customer GSTIN

Run [`supabase/migrations/20261101_prices_gstin.sql`](supabase/migrations/20261101_prices_gstin.sql) (adds `menu_items.default_price` and `customers.gstin`; safe to re-run). Until it is run, the price and GSTIN fields stay hidden. Applied on the live project on 30 Oct 2026, after copying every table into the `backup_20261030` schema (not exposed to the API; drop it once you are happy).

Then open **Sessional Items** and click **Review & merge** to fold old one-row-per-pack items into single items (see below).

Until the SQL is run, the app keeps working in a compatible mode and shows a yellow banner. Standard 250 g / 500 g / 750 g / 1 kg packs work. Custom sizes, manual pack prices, categories, per-piece items and bill numbers need the update.

## Sweets: per-kg pricing and pack sizes

Each sweet is **one item** with a rate per kg, per litre or per piece. Pack prices are calculated automatically:

| Kaju Katli at ₹850/kg | 250 g | 500 g | 750 g | 1 kg |
|---|---|---|---|---|
| Price | ₹213 | ₹425 | ₹638 | ₹850 |

- **Shop pack sizes** (Sessional Items → ⚖ Pack sizes): the default buttons for every item, e.g. add 400 g or 2 kg. Litre and piece items have their own lists.
- **Per-item sizes:** untick "Use shop pack sizes" in the item form to give one item its own sizes.
- **Manual pack price:** type a price for any size (e.g. ₹240 for a 250 g gift box). It overrides the calculated price for that size only.
- **Duplicate guard:** adding an item whose name already exists for that occasion is blocked, with an "Edit it instead" button. Typing a weight in the name ("Kaju Katli 500g") shows a hint to remove it.
- **Merge duplicates:** old data stored one row per pack ("Kaju Katli 250 gm", "Kaju Katli 500 gm", …). The merge tool:
  - groups rows by name, unit and occasion and keeps one row per group;
  - keeps every old price exactly (as a manual pack price where it differs from the rate);
  - re-links old bills and pre-bookings to the kept item so reports add up;
  - deletes the extra rows.

  You see a preview first and can untick any group.
- **Bulk price change:** tick items (or use the current filter), then **₹ Change prices**: ± % or ± ₹, rounded to ₹1/5/10/20/50, with a preview. Manual pack prices move by the same rule.
- Search, occasion, category and active/inactive filters; bulk activate/deactivate.

## Sweets POS (Sessional billing)

The grid-and-bill layout follows NodeDR POS.

- **Item grid:** search (Enter adds the top match), category chips and an occasion filter. Items with no occasion always show. Best sellers are listed first.
- **Tiles:** one tap on a pack button (250 g ₹213) adds it. Tap the name or **Custom** to pick a quantity, sell a loose weight ("300", "1.25 kg") or sell by amount ("₹100 worth").
- **Bill panel:**
  - +/− steppers plus a typed quantity (tap the number, type 24), discount in ₹ or %;
  - payment by **Cash / UPI / Unpaid**;
  - cash received shows the change to return;
  - a big **Charge ₹X** button.
- **Customers:** walk-in by default. Name and mobile are required only for unpaid bills and pre-bookings. Typing a name or number suggests saved customers. New customers with a valid mobile are saved automatically.
- **Counter bill / Pre-booking** toggle on the same screen. Pre-bookings take **Pickup from shop / Home delivery** (delivery needs the address), a date (defaults to tomorrow), an advance and the advance mode.
- After saving: **Print** (bills: 80 mm thermal receipt; pre-bookings: a full A4 slip with customer, hand-over, items, advance, amount paid at hand-over, balance and signature lines), **WhatsApp** and **New bill**.
- The bill in progress survives a page refresh. Phones get a sticky bar with the item count, total and "View bill".
- **Bills tab:**
  - today's sales split into cash, UPI and unpaid;
  - Today / Unpaid / All year filters; search by name, mobile or bill #;
  - mark paid (Cash/UPI), print, WhatsApp, edit (loads the bill back into the POS) and delete with confirmation.
- **Pre-bookings tab:**
  - **Sheet view** (default), the paper register as a to-do list: one row per customer, one column per sweet with its ₹/kg, cells like "500 g × 2", a **Total quantity** row, and tick boxes for **Packed** and **Given**. Ticking Given asks for the balance received (Cash/UPI). **Print sheet** prints it landscape with tick boxes;
  - **List view**: cards with Confirm, Mark packed, Hand over & collect, Print slip, WhatsApp, Edit, Cancel, Delete;
  - status flow: Pending → Confirmed → Packed → Handed over (or Cancelled);
  - Open / Due by tomorrow / Done / All filters, search, overdue highlighting;
  - a **kitchen prep list** (total kg of each sweet still to make per date, printable).
- **Reports tab:** pick a period (Today, Yesterday, Last 7 days, This month, Last month, This FY, This year or any from–to dates) and an occasion. Every report has headline numbers, tables with totals, an empty state, **Print / PDF** (A4, the print dialog saves as PDF) and **CSV / Excel**.
  - **Sales:** counter bills + pre-bookings handed over, day by day (month by month for long periods), by occasion, unpaid bills;
  - **Items:** item-wise packs, quantity (kg / ltr / pcs) and revenue with share, plus sales by pack size;
  - **Categories:** the same by category (set in Sessional Items);
  - **Payments:** money received by mode (Cash / UPI / bank / cheque) from counter bills, pre-booking advances, hand-over balances and catering payments, day by day;
  - **Pre-bookings:** due in the period by status and date (pickup vs delivery), what is still to make, every booking with paid and balance;
  - **Dues:** everything still to collect as of today: unpaid bills (with age), pre-booking balances, catering invoice balances;
  - **Catering:** events in the period with value, invoiced, paid, balance, by event type and status;
  - **Top:** top 10 items, sweets customers and catering customers.

The phone bottom bar now has a **POS** button.

## Easier to use, especially on phones

- **Popups that always show:** forms open in dialogs, bottom sheets on phones. Before, they rendered below long lists and looked dead. This covers new/edit booking, customer and package. Deletes and other risky actions use an in-app confirmation instead of the browser's confirm box, which many phone home-screen setups block silently.
- **Back button works:** each screen has its own address (`#bookings`, `#quotations`, …), so the phone Back button returns to the previous screen instead of leaving the app.
- **One tap to the form:** dashboard quick actions (New booking, New quotation, Add customer, Create invoice) open the form directly. A booking's **Quote** action opens a new quotation with that booking already selected.
- **Share on WhatsApp:**
  - quotations and invoices can be shared as a PDF;
  - on a phone the PDF itself goes into WhatsApp through the share sheet;
  - on a computer the PDF downloads and WhatsApp opens with the message ready.
- **Phone layouts:** booking, quotation, invoice and Sweets admin lists turn into cards on phones, so no actions are cut off. Stats show two per row. Menu Builder stacks its columns instead of squeezing three onto a phone screen.
- **Search:** bookings, quotations and invoices can be searched by name, phone or number.
- **Item prices:** set a **₹ price** on any Menu Builder item. Adding it to a quotation fills that price; items without one use the price you last quoted.
- **Quote first:** **New Quotation** starts with *New event*: pick or add the customer, type event, date, venue and guests, and saving creates the booking too. *Existing booking* is still there. Guests typed in the quote update the booking.
- **Statuses move by themselves:** sharing a draft quote marks it **Sent** and the booking **Follow-up**; marking it **Accepted** confirms the booking and offers **Create invoice**.
- **Per-plate pricing by default:** item price boxes are hidden unless **Price each item** is ticked (remembered per device; quotes that already have item prices show them).
- **Event page:** tap a customer name in Bookings (or an upcoming event on the Dashboard, or a booking in a customer's history) to see one page with a progress bar *Inquiry → Quoted → Confirmed → Invoiced → Paid*, the next step as a button, its quotations (edit, share, accept) and invoice (open, record payment).
- **Packages + Menu Builder together:** pick package lines from Menu Builder, then use **Start from package** in a quotation to add its items with their prices and the package's per-plate rate (the booking's package is preselected).
- **Simpler billing:** one **Save changes** bar for guest counts, extra charges, discounts and transport (with Discard). Single-day invoices take the **final guest count**. Statuses read Unpaid / Part paid / Paid.
- **Safer money:** payment edits can't exceed the balance; deleting a payment on a completed booking sets it back to confirmed; invoice and quote numbers come from the database, so two phones never get the same number.
- **Real amounts everywhere:** bookings, calendar, customer cards and Finance show the invoice total, else the chosen quotation, instead of a ₹0 package estimate.
- **Bookings:** the same venue can't be double-booked across overlapping multi-day dates. Customer cards show the next upcoming event.
- **GST-ready invoices:** with GST on, the PDF is titled **Tax Invoice** and shows the SAC code (996334), the customer's GSTIN (add it on the customer), CGST + SGST halves (IGST when the customer's GSTIN is from another state) and the amount in words. Billing shows the same split.
- **Packages** can be reactivated ("Show inactive"). The Calendar day panel scrolls into view on phones and has a "+ New booking" shortcut.
- **Quote → booking → invoice:** marking a quotation Accepted offers to confirm its booking, then shows "Create invoice →". Confirmed bookings also have an **Invoice** button that opens the invoice form with that booking selected.
- **GST stays as issued:** editing an old quotation or invoice keeps the GST rate it was issued at, even if the Data Center rate has changed since.
- **Long lists are complete:** customers, bookings, quotations, invoices, payments and sweets load page by page, so nothing silently drops after 1,000 rows.
- **Google Calendar:** the "add to Google Calendar" step is a button you tap. It used to be an automatic popup that phones blocked.

## Quotation options, "choose any" dishes and the quote calendar

- **Calendar view** (Quotations → Calendar): a month of quotes by event date, coloured by status (draft, sent, accepted, not chosen / rejected). Tap a day for its quotes, a busy-day note and **+ New quote on this day** (the date is filled in). On phones the days show dots and the list sits below.
- **Several quotes on one day are allowed.** The form warns when the date already has other quotes or the venue is booked by a confirmed event, but never blocks. Only two *confirmed* bookings at the same venue and date are refused.
- **"Choose any N of M" groups:** in the selected dishes, tap **+ Choose-any group**, tick the dishes and **Group**. Set how many the customer picks.
  - With item prices, the plate price becomes a **range** (cheapest to dearest picks) until the customer chooses; tick **Included in the plate price** to keep the dishes as free choices.
  - **Fixed plate price** (beside Per Plate) quotes one price whatever they pick.
  - Works in single-day menus and in every meal of a multi-day event.
- **Options A / B / C:** on a saved quotation, **+ Add option** copies it as the next option of the same enquiry, with its own menu, price and name (e.g. Classic, Premium). Tabs switch between options; the list keeps them together.
- **Mark accepted…** (from the editor, the status menu or the event page) asks which option the customer took and which dishes they picked, with the final guest count and a live price. It locks in the picks and exact price, marks the other options **Not chosen**, confirms the booking and offers the invoice.
- **PDF:** options are compared side by side, then each option's menu and price; choice groups print with tick boxes and their price effect; the total shows as a range until decided; the payment schedule shows percentages until the price is final. Invoices and the event menu list only the dishes that will be served.

## Printed documents (quotations, invoices, slips, bills, reports)

One look ("Navy & Leaf", from the logo) for everything that is printed or shared:
- **Quotation:**
  - logo strip with address, GSTIN, number, issue date and *valid till*;
  - customer and event facts;
  - the menu grouped by course, with sub-groups, "served with" and notes;
  - **per plate** (no dish prices) or **per item** (dish prices, course subtotals, menu value and the special-price saving);
  - **multi-day / several meals in a day:** one card per meal with time, ceremony, guests, rate or offer and amount;
  - the **price** table, extra charges, transport and GST, ending with the navy **total banner**;
  - then the payment schedule in rupees, "on request" extras, terms, signatures and a UPI QR to pay the booking amount.
- **Tax invoice:**
  - bill-to with GSTIN, place of supply and SAC;
  - one line per meal (multi-day), extra charges and transport as lines;
  - discounts broken down, taxable value, CGST/SGST or IGST, amount in words;
  - payments received, balance with a UPI QR, and the menu served as the last page.
- **Event menu** (Calendar): the kitchen copy without prices.
- **Sweets:**
  - 80 mm bill (black only, big total, payment status);
  - A4 pre-booking slip with every payment and a tear-off counter stub (Packed / Given);
  - register sheet and kitchen prep list in the same style.
- **Reports:** the same header, headline tiles and tables.
- **Data Center → Documents:** accent colour, shop address, UPI ID, bank details, contact person, quote validity, payment schedule (must add up to 100%), "on request" list, terms, and switches for the QR codes, invoice payments, invoice menu page and the slip stub, plus the bill footer line.
- Gujarati names print correctly (Noto Sans Gujarati); amounts use the real ₹ sign.

## Catering fixes in this release

- New invoices include the quotation's extra charges in the total. They were under-billed before.
- "Advance already paid" is saved as a real payment, so recording a later payment no longer wipes it out.
- Invoices copy the quotation's manual discounts. The quotation used is the accepted one, if any.
- On multi-day invoices, "Save Guest Counts" uses the new guest counts for offer savings.
- Payments must be more than ₹0, and Save Payment can't be double-tapped.
- Invoice WhatsApp links include the 91 country code.
- Editing a quotation no longer resets it to draft.
- Auto-generated event days are no longer one day early in IST.
- Cloning a quotation keeps the food type and no longer fails without a booking.
- Bookings:
  - the end date, time and package can be cleared;
  - a blank venue is no longer treated as a clash;
  - a failed save no longer creates a duplicate customer.
- The dashboard counts today's events as upcoming.
- Data Center:
  - 0% GST can be saved;
  - the old FSSAI file is deleted only after the new one uploads.
- An error after start-up is logged instead of replacing the whole app with a stack trace.
- Finance:
  - month labels no longer skip or repeat a month on the 29th–31st;
  - revenue by event type covers every event type and leaves out cancelled bookings;
  - the GST card no longer claims everything is at 18%.

The full audit, with what is fixed and what is still open, is in [docs/AUDIT.md](docs/AUDIT.md).

## Project structure

```
src/
  App.tsx, components/navItems.ts   app shell, one nav config (sidebar + phone bar + drawer)
  components/ui/                    Modal, ConfirmDialog (useConfirm), shared styles
  components/catering/              booking, quotation, customer and invoice pieces (dialogs, lists, cards)
  hooks/useAuth.ts, components/LoginScreen.tsx   staff sign-in and the staff-list check
  hooks/useNavIntent.ts             "open the new form" / "preselect this booking" between screens
  components/pos/                   ProductGrid, ProductTile, PackPicker, TicketPanel, TicketLines,
                                    CustomerFields, CheckoutFields, SaleDone, QtyInput
  components/sessional/             PosTab, OrdersTab, PreordersTab, PreorderSheet, PrepList, ReportsTab,
  components/sessional/reports/     RangeBar (period + occasion), ReportView (renders any report)
                                    item form, bulk price, merge and pack-size dialogs, MigrationBanner
  hooks/                            Supabase data hooks (TanStack Query)
  lib/units.ts                      units, pack sizes, pack prices, size parsing/labels
  lib/itemCatalog.ts                item normalisation (old + new rows), save payloads, name cleanup
  lib/mergePlan.ts                  duplicate detection and merge plan
  lib/cart.ts, lib/posForm.ts       bill lines, totals, validation, save payloads
  lib/receipt.ts, sessionalReceipts.ts   thermal receipt, print, WhatsApp text
  lib/preorders.ts                  pre-booking statuses, balances, pickup/delivery, hand-over date
  lib/preorderSheet.ts, preorderSlip.ts   pre-booking register (sheet + print) and the A4 slip
  lib/reports/                      report builders (sweets, money, pipeline), date ranges, Print/PDF + CSV export
  hooks/usePreorderActions.tsx      pack, hand over + collect, cancel, delete (shared by sheet and list)
  hooks/useReportData.ts            data for one report period
  lib/quoteChoices.ts, quoteOptions.ts   choose-any groups, price ranges, accepting picks; options, same-day note, quote dates
  hooks/useQuoteForm.ts, useAcceptFlow.tsx   quotation form state and totals; accept with option + picks
  components/catering/QuotationCalendar, QuotationOptionsBar, QuotationChoiceGroup, QuoteAcceptDialog
  lib/docs/                         printed documents: theme, parts, menu blocks, quotation, invoice/event menu, sweets, settings, QR, output (PDF service → download/share, print fallback)
  api/pdf.js                        PDF service (Vercel function, headless Chrome)
  components/DocSettingsCard.tsx    Data Center → Documents
  lib/quoteMath.ts                  shared catering money math
  pages/                            one file per screen
supabase/
  schema.sql                        baseline schema (inferred from the code, for local dev)
  migrations/                       SQL to run on the live database (pack sizes, security/RLS, item prices + GSTIN, invoice/quote numbers, pre-booking fulfillment, document settings, quote options)
```

## Tests and checks

```bash
CI=true npx react-scripts test --watchAll=false   # unit tests: pack pricing, merge plan, money, GST, documents, reports, pre-booking sheet/slip, nav
npx tsc --noEmit -p .                             # type check
npx eslint src --ext .ts,.tsx                     # lint (the hosted build fails on warnings when CI=true)
```

### Local database (optional)

`supabase/schema.sql` recreates every table, so you can run the app against a local Postgres + PostgREST (e.g. Docker) instead of the live project.

## Translations

The app is English only today and has no translation files. If Hindi or other languages are added later, add English and Hindi first. Other languages need to be translated separately by the owner.
