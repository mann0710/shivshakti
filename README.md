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
4. Open the app and sign in. To add staff later use **Settings → Team & access → Invite** (after `20261110_team_bin_tiers.sql`, see below).

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

Run [`supabase/migrations/20261104_preorder_fulfillment.sql`](supabase/migrations/20261104_preorder_fulfillment.sql) (adds `fulfillment`, `delivered_at`, `balance_paid`, `balance_mode` to `seasonal_preorders`; safe to re-run). Until it is run, the app skips these fields: pickup/delivery is guessed from the address, and the hand-over payment mode overwrites the advance mode as before. Applied on the live project on 31 Oct 2026.

### Document settings

Run [`supabase/migrations/20261105_doc_settings.sql`](supabase/migrations/20261105_doc_settings.sql) (adds `data_center.doc_settings`; safe to re-run). Until it is run, Data Center → Documents shows a notice and every document uses the defaults. Applied on the live project on 31 Oct 2026.

### Quotation options and price ranges

Run [`supabase/migrations/20261106_quote_options.sql`](supabase/migrations/20261106_quote_options.sql) (adds `option_group`, `option_label`, `option_name`, `per_plate_max`, `total_max` to `quotations`; safe to re-run). Until it is run, "+ Add option" stays hidden and price ranges are not stored (choice groups still work, inside the dishes). Applied on the live project on 31 Oct 2026, after copying `seasonal_preorders`, `data_center` and `quotations` into the `backup_20261031` schema (not exposed to the API, RLS on; drop it once you are happy).

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
- On computers and tablets the POS fills the screen: the item grid and the bill run to the bottom and only their lists scroll.
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
  - **straight to the saved number**, like POS pre-bookings: when the customer has a phone number, the PDF is saved and WhatsApp opens **that customer's chat** with the message ready — no need to save the number in your phone. WhatsApp links cannot carry a file, so tap 📎 → **Document** and pick the saved PDF. If the phone blocks the chat from opening, tap **PDF saved — open WhatsApp chat**;
  - with no number saved, a phone uses the share sheet (pick WhatsApp and the contact) and a computer downloads the PDF and opens WhatsApp.
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
- **Packages** can be reactivated ("Show inactive"). The calendar (now inside Bookings) has a "+ New booking on this day" shortcut.
- **Quote → booking → invoice:** marking a quotation Accepted offers to confirm its booking, then shows "Create invoice →". Confirmed bookings also have an **Invoice** button that opens the invoice form with that booking selected.
- **GST stays as issued:** editing an old quotation or invoice keeps the GST rate it was issued at, even if the Data Center rate has changed since.
- **Long lists are complete:** customers, bookings, quotations, invoices, payments and sweets load page by page, so nothing silently drops after 1,000 rows.
- **Google Calendar:** the "add to Google Calendar" step is a button you tap. It used to be an automatic popup that phones blocked.

## One look across the app (redesign, Nov 2026)

Design: the "Shiv Shakti — Master Design" canvas (its first board maps every screen, popup and printout to its design).

