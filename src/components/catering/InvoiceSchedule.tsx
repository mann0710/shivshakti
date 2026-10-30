import React from 'react';
import { formatDateIST } from '../../lib/ist';
import { ORANGE } from './InvoiceUi';

interface Props { days: any[]; onGuests: (dayIndex: number, mealIndex: number, guests: number) => void }

// Multi-day schedule with editable final guest counts per meal.
const InvoiceSchedule: React.FC<Props> = ({ days, onGuests }) => (
  <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
    <div style={head}>EVENT SCHEDULE · final guest counts</div>
    {days.map((day: any, di: number) => (
      <div key={di} style={{ borderBottom: di < days.length - 1 ? '0.5px solid #E5E5E0' : 'none' }}>
        <div style={{ padding: '8px 12px 4px', fontWeight: 600, fontSize: 12, color: ORANGE, background: '#FFFBF5' }}>
          Day {day.day_number}{day.date ? ` — ${formatDateIST(day.date, 'dd-MM-yyyy')}` : ''}
        </div>
        {(day.meals as any[]).map((meal: any, mi: number) => (
          <div key={mi} style={{ padding: '6px 12px', borderTop: '0.5px solid #F5F5F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#333', textTransform: 'capitalize' }}>{meal.meal_type}{meal.time ? ` (${meal.time})` : ''}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: ORANGE }}>₹{(meal.subtotal || 0).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 11, color: '#888880', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <input type="number" min={1} inputMode="numeric" value={meal.guest_count} aria-label="Guests"
                onChange={e => onGuests(di, mi, parseInt(e.target.value, 10) || 1)}
                style={{ width: 64, padding: '2px 6px', borderRadius: 5, border: '0.5px solid #D0D0CC', fontSize: 12, textAlign: 'right' }} />
              <span>guests × ₹{meal.per_plate_amount}/plate</span>
            </div>
            {(meal.items as any[]).map((item: any, ii: number) => (
              <div key={ii} style={{ fontSize: 11, color: '#666660', paddingLeft: 8, paddingTop: 1 }}>· {item.item_name}</div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: '#F9F8F5', borderTop: '0.5px solid #E5E5E0' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>Day {day.day_number} subtotal</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18' }}>₹{(day.day_subtotal || 0).toLocaleString()}</span>
        </div>
      </div>
    ))}
  </div>
);

const head: React.CSSProperties = { padding: '7px 12px', background: '#F9F8F5', fontSize: 11, fontWeight: 600, color: '#888880', borderBottom: '0.5px solid #E5E5E0' };

export default InvoiceSchedule;
