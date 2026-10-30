import React, { useState } from 'react';
import { EventDay, MealSlot, QuotationLineItem } from '../../hooks/useQuotations';
import { getDayNumber } from '../../lib/pdf/quotationPdf';
import QuotationItemPanels, { PickerItem, ItemTextField } from './QuotationItemPanels';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Hi-Tea', 'Snacks', 'Dinner', 'Supper'];

export const genId = () => Math.random().toString(36).slice(2, 10);

interface Props {
  eventDays: EventDay[];
  setEventDays: React.Dispatch<React.SetStateAction<EventDay[]>>;
  activeMealKey: string | null;
  setActiveMealKey: (key: string | null) => void;
  guestCount: number;
  defaultDate: string;
  menuItems: PickerItem[];
  priceFor: (itemId: string) => number;
  showPrices?: boolean;
}

const sumMeals = (meals: MealSlot[]) => meals.reduce((s, m) => s + m.subtotal, 0);

// Item changes re-derive per plate from item prices when any are priced.
const withItems = (m: MealSlot, items: QuotationLineItem[]): MealSlot => {
  const itemsSum = items.reduce((s, x) => s + (x.amount || 0), 0);
  const per_plate_amount = itemsSum > 0 ? itemsSum : (items.length ? m.per_plate_amount : 0);
  return { ...m, items, per_plate_amount, subtotal: per_plate_amount * m.guest_count };
};