- **Sidebar:** Home, Customers, Bookings, Quotations, Invoices, Money · *Catering:* Menu Builder, Packages · *Sweets:* Sweets today, Sweets POS, Sweet items · Settings. Occasions and sweets customers are tabs on **Sweet items**. Old names: Dashboard → Home, Billing → Invoices, Finance & Analytics → Money, Sessional Dashboard → Sweets today, Sessional Items → Sweet items, Data Center → Settings.
- **Phone bar:** Home · POS · Bookings · Quotes · More. **More** is a sheet with every page, grouped like the sidebar, and Sign out.
- **Buttons:** main buttons use a deeper orange (`--primary` in `index.css`) so white text is readable; the bright brand orange stays for picks and borders.
- **Popups:** Esc closes only the top popup; focus stays inside and returns to where you were; the page behind doesn't scroll. A form with typed changes asks "Throw away what you typed?" before closing. `Modal` also has a side-panel variant (`variant="panel"`). Confirms that delete say **Keep** instead of Cancel.
- **Toasts:** one place, bottom centre, above the phone bar, 6 seconds.
- **Home → Needs you:** money to collect, sweets pre-bookings with no advance, quotes waiting for a reply or still drafts, unpaid sweets bills, and past events with no invoice, most urgent first, each with one button (`lib/cateringTodo.ts`).
- **Quotations → tidy-up:** quotes that don't match their booking are listed in a banner and **Fix all** sets them: confirmed or done → accepted, cancelled or passed with no answer → not chosen. A quote still waiting for the customer's pick is left alone (`lib/quoteSync.ts`).
- **Invoices:** *Ready to invoice* (confirmed events with a quote) and *Past events with no invoice* (with the quoted total) sit above the list.
- **Money:** invoices of cancelled bookings no longer count; the average is per invoiced event.
- **Settings → GST on bills:** Not GST-registered (bill of supply), 5% or 18%. An old 12% setting is flagged.
- **Accept with advance:** the Accept dialog records an advance taken there and then (amount + cash/UPI/bank). It's saved on the booking and fills in on the invoice when it is made.
- **Occasion dates:** occasions get a first and last day; bills and pre-bookings inside the dates count for that season, and Sweets today counts down to the festival.

### Screens rebuilt to the master design

- **Home:** "Needs you" first (two actions per row, Later, See all), then To collect, Received, Next 30 days and Quotes tiles, Next events and Sweets this week. Phone: the same with a **+ New** sheet.
- **Quotations:** follow-ups first (Waiting for the customer, Drafts to send), tabs To do / Accepted / Declined & expired / All, a side panel for the selected quote. A quote with options is one row with lettered option lines under it. The editor **saves as you type** (a new quote is created on the first change), has option tabs plus **Compare**, a sticky summary with "Ready to send?", and a **Send** dialog (WhatsApp on a computer with the PDF saved to attach; the share sheet on a phone). The old quote calendar view is gone: Bookings → Calendar shows every event.
- **Invoices:** Waiting for money, Ready to invoice, Past events with no invoice (with **Mark all as settled outside**). The invoice editor saves as you type; **Record payment** is the main action.
- **Money:** period picker, received / to collect / booked / past-no-invoice tiles, who owes by age, coming in, received each month (catering vs sweets), payments received, **Add a spend** and **Paste from Excel** (`spends` table), and **Download for CA** (one Excel file with a sheet per part).
- **Customers:** one list for catering and sweets (matched by phone), filters All / Catering / Sweets / Owes money, a "saved twice" banner with **Combine** (gives the copies one name, with Undo), history across both, and one customer form that warns when the phone number already exists.
- **Bookings:** a shorter booking form (customer picker, event chips, food style, notes; status is set later), the event page as a side panel (stages, next step, quotes, invoice, payments, advance), and a grouped ⋯ menu with arrow keys. A booking whose quote is only a draft is still an Inquiry ("Send quote"); one confirmed while its sent quote waits for the customer's pick stays Quoted. Food style is saved in `bookings.food_type`.
- **Sweets today:** season strip from the occasion dates, today's tiles (cancelled bills never count), pre-bookings due with Hand over, What to make by day, This season so far, and Reports links that open the POS tab.
- **Sweet items / Occasions:** kg price with box sizes, season filters; occasions show their dates and counts and are edited in a small dialog.
- **Settings:** eight groups with their status and search; each change saves by itself with Undo (see *Settings, team and data* below).
- **Counter on a computer:** the POS takes the whole screen; **‹ Back** returns to the app.

### Sweets POS (redesign)

