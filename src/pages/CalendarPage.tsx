import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { useBookings } from '../hooks/useBookings';
import { useQuotations } from '../hooks/useQuotations';
import StatusPill from '../components/StatusPill';
import { formatDateIST } from '../lib/ist';

const eventColors = ['#E8750A', '#378ADD', '#639922', '#7F77DD', '#D4537E', '#BA7517', '#0F6E56'];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── PDF logo ─────────────────────────────────────────────────────────────────
const _calPdfLogo = (() => { const i = new Image(); i.src = '/logo.png'; return i; })();

const downloadEventMenuPDF = (booking: any, quotation: any | undefined) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; const CW = W - M * 2;
  const RH = 7;
  let y = 0;

  const hasLogo = _calPdfLogo.complete && _calPdfLogo.naturalWidth > 0;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(26, 35, 126); doc.rect(0, 35.5, W, 0.5, 'F');
  y = 4;
  if (hasLogo) {
    try { doc.addImage(_calPdfLogo as any, 'PNG', M, y, 40, 29); } catch {}
  }
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
  doc.text('EVENT MENU', W - M, y + 11, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 78);
  doc.text(formatDateIST(booking.event_date, 'dd-MM-yyyy'), W - M, y + 18, { align: 'right' });
  y = 43;

  // ── Info block ───────────────────────────────────────────────────────────────
  const infoRow = (label: string, value: string) => {
    if (y > 272) { doc.addPage(); y = 15; }
    doc.setDrawColor(210, 208, 205);
    doc.rect(M, y, 52, RH); doc.rect(M + 52, y, CW - 52, RH);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 118, 115); doc.text(label, M + 3, y + RH - 2);
    doc.setTextColor(30, 30, 28); doc.text(value, M + 55, y + RH - 2);
    y += RH;
  };

  const customer = booking.customer;
  infoRow('Customer', customer?.name || '—');
  if (customer?.phone) infoRow('Phone', customer.phone);
  infoRow('Event Type', booking.event_type);
  if (booking.end_date && booking.end_date !== booking.event_date) {
    infoRow('Event Dates', `${formatDateIST(booking.event_date, 'dd-MM-yyyy')} – ${formatDateIST(booking.end_date, 'dd-MM-yyyy')}`);
  } else {
    infoRow('Event Date', formatDateIST(booking.event_date, 'dd-MM-yyyy'));
  }
  if (booking.event_time) infoRow('Time', booking.event_time);
  if (booking.venue) infoRow('Venue', booking.venue);
  infoRow('Guests', String(booking.guest_count));
  y += 6;

  // ── Menu items ───────────────────────────────────────────────────────────────
  if (quotation?.is_multi_day && (quotation?.event_days || []).length > 0) {
    // Multi-day: Day → Meal → Items
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
    doc.text('EVENT MENU', M, y); y += 5;

    for (const day of quotation.event_days) {
      if (y > 265) { doc.addPage(); y = 15; }
      // Day separator
      doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text(`Day ${day.day_number}  —  ${formatDateIST(day.date, 'dd-MM-yyyy')}`, M + 3, y + RH - 2);
      y += RH;

      for (const meal of (day.meals || [])) {
        if (y > 265) { doc.addPage(); y = 15; }
        // Meal header row
        doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, RH, 'F');
        doc.setDrawColor(200, 198, 195); doc.rect(M, y, CW, RH);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const mealLabel = `${cap(meal.meal_type)}${meal.time ? `  ·  ${meal.time}` : ''}${meal.ceremony_name ? `  ·  ${meal.ceremony_name}` : ''}`;
        doc.text(mealLabel, M + 3, y + RH - 2);
        doc.text(`${meal.guest_count} guests`, M + CW - 2, y + RH - 2, { align: 'right' });
        y += RH;

        // Item rows
        for (const item of (meal.items || [])) {
          if (y > 272) { doc.addPage(); y = 15; }
          const subH = 6;
          doc.setFillColor(250, 249, 246); doc.rect(M, y, CW, subH, 'F');
          doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, subH);
          doc.setFontSize(8); doc.setFont('times', 'italic'); doc.setTextColor(30, 30, 28);
          doc.text(`  · ${item.item_name}`, M + 3, y + subH - 1.5);
          y += subH;
        }
      }
    }
    y += 6;
  } else if ((quotation?.items || []).length > 0) {
    // Single-day: items grouped by subcategory (no prices)
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
    doc.text('MENU ITEMS', M, y); y += 5;

    doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, RH, 'F');
    doc.setDrawColor(200, 198, 195); doc.rect(M, y, CW, RH);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('Item', M + 3, y + RH - 2);
    y += RH;

    const subGroups: { subcategoryName: string; categoryName: string; items: any[] }[] = [];
    const seen = new Set<string>();
    for (const item of quotation.items) {
      const key = `${item.category_name}|||${item.subcategory_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        subGroups.push({ subcategoryName: item.subcategory_name, categoryName: item.category_name, items: [] });
      }
      subGroups.find(g => g.categoryName === item.category_name && g.subcategoryName === item.subcategory_name)!.items.push(item);
    }

    for (const group of subGroups) {
      if (y > 268) { doc.addPage(); y = 20; }
      doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text(`${group.categoryName}  ›  ${group.subcategoryName}`, M + 3, y + RH - 2);
      y += RH;
      for (const item of group.items) {
        if (y > 268) { doc.addPage(); y = 20; }
        doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, RH, 'F');
        doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
        doc.text(`  · ${item.item_name}`, M + 3, y + RH - 2);
        y += RH;
      }
    }
    y += 3;
  } else {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 118, 115);
    doc.text('No menu items linked to this event.', M, y);
    y += 10;
  }

  // ── Notes ────────────────────────────────────────────────────────────────────
  if (quotation?.notes) {
    if (y > 265) { doc.addPage(); y = 15; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
    doc.text('NOTES', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 78);
    const noteLines = doc.splitTextToSize(quotation.notes, CW);
    doc.text(noteLines, M, y);
  }

  doc.setFontSize(7); doc.setTextColor(180, 180, 178);
  doc.text('Shiv Shakti Catering & Events', W / 2, 285, { align: 'center' });

  const custName = (customer?.name || 'Event').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${custName}_${formatDateIST(booking.event_date, 'dd-MM-yyyy')}_menu.pdf`);
};

