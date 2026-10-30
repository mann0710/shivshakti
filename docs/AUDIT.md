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
| 15 | `Finance.tsx` | Month labels broke on the 29th–31st; revenue used estimates including cancelled bookings; the event-type list was hard-coded. | **Fixed.** Event types and top customers use invoice / quotation amounts |
| 16 | `DataCenter.tsx` | 0% GST could not be saved. | **Fixed** |
| 17 | `DataCenter.tsx` | The old FSSAI file was deleted before the new upload succeeded. | **Fixed** |
| 18 | `Quotations.tsx` | Days added with "Add Occasion" show as "Day 0" in the totals panel. | **Fixed.** Numbered by date; reopened quotes too |
| 19 | `Quotations.tsx` | A booking end-date update error was ignored and the bookings list went stale. | **Fixed** |
| 20 | `Quotations.tsx` | Clone dropped the food type and failed without a booking. | **Fixed** |
| 21 | `Quotations.tsx` | The quotation PDF day header shows the gross total while rows show offer prices. | **Fixed.** Shared `mealNet`/`dayNet` in both PDFs |
| 22 | `useInvoices.ts` | Recalculation ignored errors; a zero-total invoice became "paid"; a completed booking never reverts. | **Fixed.** Deleting or reducing a payment sets a completed booking back to confirmed |
| 22b | `useInvoices.ts` | Found on the live site: older invoices had an advance with no payment row, so recalculating from payments would drop it | **Fixed.** Advance turned into a payment row before any recalculation; backfill in `20261103_backfill_advances.sql` |
| 22c | `Finance.tsx`, booking lists, calendar, customer card | Found on the live site: amounts used the package estimate, which is ₹0 for bookings priced by quotation, so "Revenue by event type" was empty | **Fixed.** Shared `useBookingValue`: invoice total, else the chosen quotation, else the estimate |
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

## Quote and booking flow (owner feedback, checked on Kavit Mangrolya's event)

| Finding | Status |
|---|---|
| A booking had to exist before a quote could be written | **Fixed.** Quote form creates customer + booking on save ("New event") |
| Guest count lived only on the booking | **Fixed.** Guests are typed in the quote and copied to the booking |
| Quote and booking statuses had to be kept in step by hand | **Fixed.** Share → Sent / Follow-up; Accepted → Confirmed (shared `useQuoteLifecycle`) |
| Per-plate quotes showed ₹0 item prices | **Fixed.** Item prices hidden unless "Price each item" is on |
| No single place to see where an event stands | **Fixed.** Event page with progress bar and next-step button (`EventDetail`, `lib/eventStage`) |

## Sweets reports and pre-bookings (owner feedback, 30–31 Oct 2026)

| Finding | Status |
|---|---|
| Reports were three year-only PDFs; no date range, payment modes, categories, dues or catering | **Fixed.** Eight reports for any period with Print / PDF and CSV (`lib/reports`) |
| Pre-booking register kept on paper (customers × sweets grid) | **Fixed.** Sheet view with Packed / Given tick boxes, quantity totals and a landscape print |
| Pre-booking print was a thermal receipt without address or payment detail | **Fixed.** A4 slip with customer, pickup/delivery, items, advance, hand-over payment, balance, signatures |
| No pickup vs delivery; hand-over overwrote the advance's payment mode | **Fixed** with `20261104_preorder_fulfillment.sql` (app works without it) |
| Quantity could only be changed with +/− (24 packs = 24 taps) | **Fixed.** Typed quantity in the bill and the pack picker |
| Report PDFs used jsPDF fonts, which cannot draw Gujarati names | **Fixed.** Reports, slip and sheet print as HTML, so any script prints |

## Printed documents (owner feedback, 31 Oct 2026)

| Finding | Status |
|---|---|
| Per-plate quotations showed "Rs.0" next to every dish; one dish per row ran to two pages | **Fixed.** Dish prices only when priced per item; two-column course list |
| Same subcategory under two courses ("Hot" starters and "Hot" sweets) looked like one | **Fixed.** Course → sub-group |
| Invoice GSTIN printed over the header rule; invoice number twice; no shop identity or bill-to | **Fixed.** New header and bill-to block |
| "Rs." instead of ₹; Gujarati names could not print (jsPDF fonts) | **Fixed.** HTML templates rendered by Chrome with Noto fonts |
| No venue, address, validity, payment amounts or way to pay on the quotation | **Fixed.** Facts block, valid-till, schedule in rupees, UPI QR |
| Document details hard-coded | **Fixed.** Data Center → Documents |
| Four separate jsPDF builders (quotation, invoice, calendar menu, reports) | **Fixed.** One theme + shared parts in `lib/docs` |
| Menu order on paper: dal/rice shown as separate courses, accompaniments in the middle, chutney away from its farsan | **Fixed.** `lib/menuOrder`: set order, one Main Course, accompaniments last, chutney served with the snack, alternatives inside their course |

