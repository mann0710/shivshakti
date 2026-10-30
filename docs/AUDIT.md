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
| 5 | `Billing.tsx`, `CalendarPage.tsx` | The newest quotation was used even if draft or rejected. | **Fixed** (accepted first, in Billing and Calendar) |
| 6 | `Quotations.tsx` | Editing a quotation reset its status to draft. | **Fixed** |
| 7 | `Quotations.tsx` | Auto-generated days were one day early in IST. | **Fixed** |
| 8 | `Bookings.tsx` | The end date, time and package could not be cleared. | **Fixed** |
| 9 | `useBookings.ts` | A blank venue counted as a clash. Multi-day overlap is not checked. | **Fixed.** Overlapping date ranges at the same venue are blocked, on create and on date/venue edits |
| 10 | `Bookings.tsx` | A failed booking save created a duplicate customer on retry. | **Fixed** |
| 11 | `index.tsx` | Any later error replaced the whole app with a stack dump; two mutations had no error handling. | **Fixed** |
| 12 | `Billing.tsx` | Negative or zero payments were possible, and Save Payment could be double-tapped. | **Fixed.** Editing a payment is capped at its own amount plus the balance due |
| 13 | `Dashboard.tsx` | Today's events were missing from Upcoming. | **Fixed** |
| 14 | `Customers.tsx` | "Last event" showed the oldest event; "Total spend" included cancelled bookings. | **Fixed.** Shows the next upcoming event (else the last one); cancelled bookings excluded |
| 15 | `Finance.tsx` | Month labels broke on the 29th–31st; revenue used estimates including cancelled bookings; the event-type list was hard-coded. | **Fixed** (still based on booking estimates for event types and top customers) |
| 16 | `DataCenter.tsx` | 0% GST could not be saved. | **Fixed** |
| 17 | `DataCenter.tsx` | The old FSSAI file was deleted before the new upload succeeded. | **Fixed** |
| 18 | `Quotations.tsx` | Days added with "Add Occasion" show as "Day 0" in the totals panel. | **Fixed.** Numbered by date; reopened quotes too |
| 19 | `Quotations.tsx` | A booking end-date update error was ignored and the bookings list went stale. | **Fixed** |
| 20 | `Quotations.tsx` | Clone dropped the food type and failed without a booking. | **Fixed** |
| 21 | `Quotations.tsx` | The quotation PDF day header shows the gross total while rows show offer prices. | **Fixed.** Shared `mealNet`/`dayNet` in both PDFs |
| 22 | `useInvoices.ts` | Recalculation ignored errors; a zero-total invoice became "paid"; a completed booking never reverts. | **Fixed.** Deleting or reducing a payment sets a completed booking back to confirmed |
| 22b | `useInvoices.ts` | Found on the live site: older invoices had an advance with no payment row, so recalculating from payments would drop it | **Fixed.** Advance turned into a payment row before any recalculation; backfill in `20261103_backfill_advances.sql` |
| 23 | list hooks | Supabase returns at most 1,000 rows; customers, bookings, quotations, invoices and payments are not paged. | **Fixed.** Shared `lib/fetchAll` pages every list |
| 24 | `Billing.tsx` | Invoice WhatsApp links had no country code. | **Fixed** |
| 25 | `useQuotations.ts`, `useInvoices.ts` | Quotation and invoice numbers are computed in the browser, so two devices can clash. | **Fixed.** A database trigger assigns INV-/QTN- numbers under a lock (`20261102_doc_numbers.sql`) |

## App-wide UX pass (second round, after owner feedback)

| Finding | Status |
|---|---|
| Forms rendered below long lists (Bookings new/edit, Packages edit, Customers), so the buttons looked dead | **Fixed.** Dialogs (bottom sheets on phones) |
| `window.confirm` was used for deletes (bookings, customers, invoices, quotations, menu categories, occasions, sweets customers, FSSAI). Many phone WebViews block it silently, so "nothing happens" | **Fixed.** In-app confirmation everywhere; also added for item, payment, team-member and event-type deletes that had none |
| Booking confirmation auto-opened Google Calendar after a network call (blocked as a popup) | **Fixed.** Explicit button |
| Quotations could not be sent on WhatsApp | **Fixed.** PDF share (phone share sheet; desktop download + WhatsApp) |
| Phone Back button left the app (no URL routing) | **Fixed.** Hash routes per screen |
| Tables cut off actions on phones (bookings, quotations, invoices, sweets customers, occasions, items) | **Fixed.** Card layouts on phones |
| Menu Builder forced three columns on phones | **Fixed** |
| Dashboard stacked eight full-width stat cards on phones | **Fixed.** Two per row |
| Dashboard "+ New Booking" and quick actions only switched screens | **Fixed.** They open the form |
| Deactivated packages could never be reactivated | **Fixed** |
| No search on quotations and invoices | **Fixed** |
| Every quotation item started at ₹0 | **Improved.** The last used price is pre-filled (catalog items still have no stored default price) |