const CalendarPage: React.FC = () => {
  const { data: bookings = [] } = useBookings();
  const { data: quotations = [] } = useQuotations();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPad = monthStart.getDay();
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];

  const bookingsForDay = (day: Date) =>
    bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      const start = parseISO(b.event_date);
      const end = b.end_date ? parseISO(b.end_date) : start;
      return day >= start && day <= end;
    });

  // Returns meals scheduled for a booking on a specific date (from its multi-day quotation)
  const getMealsForDay = (bookingId: string, day: Date): { meal_type: string; time: string; guest_count: number; per_plate_amount: number; subtotal: number }[] => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const q = quotations.find(qt => qt.booking_id === bookingId && qt.is_multi_day && (qt.event_days?.length ?? 0) > 0);
    if (!q?.event_days) return [];
    const result: any[] = [];
    for (const occ of q.event_days) {
      if (occ.date === dateStr) {
        for (const meal of occ.meals) result.push(meal);
      }
    }
    return result;
  };

  // Chip label: show meal types for multi-day, event type for single-day
  const chipLabel = (b: typeof bookings[0], day: Date) => {
    const firstName = b.customer?.name?.split(' ')[0] || '';
    const meals = getMealsForDay(b.id, day);
    if (meals.length > 0) {
      const seen: string[] = [];
      meals.forEach(m => { const n = capitalize(m.meal_type); if (!seen.includes(n)) seen.push(n); });
      const names = seen;
      return `${firstName} · ${names.join(', ')}`;
    }
    return `${firstName} ${b.event_type}`;
  };

  const selectedBookings = selectedDay ? bookingsForDay(selectedDay) : [];

  const thisMonthBookings = bookings
    .filter(b => {
      const d = parseISO(b.event_date);
      return isSameMonth(d, currentMonth) && b.status !== 'cancelled';
    })
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Calendar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={btnGhost} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>◀ Prev</button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{format(currentMonth, 'MMMM yyyy')}</span>
          <button style={btnGhost} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>Next ▶</button>
          <button style={btnGhost} onClick={() => setCurrentMonth(new Date())}>Today</button>
        </div>
      </div>

      <div className="page-content">
        <div className="g-calendar">
          {/* Calendar grid */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#FAFAF8', borderBottom: '0.5px solid #E5E5E0' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontSize: 11, fontWeight: 600, color: '#888880' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} style={{ minHeight: 72, borderRight: '0.5px solid #F0F0EC', borderBottom: '0.5px solid #F0F0EC' }} />;
                const dayBookings = bookingsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                return (
                  <div key={day.toISOString()} onClick={() => setSelectedDay(day)}
                    style={{ minHeight: 72, borderRight: '0.5px solid #F0F0EC', borderBottom: '0.5px solid #F0F0EC', padding: 5, cursor: 'pointer',
                      background: isSelected ? '#FFFBF5' : isToday ? '#FFF8EE' : 'transparent' }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 600 : 400, color: isToday ? '#E8750A' : '#1A1A18', marginBottom: 3 }}>
                      {format(day, 'd')}
                    </div>
                    {dayBookings.slice(0, 2).map((b, bi) => (
                      <div key={b.id} style={{ background: eventColors[bi % eventColors.length] + '22',
                        color: eventColors[bi % eventColors.length], fontSize: 10, padding: '1px 5px', borderRadius: 3,
                        marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {chipLabel(b, day)}
                      </div>
                    ))}
                    {dayBookings.length > 2 && (
                      <div style={{ fontSize: 10, color: '#888880' }}>+{dayBookings.length - 2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Selected day details */}
            {selectedDay && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                  {format(selectedDay, 'EEEE, dd-MM-yyyy')}
                </div>
                {selectedBookings.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#888880' }}>No bookings on this day</div>
                ) : selectedBookings.map((b, i) => {
                  const meals = getMealsForDay(b.id, selectedDay);
                  const bQuotation = quotations.find(q => q.booking_id === b.id);
                  return (
                    <div key={b.id} style={{ marginBottom: 10, padding: 10, background: eventColors[i % eventColors.length] + '11', borderRadius: 8, borderLeft: `3px solid ${eventColors[i % eventColors.length]}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{b.customer?.name}</div>
                        <button
                          onClick={() => downloadEventMenuPDF(b, bQuotation)}
                          style={{ fontSize: 11, background: 'none', border: `1px solid ${eventColors[i % eventColors.length]}`, color: eventColors[i % eventColors.length], borderRadius: 5, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          ⬇ Menu PDF
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: '#666660', marginTop: 2 }}>{b.event_type} · {b.venue}</div>

                      {meals.length > 0 ? (
                        /* Multi-day: show each meal slot for this date */
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {meals.map((meal, mi) => (
                            <div key={mi} style={{ background: '#fff', borderRadius: 6, padding: '5px 8px', border: '0.5px solid #E5E5E0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: eventColors[i % eventColors.length] }}>
                                  {capitalize(meal.meal_type)}
                                </span>
                                {meal.time && (
                                  <span style={{ fontSize: 11, color: '#888880' }}>{meal.time}</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#666660', marginTop: 2 }}>
                                {meal.guest_count} guests · ₹{meal.per_plate_amount}/plate
                                {meal.subtotal > 0 && ` · ₹${meal.subtotal.toLocaleString('en-IN')}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Single-day: show guest count + cost */
                        <div style={{ fontSize: 11, color: '#666660', marginTop: 4 }}>
                          {b.guest_count} guests · ₹{b.estimated_cost.toLocaleString()}
                        </div>
                      )}

                      <div style={{ marginTop: 8 }}><StatusPill status={b.status} /></div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* This month events list */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                {format(currentMonth, 'MMMM')} events ({thisMonthBookings.length})
              </div>
              {thisMonthBookings.length === 0 ? (
                <div style={{ fontSize: 12, color: '#888880' }}>No events this month</div>
              ) : thisMonthBookings.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #F0F0EC', alignItems: 'center' }}>
                  <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: eventColors[i % eventColors.length] }}>{format(parseISO(b.event_date), 'dd')}</div>
                    <div style={{ fontSize: 9, color: '#888880' }}>{format(parseISO(b.event_date), 'MM')}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.customer?.name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>
                      {b.event_type}{b.end_date && b.end_date !== b.event_date ? ` · to ${format(parseISO(b.end_date), 'dd-MM')}` : ''} · {b.guest_count}g
                    </div>
                  </div>
                  <StatusPill status={b.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };

export default CalendarPage;
