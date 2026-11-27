import React from 'react';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import type { QuotationLineItem } from '../../hooks/useQuotations';
import { useHasPlateDiscount } from '../../hooks/useSchemaStatus';
import { basePlate, onePickPrice, ownRange, pickRange, plateRange } from '../../lib/quoteChoices';
import { menuValueOf, plateOff, quotePlate, showsDiscount } from '../../lib/mealPrice';
import { range } from '../../lib/quoteSummary';
import { inr } from '../../lib/money';
import MenuCourses from './MenuCourses';
import PlateBlock, { PlateModel } from './PlateBlock';
import type { PackagePrice } from './usePackagePrice';
import { Field } from './bits';

interface Props { f: QuoteForm; who: string; pkg?: PackagePrice; pdfPrices: boolean; onPdfPrices: (on: boolean) => void }

// A one-meal quote is one meal card: date, time, guests, dishes, price a plate, then "+ Add a meal / day" to grow it.
const OneMealCard: React.FC<Props> = ({ f, who, pkg, pdfPrices, onPdfPrices }) => {
  const ready = useHasPlateDiscount();
  const { ev } = f;
  const listed = basePlate(f.selectedItems);
  const dishTotal = menuValueOf({ items: f.selectedItems, per_plate_amount: 0 });
  const menuValue = f.fullPrice > 0 ? f.fullPrice : dishTotal;
  const typed = f.autoPrice && f.showPrices ? listed : parseFloat(f.perPlate) || 0;
  const plate = quotePlate({ items: f.selectedItems, full_price: f.fullPrice, per_plate_amount: f.plateLow, per_plate_max: f.perPlateMax, hide_discount: f.hideDiscount }, f.guestCount);
  const dishOn = pdfPrices && f.hasItemPrices;
  const preview = (next: QuotationLineItem[]) => {
    if (f.showPrices && f.autoPrice) { const r = plateRange(next); return `${range(r.min, r.max)} a plate`; }
    const r = ownRange(parseFloat(f.perPlate) || 0, next);
    return `${range(r.low, r.high)} a plate`;
  };
  const p: PlateModel = {
    id: 'one', menuValue, listPrice: f.fullPrice > 0, typed, follows: (f.autoPrice && f.showPrices) || !typed,
    onPrice: v => {
      if (v != null) f.typePerPlate(String(v));
      else if (f.fullPrice > 0) f.typePerPlate(String(f.fullPrice));
      else { f.setItemPricesPref(true); f.setAutoPrice(true); }
    },
    low: f.plateLow, high: f.perPlateMax, guests: f.guestCount,
    gap: pickRange(f.selectedItems), onePrice: onePickPrice(f.selectedItems), onOnePrice: on => (on ? f.chargeHighest() : f.letPicksPrice()),
    off: plateOff(plate),
    discount: ready ? {
      on: showsDiscount(plate, dishOn),
      set: on => { f.setHideDiscount(!on); if (on && !(f.fullPrice > 0) && !dishOn) f.setFullPrice(dishTotal); },
    } : undefined,
    dishPrices: f.showPrices ? { on: dishOn, can: f.hasItemPrices, set: onPdfPrices } : undefined,
    onUseDishPrices: f.showPrices ? undefined : () => { f.setItemPricesPref(true); f.setAutoPrice(true); },
    children: pkg?.hint ? (
      <p className="q-hint" role="status">{pkg.hint.follows ? pkg.hint.text : <>
        Package price: {pkg.hint.text} <button type="button" className="q-link" onClick={pkg.use}>Use {inr(pkg.hint.price)}</button></>}</p>
    ) : undefined,
  };

  return (
    <div className="q-meal">
      <div className="q-grid3">
        <Field label="Date"><input type="date" value={ev.draft.date} onChange={e => ev.patch({ date: e.target.value })} /></Field>
        <Field label="Time"><input type="time" value={ev.draft.time} onChange={e => ev.patch({ time: e.target.value })} /></Field>
        <Field label="Guests"><input type="number" min={0} inputMode="numeric" value={ev.guests} onChange={e => ev.setGuests(e.target.value)} placeholder="0" /></Field>
      </div>
      <MenuCourses items={f.selectedItems} menu={f.activeItems} showPrices={f.showPrices} who={who} toLine={f.toLine} preview={preview} onChange={f.setSelectedItems} />
      <span className="q-hint">Tap a dish to set its price, note or "served with" items. Dishes with no price are part of the plate price and never show ₹0 on the PDF.</span>
      <PlateBlock p={p} />
      {ready && (
        <details className="q-more">
          <summary>More · list price</summary>
          <div className="q-fields">
            <Field label="List price a plate" hint="Instead of what the dishes add up to. The PDF strikes this price through, so use a real price.">
              <input type="number" min={0} inputMode="decimal" value={f.fullPrice || ''} placeholder={`Dishes: ₹${dishTotal}`} onChange={e => f.setFullPrice(parseFloat(e.target.value) || 0)} />
            </Field>
          </div>
        </details>
      )}
      <div className="q-meal-acts">
        <button type="button" className="q-otab add" onClick={() => f.toSeveral('meal')}>+ Add a meal</button>
        <button type="button" className="q-otab add" onClick={() => f.toSeveral('day')}>+ Add a day</button>
      </div>
    </div>
  );
};

export default OneMealCard;
