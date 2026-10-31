import React from 'react';
import { plural } from '../../lib/menuCatalog';
import '../../styles/menu-sheet.css';

export interface Mode { sheet: boolean; onChange: (sheet: boolean) => void }

// View / Edit as sheet switch for one subcategory's dishes.
export const ModeToggle: React.FC<Mode> = ({ sheet, onChange }) => (
  <div role="group" aria-label="Mode" className="ms-seg">
    <button type="button" aria-pressed={!sheet} onClick={() => sheet && onChange(false)}>View</button>
    <button type="button" aria-pressed={sheet} onClick={() => !sheet && onChange(true)}>Edit as sheet</button>
  </div>
);

interface Props { crumb: string; title: string; count: number; mode?: Mode; children?: React.ReactNode }

// Title row of the dish panel, shared by the list and the sheet.
const PanelHead: React.FC<Props> = ({ crumb, title, count, mode, children }) => (
  <div className="mb-panel-head">
    <div>{crumb && <span className="mb-crumb">{crumb} ›</span>}<h2>{title} <small>· {plural(count, 'dish', 'dishes')}</small></h2></div>
    {mode && <ModeToggle {...mode} />}
    {children}
  </div>
);

export default PanelHead;