const smallInp: React.CSSProperties = { border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 7px', fontSize: 12, textAlign: 'right' };

const QuotationMultiDay: React.FC<Props> = ({
  eventDays, setEventDays, activeMealKey, setActiveMealKey, guestCount, defaultDate, menuItems, priceFor, showPrices,
}) => {
  const [draggedMeal, setDraggedMeal]       = useState<{ dayIdx: number; mealId: string } | null>(null);
  const [dragOverDayIdx, setDragOverDayIdx] = useState<number | null>(null);
  const [dragOverMealId, setDragOverMealId] = useState<string | null>(null);

  // Applies fn to one day's meals and refreshes that day's subtotal.
  const patchDay = (dayIdx: number, fn: (meals: MealSlot[]) => MealSlot[]) =>
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = fn(d.meals);
      return { ...d, meals, day_subtotal: sumMeals(meals) };
    }));

  const patchMeal = (dayIdx: number, mealId: string, fn: (m: MealSlot) => MealSlot) =>
    patchDay(dayIdx, meals => meals.map(m => (m.id === mealId ? fn(m) : m)));

  // ── days ──
  const addOccasion = () => {
    const lastDate = eventDays.length > 0 ? eventDays[eventDays.length - 1].date : defaultDate;
    setEventDays(prev => [...prev, { day_number: getDayNumber(lastDate, prev), date: lastDate, meals: [], day_subtotal: 0 }]);
  };
  const removeDay = (idx: number) => setEventDays(prev => prev.filter((_, i) => i !== idx));
  const updateDayDate = (idx: number, date: string) =>
    setEventDays(prev => prev.map((d, i) => (i === idx ? { ...d, date } : d)));

  // ── meals ──
  const addMeal = (dayIdx: number) => {
    const mealId = genId();
    patchDay(dayIdx, meals => [...meals, {
      id: mealId, meal_type: 'breakfast', ceremony_name: '', time: '', guest_count: guestCount,
      per_plate_amount: 0, discount_amount: 0, items: [], subtotal: 0,
    }]);
    setActiveMealKey(`${dayIdx}_${mealId}`);
  };

  const removeMeal = (dayIdx: number, mealId: string) => {
    patchDay(dayIdx, meals => meals.filter(m => m.id !== mealId));
    if (activeMealKey === `${dayIdx}_${mealId}`) setActiveMealKey(null);
  };

  const cloneMeal = (dayIdx: number, mealId: string) =>
    patchDay(dayIdx, meals => {
      const idx = meals.findIndex(m => m.id === mealId);
      if (idx < 0) return meals;
      const cloned: MealSlot = { ...meals[idx], id: genId(), items: meals[idx].items.map(it => ({ ...it })) };
      return [...meals.slice(0, idx + 1), cloned, ...meals.slice(idx + 1)];
    });

  const updateMealField = (dayIdx: number, mealId: string, field: keyof MealSlot, value: any) =>
    patchMeal(dayIdx, mealId, m => {
      const updated = { ...m, [field]: value };
      updated.subtotal = updated.per_plate_amount * updated.guest_count;
      return updated;
    });

  // ── meal items ──
  const addItemToMeal = (dayIdx: number, mealId: string, it: PickerItem) =>
    patchMeal(dayIdx, mealId, m => withItems(m, [...m.items, {
      item_id: it.id, item_name: it.name,
      category_name: it.subcategory?.category?.name || '',
      subcategory_name: it.subcategory?.name || '', amount: priceFor(it.id),
    }]));

  const removeItemFromMeal = (dayIdx: number, mealId: string, itemId: string) =>
    patchMeal(dayIdx, mealId, m => withItems(m, m.items.filter(x => x.item_id !== itemId)));

  const updateMealItemAmount = (dayIdx: number, mealId: string, itemId: string, amount: number) =>
    patchMeal(dayIdx, mealId, m => withItems(m, m.items.map(x => (x.item_id === itemId ? { ...x, amount } : x))));

  const updateMealItemText = (dayIdx: number, mealId: string, itemId: string, field: ItemTextField, value: string) =>
    patchMeal(dayIdx, mealId, m => ({ ...m, items: m.items.map(x => (x.item_id === itemId ? { ...x, [field]: value } : x)) }));

  const reorderMealItems = (dayIdx: number, mealId: string, fromIdx: number, toIdx: number) =>
    patchMeal(dayIdx, mealId, m => {
      const items = [...m.items];
      const [removed] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, removed);
      return { ...m, items };
    });

  // ── meal drag-and-drop ──
  const resetDragState = () => { setDraggedMeal(null); setDragOverDayIdx(null); setDragOverMealId(null); };

  const handleMealDragStart = (e: React.DragEvent, dayIdx: number, mealId: string) => {
    setDraggedMeal({ dayIdx, mealId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMealCardDragOver = (e: React.DragEvent, dayIdx: number, mealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverMealId !== mealId) setDragOverMealId(mealId);
    if (dragOverDayIdx !== dayIdx) setDragOverDayIdx(dayIdx);
  };

  // Moves the dragged meal before targetMealId, or to the end of the day when null.
  const moveMeal = (targetDayIdx: number, targetMealId: string | null) => {
    if (!draggedMeal || draggedMeal.mealId === targetMealId) { resetDragState(); return; }
    const { dayIdx: srcIdx, mealId: srcMealId } = draggedMeal;
    setEventDays(prev => {
      const next = prev.map(d => ({ ...d, meals: [...d.meals] }));
      const srcMeal = next[srcIdx].meals.find(m => m.id === srcMealId);
      if (!srcMeal) return prev;
      next[srcIdx].meals = next[srcIdx].meals.filter(m => m.id !== srcMealId);
      next[srcIdx].day_subtotal = sumMeals(next[srcIdx].meals);
      const target = next[targetDayIdx].meals;
      const found = targetMealId ? target.findIndex(m => m.id === targetMealId) : -1;
      const insertAt = found < 0 ? target.length : found;
      next[targetDayIdx].meals = [...target.slice(0, insertAt), srcMeal, ...target.slice(insertAt)];
      next[targetDayIdx].day_subtotal = sumMeals(next[targetDayIdx].meals);
      return next;
    });
    if (activeMealKey === `${srcIdx}_${srcMealId}`) setActiveMealKey(`${targetDayIdx}_${srcMealId}`);
    resetDragState();
  };

  const handleDayDragOver = (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDayIdx !== dayIdx) setDragOverDayIdx(dayIdx);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {eventDays.map((day, dayIdx) => {
        const dayNum = getDayNumber(day.date, eventDays);
        const crossDrop = dragOverDayIdx === dayIdx && draggedMeal?.dayIdx !== dayIdx;
        return (
          <div key={dayIdx} style={{ border: `0.5px solid ${crossDrop ? '#E8750A' : '#E5E5E0'}`, borderRadius: 10, marginBottom: 14, overflow: 'hidden', transition: 'border-color 0.15s' }}>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
              <span style={{ fontWeight: 700, color: '#E8750A', fontSize: 13, minWidth: 50 }}>Day {dayNum}</span>
              <input type="date" value={day.date} onChange={e => updateDayDate(dayIdx, e.target.value)}
                style={{ border: '1px solid #E5E5E0', borderRadius: 7, padding: '5px 8px', fontSize: 13, background: '#fff' }} />
              <div style={{ flex: 1 }} />
              {day.day_subtotal > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>₹{day.day_subtotal.toLocaleString('en-IN')}</span>}
              <button onClick={() => removeDay(dayIdx)} aria-label="Remove occasion"
                style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* Meals — drop zone */}
            <div style={{ padding: '10px 14px', minHeight: draggedMeal && draggedMeal.dayIdx !== dayIdx ? 60 : undefined, transition: 'background 0.15s', background: crossDrop ? '#FFF8EE' : 'transparent' }}
              onDragOver={e => handleDayDragOver(e, dayIdx)}
              onDragLeave={() => setDragOverDayIdx(null)}
              onDrop={e => { e.preventDefault(); moveMeal(dayIdx, null); }}>
              {day.meals.length === 0 && (
                <div style={{ fontSize: 12, color: dragOverDayIdx === dayIdx ? '#E8750A' : '#AAAAAA', marginBottom: 8 }}>
                  {dragOverDayIdx === dayIdx && draggedMeal ? 'Drop meal here' : 'No meals added for this day'}
                </div>
              )}
              {day.meals.map(meal => {
                const mealKey = `${dayIdx}_${meal.id}`;
                const isOpen = activeMealKey === mealKey;
                const isBeingDragged = draggedMeal?.mealId === meal.id && draggedMeal?.dayIdx === dayIdx;
                const isDragTarget = dragOverMealId === meal.id && !isBeingDragged;
                const offer = meal.discount_amount || 0;
                return (
                  <div key={meal.id}
                    draggable
                    onDragStart={e => handleMealDragStart(e, dayIdx, meal.id)}
                    onDragEnd={resetDragState}
                    onDragOver={e => handleMealCardDragOver(e, dayIdx, meal.id)}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); moveMeal(dayIdx, meal.id); }}
                    style={{ border: `0.5px solid ${isOpen ? '#E8750A' : '#E5E5E0'}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden', opacity: isBeingDragged ? 0.45 : 1, transition: 'opacity 0.15s, border-top-color 0.1s', borderTop: isDragTarget ? '2.5px solid #E8750A' : undefined }}>
                    {/* Meal row */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', flexWrap: 'wrap', background: isOpen ? '#FFF8EE' : '#fff' }}>
                      <span title="Drag to move meal" style={{ cursor: 'grab', color: '#CCCCCA', fontSize: 15, padding: '0 2px', flexShrink: 0, userSelect: 'none' }}>⠿</span>
                      <select value={meal.meal_type} onChange={e => updateMealField(dayIdx, meal.id, 'meal_type', e.target.value)}
                        style={{ border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, background: '#fff', fontWeight: 600, color: '#1A237E' }}>
                        {MEAL_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                      </select>
                      <input type="text" value={meal.ceremony_name || ''} placeholder="Ceremony name (optional)"
                        onChange={e => updateMealField(dayIdx, meal.id, 'ceremony_name', e.target.value)}
                        style={{ border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 180, maxWidth: '100%', color: '#444' }} />
                      <input type="time" value={meal.time} onChange={e => updateMealField(dayIdx, meal.id, 'time', e.target.value)}
                        style={{ border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 110 }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#888880' }}>Guests</span>
                        <input type="number" min="0" inputMode="numeric" value={meal.guest_count || ''} placeholder="0"
                          onChange={e => updateMealField(dayIdx, meal.id, 'guest_count', parseInt(e.target.value) || 0)}
                          style={{ ...smallInp, width: 70 }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#888880' }}>₹/plate</span>
                        <input type="number" min="0" inputMode="decimal" value={meal.per_plate_amount || ''} placeholder="0"
                          onChange={e => updateMealField(dayIdx, meal.id, 'per_plate_amount', parseFloat(e.target.value) || 0)}
                          style={{ ...smallInp, width: 80 }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#888880' }}>Offer ₹/pl</span>
                        <input type="number" min="0" inputMode="decimal" value={meal.discount_amount || ''} placeholder="same"
                          onChange={e => updateMealField(dayIdx, meal.id, 'discount_amount', parseFloat(e.target.value) || 0)}
                          style={{ ...smallInp, width: 72, background: '#FFFEF5' }} />
                      </label>
                      {meal.subtotal > 0 && (offer > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                          <span style={{ textDecoration: 'line-through', color: '#AAAAAA', fontSize: 11 }}>₹{meal.subtotal.toLocaleString('en-IN')}</span>
                          <span style={{ color: '#E8750A' }}>₹{(offer * meal.guest_count).toLocaleString('en-IN')}</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 600 }}>= ₹{meal.subtotal.toLocaleString('en-IN')}</span>
                      ))}
                      <button onClick={() => setActiveMealKey(isOpen ? null : mealKey)}
                        style={{ fontSize: 11, color: '#E8750A', background: isOpen ? '#FFF0E0' : 'none', border: '1px solid #E8750A', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', marginLeft: 'auto' }}>
                        {meal.items.length > 0 ? `${meal.items.length} items ` : 'Add Items '}{isOpen ? '▲' : '▼'}
                      </button>
                      <button onClick={() => cloneMeal(dayIdx, meal.id)} title="Clone this meal"
                        style={{ background: 'none', border: '1px solid #888880', borderRadius: 5, color: '#555552', fontSize: 11, cursor: 'pointer', padding: '3px 7px' }}>⧉ Clone</button>
                      <button onClick={() => removeMeal(dayIdx, meal.id)} aria-label="Remove meal"
                        style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px' }}>×</button>
                    </div>

                    {isOpen && (
                      <div style={{ padding: 10, borderTop: '0.5px solid #F5E8D0', background: '#FFFCF8' }}>
                        <QuotationItemPanels compact showPrices={showPrices}
                          menuItems={menuItems} items={meal.items}
                          selectedTitle="SELECTED FOR THIS MEAL" totalLabel="Items total → auto per plate"
                          onAdd={it => addItemToMeal(dayIdx, meal.id, it)}
                          onAmount={(id, amt) => updateMealItemAmount(dayIdx, meal.id, id, amt)}
                          onRemove={id => removeItemFromMeal(dayIdx, meal.id, id)}
                          onText={(id, field, v) => updateMealItemText(dayIdx, meal.id, id, field, v)}
                          onReorder={(from, to) => reorderMealItems(dayIdx, meal.id, from, to)}
                          onReset={() => patchMeal(dayIdx, meal.id, m => withItems(m, []))} />
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => addMeal(dayIdx)}
                style={{ fontSize: 12, color: '#378ADD', background: 'none', border: '1px solid #378ADD', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                + Add Meal for Day {dayNum}
              </button>
            </div>

            {day.meals.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', background: '#F9F8F5', borderTop: '0.5px solid #E5E5E0', fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>
                Day {dayNum} Total: <span style={{ color: '#E8750A', marginLeft: 8 }}>₹{day.day_subtotal.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addOccasion}
        style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', marginTop: 4, background: '#fff', color: '#E8750A', border: '1px dashed #E8750A', borderRadius: 8, cursor: 'pointer' }}>
        + Add Occasion
      </button>
    </div>
  );
};

export default QuotationMultiDay;