## Quotation options and calendar (owner request, 31 Oct 2026)

| Request | Status |
|---|---|
| "Choose any 1 of 5" dishes, with different prices | **Done.** Choice groups on dishes; price range or included; picks recorded on acceptance |
| Several versions of one quote and record which was accepted | **Done.** Options A / B / C as sibling quotations; Mark accepted picks one, others become Not chosen |
| Several quotes on one day: warn, don't block | **Done.** Same-day / venue warning in the form; only confirmed bookings block each other |
| Calendar view of quotes | **Done.** Quotations → Calendar with day panel and "New quote on this day" |
| Typing your own plate price dropped the alternatives' price range; price table showed ₹0 rows and a "Plate price adjustment" line | **Fixed.** Typed price = menu as listed, alternatives move it (`ownRange`); ₹0 rows hidden; own price prints one catering line |
| Printed menu did not match the approved design A: a sub-heading over almost every dish, CSS columns leaving Including alone, choice box styled apart | **Fixed.** `lib/menuOrder` + `courseGrid`: flat course cards in a 2-column grid, farsan its own course, choice = green course card, long course spans both columns |
| "Served with" was free text; a chutney picked there still printed again under Including | **Fixed.** `ServedWithPicker`: pick accompaniment items (several), stored as `served_with` + `served_ids`; printed once, under the dish |
| Deleting a booking with quotations failed with a raw "violates foreign key constraint" error; one with an invoice would silently delete the invoice (live FK is on delete cascade) | **Fixed.** Delete names the quotations and deletes them first after you confirm; bookings with an invoice offer Mark cancelled instead |
| Bookings screen: 9 columns, status shown twice (pill + dropdown), up to 8 unlabeled icons per row, past events mixed in at the top, separate Calendar page | **Fixed.** `lib/bookingBoard` + List / Calendar / Pipeline views: tabs (Upcoming, Needs attention, Past, Cancelled), one next step per booking, ⋯ menu, calendar folded into Bookings |
| Payment schedule showed only percentages while a choice was open; times printed as 11:00:00 | **Fixed.** Range per step (`paySteps` max); `timeText` → 11:00 AM in quotes, invoices and meals |
| Event page offered Create invoice while the quote's farsan was undecided; quote showed "Part paid" | **Fixed.** `pendingChoice` drives the next step and a Pick dishes & accept button; quote pills use `statusText` |
| Sharing a quote / invoice on a phone needed the customer saved as a phone contact | **Fixed.** With a saved number `shareDoc` saves the PDF and opens that chat (`wa.me/91…`), like POS pre-bookings |
| Saving a quotation went back to the list | **Fixed.** Save / Update stays in the editor; Close asks before dropping unsaved changes |
| All-options PDF forced each option onto a new page (half-empty pages); totals could split from the total band | **Fixed.** Options flow on; sums + total band kept together |
| ₹ printed as a box in big amounts (option prices, total band, payment steps) on server PDFs | **Fixed.** Heading stack `HEAD_FONT` falls back to Noto Sans for ₹ (Outfit has no ₹; the server has no system fonts) |
| Downloading Option A gave one PDF with A and B, with payment steps only as percentages; list showed options as separate rows | **Fixed.** Per-option PDF/share (exact amounts) and an "all options" PDF with per-option payment amounts; list has a master row per enquiry with options under it (`lib/quoteGroups`) |
| Choice groups were hard to understand on first use (tick dishes, then Group) | **Fixed.** "+ Alternative" on each dish, "Customer chooses 1 of 2" box with OR, Picked ticks, box sits where the dish was |
| `Quotations.tsx` would pass 500 lines | **Fixed.** Form state moved to `useQuoteForm`; new pieces are separate components |

## Code quality

| Finding | Status |
|---|---|
| Files over 500 lines: `SeasonalBilling.tsx` 1,563, `Quotations.tsx` 1,792, `Billing.tsx` 1,298, `Bookings.tsx` 508 | **Fixed.** Split into components; the largest screens are now about 500 lines |
| Copy-pasted helpers (weight labels, meal savings, currency formatting, style constants, nav defined twice) | **Fixed** for sweets (`lib/units`, `lib/money`, `components/ui/styles`), meal/day totals (`lib/quoteMath`), item prices (`useItemPrices`) and nav (`components/navItems`). Catering style constants are still per-file (cosmetic) |
| No tests | **Fixed** for pricing, merge, money, PDFs and nav (the default CRA test was broken) |