## Third round

| Finding | Status |
|---|---|
| Opening a saved quotation (or pressing any invoice "Apply") recalculated GST at today's Data Center rate, e.g. a 5% quote became 18% | **Fixed.** Quotes and invoices keep the rate they were issued at |
| Accepting a quote left the booking unconfirmed and invoicing as separate manual steps | **Fixed.** Accepting offers "Confirm booking", then a "Create invoice" shortcut; confirmed bookings have an Invoice button |
| "+ New booking" from a customer didn't fill in the customer | **Fixed** |
| Menu Builder items had no stored price, so quotes started at ₹0 for new items | **Fixed.** `menu_items.default_price`, editable inline; quotations fill it, falling back to the last quoted price |
| Invoice not GST-complete (no CGST/SGST split, SAC code or customer GSTIN) | **Fixed.** Tax Invoice title, SAC 996334, customer GSTIN, CGST/SGST (IGST for other-state GSTIN), amount in words |

## Security (Supabase Security Advisor: 22 errors, 1 warning)

| Finding | Status |
|---|---|
| RLS disabled on all 17 public tables; anyone with the public anon key could read, change or delete all data | **Fixed** by `20261031_security_rls.sql`: RLS on every table, staff-only policy (`public.is_staff()` checks the signed-in email against `public.staff`) |
| "Policy Exists RLS Disabled": `allow_all` policies (true/true for everyone) on bookings, customers, invoices, menus, payments | **Fixed** (dropped) |
| Storage bucket `documents` allowed public list/upload/update/delete | **Fixed.** Only staff can manage files; direct links still work |
| No login in the app | **Fixed.** Email + password sign-in, sign-out, "access not set up" screen for non-staff |
| Public sign-ups are on in Supabase Auth | **Owner action:** turn off "Allow new users to sign up" (new sign-ups get no data access anyway) |

## Catering — UX and missing basics

| Finding | Status |
|---|---|
| Two unrelated menu systems (Packages and Menu Builder) | **Fixed.** Package lines can be picked from Menu Builder; a quotation can "Start from package" (items matched by name with their prices, package price as per-plate rate; the booking's package is preselected) |
| Invoice status "sent" meant partly paid | **Fixed.** Shown as Unpaid / Part paid / Paid (also in the CSV export) |
| Single-day invoices couldn't take the final guest count; four separate "Apply" buttons | **Fixed.** Final guest count field; one sticky "Save changes" bar with Discard, and a prompt before switching invoices with unsaved edits |
| Missing confirmations on deletes; packages couldn't be re-activated | **Fixed.** All deletes use the in-app confirm; packages have Reactivate |
| No search on Quotations and Invoices; quotations not shareable on WhatsApp | **Fixed** |
| Business details hard-coded in PDFs | **Improved.** Centralised in `lib/shop.ts` (name, phone, email, SAC) |
| No URL routing, phone Back left the app | **Fixed.** Hash routes per screen |

## Code quality

| Finding | Status |
|---|---|
| Files over 500 lines: `SeasonalBilling.tsx` 1,563, `Quotations.tsx` 1,792, `Billing.tsx` 1,298, `Bookings.tsx` 508 | **Fixed.** Split into components; the largest screens are now about 500 lines |
| Copy-pasted helpers (weight labels, meal savings, currency formatting, style constants, nav defined twice) | **Fixed** for sweets (`lib/units`, `lib/money`, `components/ui/styles`), meal/day totals (`lib/quoteMath`), item prices (`useItemPrices`) and nav (`components/navItems`). Catering style constants are still per-file (cosmetic) |
| No tests | **Fixed** for pricing, merge, money, PDFs and nav (the default CRA test was broken) |
