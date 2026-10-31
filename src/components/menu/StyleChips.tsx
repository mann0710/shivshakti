import React from 'react';
import { FOOD_STYLES, cleanStyles } from '../../lib/foodStyles';
import '../../styles/menu-sheet.css';

// Food style chips: Jain green, Swaminarayan orange, onion / garlic red.
const StyleChips: React.FC<{ styles?: string[] | null }> = ({ styles }) => {
  const list: string[] = cleanStyles(styles);
  if (!list.length) return null;
  return (
    <span className="ms-chips">
      {FOOD_STYLES.filter(s => list.includes(s.id)).map(s => <span key={s.id} className={`ms-chip ${s.cls}`}>{s.label}</span>)}
    </span>
  );
};

export default StyleChips;