- **Counter:** "Bill / Pre-booking" toggle; every box size is a one-tap button; **Loose (weight or ₹)** on each sweet; the tile order stays put during the day; 48 px − / + and real buttons for Discount, Note and Clear bill (Clear has an Undo toast instead of a confirm).
- **Paying:** Cash (quick "cash handed over" amounts and change to give back), UPI (amount + QR from the UPI ID in Settings, then **Received**), **Cash + UPI** (type the cash, UPI fills in the rest) or Unpaid (needs name and phone; warns if the customer already owes).
- **Hold:** park a bill and serve the next customer; **Held bills** brings it back.
- **Bills:** Collect takes part payments (cash or UPI); what's short stays due. **Remind** on WhatsApp. ⋯ More → Take back items or **Cancel bill** with a reason (the number stays, marked cancelled). Only test bills can be deleted.
- **Pre-bookings:** Booked → Packed → Handed over. Hand-over collects what's paid; a shortfall stays as a due under Bills → Unpaid.
- **Day close:** opening cash + cash from bills, advances, hand-overs and old dues − cash taken out = should be in the drawer; count the notes, see the difference, keep cash for tomorrow, then close and print an 80 mm summary. Reopen if needed.
- **Phone:** a Back control leaves the POS; short tab names; every button is at least 44 px.

### Database updates for this release

Run in the Supabase SQL editor, in order (both are additive and safe to re-run):

1. `supabase/migrations/20261107_pos_payments_dayclose.sql` — payment lists, paid amount and time, cancelled bills, pre-booking payments, and the `seasonal_day_closes` table (staff-only).
2. `supabase/migrations/20261108_advance_occasion_dates.sql` — booking food style, advance on bookings, and occasion dates.
3. `supabase/migrations/20261109_spends.sql` — the `spends` table for Money → Add a spend (staff-only).

Until they run, the app hides Cancel bill and Day close and saves bills without the new fields.

### Layout and button fixes (audit, Nov 2026)

- **One page width:** every page uses `--page-max` (1440px, `index.css`) and the same gutters (16px on phones); Bookings now has the same header as the other pages. Only the POS is full-screen.
- **Readable text:** nothing is smaller than 12px, and faint grey text (`MUTED`, tab labels, table heads) is darker.
- **Links into the POS** (`lib/posIntent.ts`): `posLink.preorder()` opens the counter in Pre-booking mode, `posLink.bill(who)` starts a bill for a customer (an open bill for someone else is held first), `posLink.bills(who)` / `posLink.preorders(id, who)` open those lists filtered to the person, `posLink.report(id)` opens one report. **‹ Back** returns to the screen you came from.
- **Sweets:** "+ Pre-booking" (also on phones) opens a pre-booking; each Reports link on Sweets today opens its own report; "Ask for advance" asks for an advance, not the full amount; after a pre-booking the button says **New pre-booking**; Bills and Pre-bookings keep their filter and search after an edit; Pack sizes and Change season work on phones; a new occasion starts switched off; a category chip resets to All when the occasion changes.
- **Phone bar:** **More** lights up on pages that aren't in the bar.
- **Bookings & quotes:** an unsent draft shows **Send quote** (opens the Send dialog), never "Pick & accept"; **Mark accepted** takes the sent quote, not a newer draft; **+ New quote** always starts a new one; Mark sent / lost / Reopen / Delete on a quote with options act on every option; **Reopen** is hidden once the event date has passed and brings a cancelled booking back to follow-up; Send everywhere follows the "Show each dish's price" setting (`useQuotePdfPref`); phones get the quote ⋯ menu and "See the N" on the tidy banner.
- **Home, Money, Invoices, Customers:** Pick & accept opens the Accept dialog; a draft's **Send on WhatsApp** sends it and **Open** opens the quote; the tidy row is split into invoices and quotes; "Received in <month>" opens Money on This month; Invoices leaves out cancelled bookings like Home and Money; **+ Record payment** hides when nothing is due; an invoice opened from a booking goes back to it; **Download for CA** works on phones; **+ Sweets bill** and a customer's sweets history open the POS for that person; a customer with bookings gets an explanation instead of a Delete that always fails.

## Settings, team and data (Nov 2026)

Everything that said "Coming soon" in Settings now works. Database update: [`supabase/migrations/20261110_team_bin_tiers.sql`](supabase/migrations/20261110_team_bin_tiers.sql) (additive, safe to re-run; take a schema copy first like `backup_20261110`). Until it runs, Team & access, the recycle bin, dish food styles and package price tiers stay hidden and Settings › Data lists it under *Database updates*.

