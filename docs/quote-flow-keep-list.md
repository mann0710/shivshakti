# Quote → booking → invoice: keep-list (Nov 2026 tidy-up)

Every feature that existed before the tidy-up, where it lives after it, and how it is checked.
"Same" = untouched. Tests are in `src/**/*.test.ts(x)`; "PDF diff" = all 20 live quotes and the invoice rendered before and after.

## Quote editor

| Feature today | After | Check |
|---|---|---|
| Autosave, "All changes saved", Try again, leave-with-unsaved prompt | Same | editor.test |
| Option tabs, + Add option (copy), name an option, Compare | Same | editor.test |
| Event: customer, event type list, venue, food style, same-day warning, link to booking | Same | browser, local data |
| Event date, time, guests (one-meal) | On the meal card (one-meal card shows Date, Time, Guests) | editor.test |
| "Several days?" link and "One meal / Several meals or days" switch | "+ Add a meal" / "+ Add a day" under the one-meal card (keeps its dishes and price as Day 1's first meal); "Make it a one-meal quote" under More when one meal is left | editor.test, QuotationMultiDay.test |
| Booking spanning days starts with one day per date | Same | — |
| Start from a package (add/replace), Copy from another quote (add/replace) | Same on one-meal quotes, and now on every meal; copy also offers each meal of several-meal quotes | editor.test, QuotationMultiDay.test |
| Package price follows guest count, "Use ₹X" hint | Same, inside the price block | editor.test |
| Save menu as package (⋯) | Same | — |
| Dishes: add by name, drag, rename course/section/choice, new course, dish popover (price, note, served with, offer another instead, always serve, remove) | Same | — |
| Choice dialog: dishes offered, how many they pick, price follows the dish / same for all | Same; "Same for all" is now called "Included in the plate" | browser, local data |
| Plate price from dish prices / My own price (one-meal radio) | Price block: Menu value (dish total), Your price (empty = menu value), "Use ₹X" | mealPrice.test, editor.test |
| A plate (each meal) | Price block "Your price" on each meal | QuotationMultiDay.test |
| Cleared price goes back to the dish total | Same | QuotationMultiDay.test |
| "One price for any pick" / "The pick changes the price" (one-meal), "Same price whatever they choose" (each meal) | Price block: "Price follows the pick" / "One price for any pick" (editable) on both | mealPrice.test |
| "Use one price on all meals" box with Undo | Same | mealPrice.test (oneEveryMeal) |
| "Before discount" / "Price before discount", Discount on the PDF tick, swap when typed lower | Plate discount = menu value − your price, with "Show the discount on the PDF"; a list price instead of the dish total under More (warns) | mealPrice.test, docs.test |
| Older "Offer price a plate" on six quotes (lowers the total) | Same, under More, only where already set | docs.test |
| Dish prices on the PDF (quote-wide device setting, each meal) | Same ticks; "On the PDF" lists which meals differ | docs.test |
| Transport, Discount rows (amount or %), extras (Service staff, Counter, Decoration, Other), GST | Same; GST button never says 0% | browser, local data |
| Payment plan from Settings | Same | — |
| Note for the customer | Same, in On the PDF | — |
| What the customer sees, Ready to send? | Same, meals grouped by day, plate discount and "You save"; "Final once X picks" only when the pick changes the price | quoteSummary.test |
| Send… (PDF, all options, message, mark as sent), Preview PDF | Same; plus "Mark as sent" for PDFs shared by hand | — |

## Quotations list and side panel

| Feature today | After | Check |
|---|---|---|
| To do / Accepted / Declined & expired / All, search, row Send, ⋯ menu (mark sent, lost, reopen, clone, delete, save as package) | Same | quotes.test, quoteBoard.test |
| Tidy banner "Fix all" | Same | — |
| Side panel: lines, Send, WhatsApp, PDF, Edit, history, "Accept with this ___" | Send… and Edit (WhatsApp and Download PDF inside Send); history adds revisions; "Confirm with this ___" | browser |

## Confirming

| Feature today | After | Check |
|---|---|---|
| Accept dialog: option, picks per meal, final guests (one-meal, live price), advance, receipt | "Confirm booking" dialog with the same steps; advance is a choice with nothing pre-filled (Already received / New payment / No advance yet); receipt off until ticked | quotes.test (Confirm booking) |
| Change status → Confirmed with advance, "Confirm without advance" | Same advance choice ("No advance yet" = without advance) when the booking has no quote; with a quote it opens Confirm booking | browser, local data (Amit Shah) |
| Other options become Not chosen; booking gets final guests | Same | — |
| Accepted quote editable any time | Locked; "Change the accepted quote…" keeps the accepted version as a revision, then edits; "Done changing…" keeps (revision 2) or undoes all | editor.test, quoteRevisions.test, browser (QTN-0009) |

## Bookings and event panel

| Feature today | After | Check |
|---|---|---|
| List, Calendar, Pipeline, tabs, Needs attention, 5 past events banner, next-step buttons, ⋯ menu (edit, status, record payment, cancel, delete, close as lost, mark completed) | Same | — |
| Event panel: stage, next step, quotes (Edit/Send/Accept), menu + Kitchen PDF, invoice, money, payments | Same; a Confirmed booking without an accepted quote says so and offers Confirm booking; money taken before confirming shows as "advance held" | bookingBoard.test, bookingDialogs.test, browser |
| Cancel: give back or keep | Give back all or part (rest kept), keep, or move to a new date; Undo after | browser (Sama Ben, local) |

## Invoices

| Feature today | After | Check |
|---|---|---|
| Waiting for money, Ready to invoice, Past events with no invoice, Mark all settled outside, Invoice or settle | Same; Ready to invoice needs an accepted quote (others say "Confirm the quote first") | quoteSummary.test (quoteNotConfirmed), browser |
| New invoice: event, final guests, advance already received | Same | — |
| Invoice editor: guests and rate per meal, extras, transport, discount (amount or %), GST, payments, Send (4 choices), Delete | Same; each meal shows the confirmed guest count; a one-meal invoice keeps the plate price it was made with (old ones still read the quote) | invoiceEdit.test, browser (INV-0001, new INV-0002), PDF diff |

## Added later the same day

| Feature | Where | Check |
|---|---|---|
| Confirm in one database step, payment id fixed per dialog | `confirm_booking` function, `useConfirmBooking` | browser (Sama Ben), SQL retry test |
| Done stage for past confirmed events without an invoice | Pipeline, chips, stage rows; Mark completed stays in ⋯ → Change status | bookingBoard.test |
| Quoted → invoice lines | Invoice summary | invoiceEdit.test |
