# App audit — October 2026

Scope: the whole app (catering and sweets). Each finding is marked **Fixed** or **Open**. Line references are to the code before this release.

## Sweets (Sessional)

| # | Finding | Status |
|---|---|---|
| S1 | Items were stored one row per pack size ("Kaju Katli 250 gm", "… 500 gm", "… 1 kg"). That duplicated the catalog, split reports and made price changes error-prone. | **Fixed.** One item with a per-kg / per-litre / per-piece rate; packs are calculated (shop defaults 250/500/750/1000 g plus custom sizes, manual pack prices). The merge tool folds old rows, keeps exact prices and re-links old bills. New duplicates are blocked in the item form. |
| S2 | Litre items printed "250 ltr" / "500 ltr" (the values were really ml). | **Fixed.** Shown as 250 ml / 1 ltr. |
| S3 | `SeasonalBilling.tsx` was 1,563 lines with four copies of the same form logic. | **Fixed.** Split into a POS screen plus Bills, Pre-bookings and Reports tabs; shared cart/form logic in `lib/`. |
| S4 | Bills and pre-bookings were deleted without confirmation. | **Fixed.** Confirmation dialog. |
| S5 | "Mark paid" used `window.prompt` and required typing "cash" or "upi". | **Fixed.** Cash / UPI buttons. |
| S6 | A customer name was required even for walk-in counter sales. | **Fixed.** Walk-in by default; name and mobile required only for unpaid bills and pre-bookings. |
| S7 | No phone validation; WhatsApp numbers were not cleaned. | **Fixed.** 10-digit Indian mobile check; WhatsApp links use 91. |
| S8 | Picking an occasion hid all-year items. | **Fixed.** Items with no occasion always show. |
| S9 | The item sales summary grouped by row id (split across duplicates) and counted cancelled pre-orders. | **Fixed.** Grouped by clean item name and unit; cancelled pre-orders excluded; revenue added. |
| S10 | The bill in progress was lost on refresh or when switching tabs. | **Fixed.** Draft kept in the browser. |
| S11 | No printed receipt; WhatsApp text was built in two places. | **Fixed.** 80 mm thermal receipt and one shared WhatsApp builder. |
| S12 | Discount could be more than the subtotal or above 100%. | **Fixed.** Capped. |
| S13 | No bill numbers. | **Fixed.** Running `bill_no` (after the migration). |
| S14 | No search, categories or bulk price update for items. | **Fixed.** |
| S15 | No view of what is due tomorrow or how much to make. | **Fixed.** Due-by-tomorrow filter, overdue highlighting, kitchen prep list. |
| S16 | Delivering a pre-booking hid the balance-collection step. | **Fixed.** "Deliver & collect" dialog. |
| S17 | No database schema in the repo. | **Fixed.** `supabase/schema.sql` (inferred baseline) plus a migration. |

## Catering — bugs