- **Business:** the names on catering documents and on sweets bills, the FSSAI licence number (14 digits) and the logo are editable. The names and the FSSAI number print in every document header and on the 80 mm counter bill; an uploaded logo (PNG/JPG/WebP, up to 2 MB, saved in the `documents` bucket under `logo/`) replaces `/logo.png` on documents and in the sidebar, and **Use the original** goes back. The FSSAI certificate dialog also edits the number.
- **Money & tax:** *GST on catering* (not registered / 5% / 18%) and a separate *GST on sweets*. Sweets prices include GST: a registered shop's counter bill shows the taxable value and the GST inside the total, and **Download for CA** splits sweets sales the same way. The UPI ID is the one used for the counter QR, bills, quotes and invoices.
- **Reminders on Home:** payment due (N days before the event), quote with no reply (after N days), pre-booking pickup (N days before, new "to hand over" row with a WhatsApp reminder that includes the balance) and unpaid sweets bill (after N days). Each can be switched off; Home's *Needs you* follows them (`lib/cateringTodo.ts`).
- **Team & access:** people who sign in, each with a role: **Owner** (everything), **Counter** (Sweets today, POS, Sweet items, occasions and sweets customers; never Money or Settings) or **Kitchen only** (Bookings and the sweets make list). **Invite** saves them on the staff list and emails a one-tap sign-in link (Supabase must allow new sign-ups for this; otherwise add the user in Supabase → Authentication and they use "Forgot password?"). The link signs them in and asks them to set a password; **Your password** changes it later. *Can sign in* off locks a person out at once. The database lets only owners change the team or the settings (`data_center`), and never lets the last owner be removed or downgraded. Screens are filtered per role in the app (`components/navItems.ts`).
- **Data:** **Import from Excel** (dishes, sweets, customers, with a preview of every change), **Download everything** (one `.xlsx`, a sheet per list, with customer and dish names next to their ids), **Backup copy** (a JSON file in the same shape as `backups/`; flagged when older than a week) and the **Recycle bin**.
- **Recycle bin:** deleting a customer, sweets customer, booking, quotation, package, menu category, subcategory, dish, sweet or pre-booking keeps a copy for 30 days (`deleted_items`, filled by a database trigger, so every delete path is covered). **Restore** brings back the row with the parents it needs (a dish's subcategory and category, a quote's booking) and whatever was deleted along with it (a category's dishes, a booking's quotes). Excel imports and sheet edits keep an undo copy for 7 days. **Delete now** and **Empty bin** remove copies for good.
- **Excel files** are read and written by `lib/xlsx.ts` (small, built on `fflate`); CSV is accepted for imports.

### Menu Builder: edit many dishes at once

