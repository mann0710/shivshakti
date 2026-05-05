import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { useBookings } from '../hooks/useBookings';
import StatusPill from '../components/StatusPill';

const eventColors = ['#E8750A', '#378ADD', '#639922', '#7F77DD', '#D4537E', '#BA7517', '#0F6E56'];

const CalendarPage: React.FC = () => {
  const { data: bookings = [] } = useBookings();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad days to start from Sunday
  const startPad = monthStart.getDay();
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];

  const bookingsForDay = (day: Date) =>
    bookings.filter(b => isSameDay(parseISO(b.event_date), day) && b.status !== 'cancelled');

  const selectedBookings = selectedDay ? bookingsForDay(selectedDay) : [];

  const thisMonthBookings = bookings
    .filter(b => {
      const d = parseISO(b.event_date);
      return isSameMonth(d, currentMonth) && b.status !== 'cancelled';
    })
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div>
      <div style={topbar}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Calendar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={btnGhost} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>◀ Prev</button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{format(currentMonth, 'MMMM yyyy')}</span>
          <button style={btnGhost} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>Next ▶</button>
          <button style={btnGhost} onClick={() => setCurrentMonth(new Date())}>Today</button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
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
                        {b.customer?.name?.split(' ')[0]} {b.event_type}
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
                  {format(selectedDay, 'EEEE, MMM d')}
                </div>
                {selectedBookings.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#888880' }}>No bookings on this day</div>
                ) : selectedBookings.map((b, i) => (
                  <div key={b.id} style={{ marginBottom: 10, padding: 10, background: eventColors[i % eventColors.length] + '11', borderRadius: 8, borderLeft: `3px solid ${eventColors[i % eventColors.length]}` }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.customer?.name}</div>
                    <div style={{ fontSize: 11, color: '#666660', marginTop: 2 }}>{b.event_type} · {b.venue}</div>
                    <div style={{ fontSize: 11, color: '#666660' }}>{b.guest_count} guests · ₹{b.estimated_cost.toLocaleString()}</div>
                    <div style={{ marginTop: 6 }}><StatusPill status={b.status} /></div>
                  </div>
                ))}
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: eventColors[i % eventColors.length] }}>{format(parseISO(b.event_date), 'd')}</div>
                    <div style={{ fontSize: 9, color: '#888880' }}>{format(parseISO(b.event_date), 'MMM')}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.customer?.name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>{b.event_type} · {b.guest_count}g</div>
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

const topbar: React.CSSProperties = { background: '#FFFFFF', borderBottom: '0.5px solid #E5E5E0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };

export default CalendarPage;
