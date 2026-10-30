import React, { useEffect, useState } from 'react';
import { useMenus } from '../../hooks/useMenus';
import { PickerItem } from './QuotationItemPanels';
import { inr } from '../../lib/money';

interface Props {
  menuItems: PickerItem[];
  bookingMenuId?: string | null;
  onApply: (items: PickerItem[], pricePerPlate: number, missing: string[]) => void;
}

const key = (s: string) => s.trim().toLowerCase();

// Fills a quote from a Package: its lines are matched to Menu Builder items by name.
const QuotationPackagePicker: React.FC<Props> = ({ menuItems, bookingMenuId, onApply }) => {
  const { data: menus = [] } = useMenus();
  const [menuId, setMenuId] = useState('');
  useEffect(() => { setMenuId(bookingMenuId || ''); }, [bookingMenuId]);
  if (menus.length === 0) return null;

  const apply = () => {
    const menu = menus.find(m => m.id === menuId);
    if (!menu) return;
    const byName = new Map(menuItems.map(it => [key(it.name), it]));
    const found: PickerItem[] = [];
    const missing: string[] = [];
    (menu.items || []).forEach(name => {
      const it = byName.get(key(name));
      if (it) found.push(it); else missing.push(name);
    });
    onApply(found, menu.price_per_plate, missing);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 12, color: '#666' }}>
      <span style={{ fontWeight: 600 }}>Start from package</span>
      <select value={menuId} onChange={e => setMenuId(e.target.value)} aria-label="Package"
        style={{ flex: '1 1 180px', minWidth: 0, padding: '5px 8px', borderRadius: 6, border: '0.5px solid #D0D0CC', fontSize: 12, background: '#fff' }}>
        <option value="">— choose a package —</option>
        {menus.map(m => <option key={m.id} value={m.id}>{m.name} ({inr(m.price_per_plate)}/plate)</option>)}
      </select>
      <button type="button" onClick={apply} disabled={!menuId}
        style={{ background: menuId ? '#E8750A' : '#E5E5E0', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: menuId ? 'pointer' : 'default' }}>
        Use package
      </button>
    </div>
  );
};

export default QuotationPackagePicker;
