# Shiv Shakti — Catering & Sweets

Web app for Shiv Shakti's two businesses:

- **Catering:** customers, bookings, quotations (single and multi-day), invoices, payments, calendar and finance.
- **Sweets (Sessional):** a tap-to-bill POS, pre-bookings, and an item catalog priced per kg.

Built with React 18 + TypeScript (Create React App), TanStack Query and Supabase (Postgres + PostgREST). PDFs are made with jsPDF.

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

### One-time database update (required for the new sweets features)

Open Supabase → **SQL Editor**, paste and run
[`supabase/migrations/20261030_sessional_pack_sizes.sql`](supabase/migrations/20261030_sessional_pack_sizes.sql).
It is safe to run more than once. It:

- adds `unit`, `rate`, `pack_sizes`, `pack_prices` and `category` to `seasonal_items`, and fills `unit` and `rate` from the old rows;
- adds `pack_sizes` (shop default sizes) to `data_center`;
- adds running bill numbers (`bill_no`) to `seasonal_orders`.

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
  - +/− steppers, discount in ₹ or %;
  - payment by **Cash / UPI / Unpaid**;
  - cash received shows the change to return;
  - a big **Charge ₹X** button.
- **Customers:** walk-in by default. Name and mobile are required only for unpaid bills and pre-bookings. Typing a name or number suggests saved customers. New customers with a valid mobile are saved automatically.
- **Counter bill / Pre-booking** toggle on the same screen. Pre-bookings take a delivery date (defaults to tomorrow), an advance and the advance mode.
- After saving: **Print** (80 mm thermal receipt, also fine on A4), **WhatsApp** (sends the bill text) and **New bill**.
- The bill in progress survives a page refresh. Phones get a sticky bar with the item count, total and "View bill".
- **Bills tab:**
  - today's sales split into cash, UPI and unpaid;
  - Today / Unpaid / All year filters; search by name, mobile or bill #;
  - mark paid (Cash/UPI), print, WhatsApp, edit (loads the bill back into the POS) and delete with confirmation.
- **Pre-bookings tab:**
  - Open / Due by tomorrow / Done / All filters, with overdue highlighting;
  - **Deliver & collect** records the balance received;
  - confirm and cancel;
  - a **kitchen prep list** (total kg of each sweet to make per delivery date, printable).
- **Reports tab:**
  - totals, sales by occasion, unpaid bills;
  - item sales in packs, kg and revenue, combined across old and new item names;
  - PDF downloads: sales, unpaid, item sales.

The phone bottom bar now has a **POS** button.

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

The full audit, with what is fixed and what is still open, is in [docs/AUDIT.md](docs/AUDIT.md).

## Project structure

```
src/
  App.tsx, components/navItems.ts   app shell, one nav config (sidebar + phone bar + drawer)
  components/ui/                    Modal, ConfirmDialog (useConfirm), shared styles
  components/pos/                   ProductGrid, ProductTile, PackPicker, TicketPanel, TicketLines,
                                    CustomerFields, CheckoutFields, SaleDone
  components/sessional/             PosTab, OrdersTab, PreordersTab, PrepList, ReportsTab,
                                    item form, bulk price, merge and pack-size dialogs, MigrationBanner
  hooks/                            Supabase data hooks (TanStack Query)
  lib/units.ts                      units, pack sizes, pack prices, size parsing/labels
  lib/itemCatalog.ts                item normalisation (old + new rows), save payloads, name cleanup
  lib/mergePlan.ts                  duplicate detection and merge plan
  lib/cart.ts, lib/posForm.ts       bill lines, totals, validation, save payloads
  lib/receipt.ts, sessionalReceipts.ts   thermal receipt, print, WhatsApp text
  lib/sessionalReportPdf.ts         sweets report PDFs
  lib/pdf/                          quotation and invoice PDFs
  lib/quoteMath.ts                  shared catering money math
  pages/                            one file per screen
supabase/
  schema.sql                        baseline schema (inferred from the code, for local dev)
  migrations/                       SQL to run on the live database
```

## Tests and checks

```bash
CI=true npx react-scripts test --watchAll=false   # unit tests: pack pricing, merge plan, money, PDFs, nav
npx tsc --noEmit -p .                             # type check
npx eslint src --ext .ts,.tsx                     # lint (the hosted build fails on warnings when CI=true)
```

### Local database (optional)

`supabase/schema.sql` recreates every table, so you can run the app against a local Postgres + PostgREST (e.g. Docker) instead of the live project.

## Translations

The app is English only today and has no translation files. If Hindi or other languages are added later, add English and Hindi first. Other languages need to be translated separately by the owner.