| # | Where | Finding | Status |
|---|---|---|---|
| 1 | `useInvoices.ts` | Invoice total left out the quotation's extra charges, so it was under-billed. | **Fixed** |
| 2 | `Billing.tsx`, `useInvoices.ts` | "Advance already paid" had no payment row, so the next payment overwrote it. | **Fixed.** Saved as a payment. |
| 3 | `Billing.tsx` | Multi-day guest-count changes used the old counts for offer savings. | **Fixed** |
| 4 | `Billing.tsx` | The quotation's manual discounts were not copied to the invoice. | **Fixed** |
| 5 | `Billing.tsx`, `CalendarPage.tsx` | The newest quotation was used even if draft or rejected. | **Fixed in Billing** (accepted first). Calendar still uses the newest: **Open** |
| 6 | `Quotations.tsx` | Editing a quotation reset its status to draft. | **Fixed** |
| 7 | `Quotations.tsx` | Auto-generated days were one day early in IST. | **Fixed** |
| 8 | `Bookings.tsx` | The end date, time and package could not be cleared. | **Fixed** |
| 9 | `useBookings.ts` | A blank venue counted as a clash. Multi-day overlap is not checked. | **Fixed** (blank venue). Overlap: **Open** |
| 10 | `Bookings.tsx` | A failed booking save created a duplicate customer on retry. | **Fixed** |
| 11 | `index.tsx` | Any later error replaced the whole app with a stack dump; two mutations had no error handling. | **Fixed** |
| 12 | `Billing.tsx` | Negative or zero payments were possible, and Save Payment could be double-tapped. | **Fixed.** Editing a payment still has no balance check: **Open** |
| 13 | `Dashboard.tsx` | Today's events were missing from Upcoming. | **Fixed** |
| 14 | `Customers.tsx` | "Last event" showed the oldest event; "Total spend" included cancelled bookings. | **Open** |
| 15 | `Finance.tsx` | Month labels broke on the 29th–31st; revenue used estimates including cancelled bookings; the event-type list was hard-coded. | **Open** |
| 16 | `DataCenter.tsx` | 0% GST could not be saved. | **Fixed** |
| 17 | `DataCenter.tsx` | The old FSSAI file was deleted before the new upload succeeded. | **Fixed** |
| 18 | `Quotations.tsx` | Days added with "Add Occasion" show as "Day 0" in the totals panel. | **Open** |
| 19 | `Quotations.tsx` | A booking end-date update error was ignored and the bookings list went stale. | **Fixed** |
| 20 | `Quotations.tsx` | Clone dropped the food type and failed without a booking. | **Fixed** |
| 21 | `Quotations.tsx` | The quotation PDF day header shows the gross total while rows show offer prices. | **Open** |
| 22 | `useInvoices.ts` | Recalculation ignored errors; a zero-total invoice became "paid"; a completed booking never reverts. | **Fixed** (errors; zero-total). Revert: **Open** |
| 23 | list hooks | Supabase returns at most 1,000 rows; customers, bookings, quotations, invoices and payments are not paged. | **Open** |
| 24 | `Billing.tsx` | Invoice WhatsApp links had no country code. | **Fixed** |
| 25 | `useQuotations.ts`, `useInvoices.ts` | Quotation and invoice numbers are computed in the browser, so two devices can clash. | **Open** (sweets bills now use a database sequence) |

## Catering — UX and missing basics (open)

- Two unrelated menu systems (Packages and Menu Builder); catalog items have no default price.
- Accepting a quote doesn't confirm the booking or create the invoice. Invoice status "sent" means partly paid.
- Single-day invoices can't take the final guest count. The Billing preview has four separate "Apply" buttons.
- Missing confirmations on some deletes (payments, quotation days and meals, event types, team members). Packages can't be re-activated.
- No search on the Quotations and Invoices lists. Quotations can't be shared on WhatsApp.
- Business name, address and terms are hard-coded in the PDFs (now centralised for receipts in `lib/shop.ts`).
- The invoice is not GST-complete (no CGST/SGST split, SAC code or customer GSTIN).
- **No login.** The app uses only the public anon key, so data is protected only by Supabase row-level security, whose setup is unknown. Supabase Auth + RLS is recommended before wider use.
- No URL routing, so the phone Back button leaves the app.

## Code quality

| Finding | Status |
|---|---|
| Files over 500 lines: `SeasonalBilling.tsx` 1,563, `Quotations.tsx` 1,792, `Billing.tsx` 1,298, `Bookings.tsx` 508 | SeasonalBilling **fixed** (split). Quotation and invoice PDFs moved to `lib/pdf/`, so Quotations is now about 1,280 lines and Billing about 890: still **Open** (split into list / form / totals components) |
| Copy-pasted helpers (weight labels, meal savings, currency formatting, style constants, nav defined twice) | **Fixed** for sweets (`lib/units`, `lib/money`, `components/ui/styles`), meal savings (`lib/quoteMath`) and nav (`components/navItems`). Catering style constants: **Open** |
| No tests | **Fixed** for pricing, merge, money, PDFs and nav (the default CRA test was broken) |