- **Edit as sheet** (View / Edit as sheet on a subcategory): type straight into Dish name, Price / plate, Food style and On quotes cells; Tab moves right, Enter moves down, arrows move, and Ctrl+V pastes a column (or a block) from Excel. Changed cells turn yellow with what they were. Select rows for **Set price…**, **Change by %…**, **Move to…**, **Food style…** and **Hide / Show on quotes**. Nothing saves until **Review & save**, which lists every change; the save keeps an undo copy for 7 days in the recycle bin. Leaving the sheet, switching subcategory or changing page with unsaved cells asks first.
- **Food styles** on dishes (Jain, Swaminarayan, Has onion / garlic) show as chips under each dish (`menu_items.food_styles`).
- **Paste a list** (next to *Add* under a subcategory's dishes): paste dish names from WhatsApp or Excel, one per line with the price at the end if known ("Raj Kachori 60", "Dahi Puri - 50", "₹ 60/-"). Each line shows New, Update price or Same before **Add 5 · update 1**.
- **Import from Excel** (Menu Builder header, or Settings › Data for dishes, sweets or customers): **Download current** or an **Empty template**, fill it in, upload (.xlsx or .csv). Columns are matched loosely. Tiles count new, changed, moved and same-as-today rows; questions are asked once per kind ("₹ 60/-" → use 60 for all ten rows, an unknown subcategory → the closest one or create it, a look-alike name → same dish or new). Nothing saves until **Save N changes**, and the import can be undone for 7 days from the recycle bin. Customers are matched by mobile, sweets and dishes by name; an empty cell never clears a saved value (`lib/importPlan.ts`, `importDishes.ts`, `importSweets.ts`, `importCustomers.ts`).

### Packages and sweets

- **Package price by guest count** (Packages → Price per plate → *By number of guests*): ranges like "Up to 150 guests ₹270 · 151 – 300 ₹250 · 301 and more ₹230" (`menus.price_tiers`; the first price is also kept in `price_per_plate`). The editor shows what the soonest booking would pay. On a quotation the plate price fills in from the guest count and moves with it while it still equals the package's price; a price typed by hand is never overwritten, and a hint shows the range and package (`lib/priceTiers.ts`, `components/quotes/usePackagePrice.ts`).
- **Save menu as package** (quotation ⋯ menu) opens a dialog with the course summary, name, price and *Keep "choose 1 farsan" as a choice*.
- **Sweets rate card** (Sweet items → *Rate card*): an A5 card to print or save as PDF with the logo, this season's specials and the all-year sweets at 1 kg / 500 g / 250 g (litre sweets by the litre, piece sweets per piece), only sweets on the POS, and the WhatsApp number (`lib/docs/rateCard.ts`).

## Bookings: list, calendar and pipeline

One screen, three views (the switch at the top remembers your choice; on phones it sits under the title):

- **List** (default): **Upcoming** · **Needs attention** · **Past** · **Cancelled** tabs instead of six status chips. Events are grouped by month, soonest first. Each row shows the date, customer · event, time · guests · venue, the value (a quote range while choices are open), one stage chip (Inquiry → Quoted → Confirmed → Invoiced → Paid) and **one next-step button**: Make quotation, Pick farsan & accept, Mark accepted, Create invoice, Record payment, Mark completed or Close as lost. Everything else — open event page, edit, quote, invoice, kitchen menu PDF, WhatsApp, call, Google Calendar, change status, delete — is in the **⋯** menu. Missing guest counts show in amber.
- **Needs attention:** past events still marked Inquiry / Quoted / Confirmed, or invoiced with a balance. A banner on Upcoming counts them; one tap closes each (completed, paid, or closed as lost).
- **Summary tiles** (desktop): upcoming events and the next one, confirmed value, and how many next steps are waiting (invoices, quotes, decisions, payments, to close).
- **Calendar:** a month coloured by stage (dots on phones), multi-day events on each of their days, today highlighted. Tap a day to see its events with meals (multi-day quotes), food type, next step, **Menu PDF** and ⋯, plus **+ New booking on that day** (the form opens on that date). The old Calendar page is folded in: the phone bar's **Bookings** button and any "Calendar" link open this view.
- **Pipeline:** columns Inquiry → Quoted → Confirmed → Invoiced → Paid (last 60 days) with counts and totals; past-dated cards are flagged "Date passed" with the step that closes them.
- **Delete booking** (⋯ menu): if it has quotations, the dialog names them ("QTN-0024, QTN-0025 will be deleted too") and **Delete all** removes them and the booking. A booking with an invoice is never deleted here (the live database would delete the invoice with it); the dialog offers **Mark cancelled** instead.
- Search (name, phone, venue, event) works in all three views. Design: the "Shiv Shakti Bookings Redesign" canvas.

## Quotation options, "choose any" dishes and the quote calendar

- **Saving keeps you in the editor:** Save / Update Quotation stays on the quotation (a new one carries on as an edit of what was saved); **Close** (or ×) goes back to the list and asks first if there are unsaved changes.
- **Calendar view** (Quotations → Calendar): a month of quotes by event date, coloured by status (draft, sent, accepted, not chosen / rejected). Tap a day for its quotes, a busy-day note and **+ New quote on this day** (the date is filled in). On phones the days show dots and the list sits below.
- **Several quotes on one day are allowed.** The form warns when the date already has other quotes or the venue is booked by a confirmed event, but never blocks. Only two *confirmed* bookings at the same venue and date are refused.
- **Alternatives ("customer chooses"):** tap **+ Alternative** beside any selected dish (e.g. Churma Na Ladoo), search, and tap **Offer** on the other dish — dishes from the same course are suggested first, and dishes already in the menu can be moved in. They show as one box, "Customer chooses 1 of 2", joined by **OR**; **+ Add another alternative** adds more, and with three or more you can set how many they choose. Tap **Picked?** on a dish to record what the customer chose (works on accepted quotes too); **Remove choice** keeps all the dishes without a choice.
  - With item prices, the plate price becomes a **range** (cheapest to dearest picks) until the customer chooses; tick **Same price whatever they pick** to keep the dishes as free choices.
  - **Your own price:** type it in Per Plate (the **Own price** tick turns on) — it is the price of the menu as you built it. Alternatives still move it by their price difference: ₹215 with South Boll (₹60) and Mix Bhajiya (₹40) offered instead quotes **₹195 – ₹215** a plate. Untick **Own price** to add up the dish prices again. Older quotes saved with one fixed price keep it until you edit them.
  - **On paper:** when the dish prices make up the plate price, the price table lists each priced course and choice (₹0 rows are left out). With your own higher price it shows one "Catering" line with the plate range, and the choice box shows what each dish adds ("South Boll +₹20").
  - Works in single-day menus and in every meal of a multi-day event.
- **Options A / B / C:** on a saved quotation, **+ Add option** copies it as the next option of the same enquiry, with its own menu, price and name (e.g. Classic, Premium). Tabs switch between options.
- **Quotation list:** an enquiry with options shows as one **master row** (first option's number, "2 options", total from lowest to highest — or the accepted option's — and "Draft · customer picks 1 of 2" / "Option B accepted"), with **Option A**, **Option B** indented under it, each with its own status, PDF, share, edit, clone and delete. The master row's **Share all** / **PDF · A + B** make one PDF with every option; **Open** opens the accepted (or first) option. Deleting down to one option turns it back into a plain quotation.
- **Event page knows what is still open:** when a quote's option or "choose any" dishes are not decided yet, the booking's next step says so ("Ask which Farsan the customer wants, then accept the quote") and the button reads **Pick dishes & accept** / **Pick option & accept** instead of Create invoice. Quote statuses there read Draft / Sent / Accepted / Not chosen (not the invoice words).
- **Payment schedule while choices are open:** each step shows lowest – highest (10% = ₹2,880 – ₹3,160) instead of only percentages; with options in one PDF each option's amount sits under every step. Times print as 11:00 AM.
- **Mark accepted…** (from the editor, the status menu or the event page) asks which option the customer took and which dishes they picked, with the final guest count and a live price. It locks in the picks and exact price, marks the other options **Not chosen**, confirms the booking and offers the invoice.
- **PDF:** a single option's PDF ("Option A only" in the editor, **PDF** on its row) holds just that option with its exact payment amounts, saved as `Name_QTN-0024_Option_A.pdf`. The all-options PDF ("All options (A + B)", **PDF · A + B**) carries option A's number, compares the options side by side (each with its own quotation number), then each option's menu and price, and under every payment step shows each option's amount; the WhatsApp message lists each option's total, and sharing it marks every draft option as sent. In both, choice groups print with tick boxes and their price effect; the total shows as a range until decided; the payment schedule shows percentages until the price is final. Invoices and the event menu list only the dishes that will be served.

## Printed documents (quotations, invoices, slips, bills, reports)

One look ("Navy & Leaf", from the logo) for everything that is printed or shared:
- **Quotation:**
  - logo strip with address, GSTIN, number, issue date and *valid till*;
  - customer and event facts;
  - the menu grouped by course, with "with …" accompaniments and notes;
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
- **Menu layout on paper (design A):** a two-column grid of course cards, each a plain list of dishes with dotted rules — no sub-headings. Courses follow the order you arranged the dishes in; dal, rice, breads, sabji / shaak, kathod and kadhi sit in one **Main Course**; farsan and starters are their own course even when kept under Main Course in Menu Builder; "Including" / accompaniments always come last; a course with more than 8 dishes spans both columns. A "choose any" group that is a whole course prints as a green choice card ("Farsan · choose any 1", tick boxes, "Tick one."); with other dishes it sits as a small green box inside the course.
- **Served with (accompaniments):** under each selected dish, **+ Served with…** opens a list of accompaniments (dishes in an Including / Accompaniments category, chutneys, raita, pickle, papad) — tick as many as you like, or search any dish. They print as "with Coconut Chutney, Green Chutney" under the dish, and a picked accompaniment that is also on the menu is not printed twice. Tip: make an **Accompaniments** category in Menu Builder for chutneys and sauces.
- **Every quotation layout** (per plate, per item, special price with GST, own price with a choice, choose 2 of 5, decided, free choice, prices hidden, big menu, one day two meals, three days, a meal with a choice, options A + B, one option) is on the design canvas "Shiv Shakti Quotation — Every Combination", rendered from the real code.
- Gujarati names print correctly (Noto Sans Gujarati); amounts use the real ₹ sign — headings and big amounts use Outfit, which has no ₹, so the sign always comes from Noto Sans (`HEAD_FONT` in `lib/docs/theme.ts`); the PDF server has no other fonts to fall back on.

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
  lib/quoteGroups.ts                     list grouping: options under one enquiry, group total and status
  hooks/useQuoteForm.ts, useAcceptFlow.tsx   quotation form state and totals; accept with option + picks
  lib/bookingBoard.ts                    Bookings brain: tab, stage, one next step, month groups, stats, pipeline columns
  components/catering/BookingAgenda, BookingMonth, BookingPipeline, BookingMenu, BookingBits   the three Bookings views, the ⋯ menu, shared chips
  components/catering/QuotationCalendar, QuotationOptionsBar, QuotationChoiceGroup, AlternativePicker, QuoteAcceptDialog, QuotationList, QuotationRowParts
  lib/docs/                         printed documents: theme, parts, menu blocks, quotation, invoice/event menu, sweets, settings, QR, output (PDF service → download/share, print fallback)
  api/pdf.js                        PDF service (Vercel function, headless Chrome)
  components/DocSettingsCard.tsx    Data Center → Documents
  components/settings/              Settings groups (Business, Money, Reminders, Team & access, Data), team, password, FSSAI and recycle-bin dialogs
  components/menu/                  Menu Builder "Edit as sheet": grid, toolbar, bulk dialogs, review, food-style chips
  components/data/                  Paste a list of dishes, Import from Excel (dishes, sweets, customers) with a preview
  lib/xlsx.ts                       .xlsx read/write (fflate) and CSV for imports, exports and backups
  lib/recycleBin.ts, hooks/useRecycleBin.ts   recycle bin: names, grouping, restore plan (parents first), undo of imports
  lib/backup.ts, hooks/useBackup.ts           "Download everything" sheets and the JSON backup copy
  lib/menuSheet.ts, lib/foodStyles.ts         sheet edits (pending changes, paste, % change, save plan) and dish food styles
  lib/priceTiers.ts, lib/docs/rateCard.ts     package price by guest count; the printable sweets rate card
  hooks/useStaff.ts, components/navItems.ts   team logins and invites; which screens each role sees
  lib/quoteMath.ts                  shared catering money math
  pages/                            one file per screen
supabase/
  schema.sql                        baseline schema (inferred from the code, for local dev)
  migrations/                       SQL to run on the live database (pack sizes, security/RLS, item prices + GSTIN, invoice/quote numbers, pre-booking fulfillment, document settings, quote options, POS payments, spends, team roles + recycle bin + food styles + price tiers)
```

## Tests and checks

```bash
CI=true npx react-scripts test --watchAll=false   # unit tests: pack pricing, merge plan, money, GST, documents, reports, pre-booking sheet/slip, nav and roles, Excel, recycle bin, backups, sheet edits, imports, price tiers, rate card
npx tsc --noEmit -p .                             # type check
npx eslint src --ext .ts,.tsx                     # lint (the hosted build fails on warnings when CI=true)
```

### Local database (optional)

`supabase/schema.sql` recreates every table, so you can run the app against a local Postgres + PostgREST (e.g. Docker) instead of the live project.

## Translations

The app is English only today and has no translation files. If Hindi or other languages are added later, add English and Hindi first. Other languages need to be translated separately by the owner.
