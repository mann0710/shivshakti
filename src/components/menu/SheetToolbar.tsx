import React from 'react';
import '../../styles/menu-sheet.css';

export interface SheetAction { label: string; onClick: () => void }

interface Props { count: number; actions: SheetAction[]; onClear: () => void }

// Dark bar over the sheet while rows are picked; each action only changes the sheet until Review & save.
const SheetToolbar: React.FC<Props> = ({ count, actions, onClear }) => (
  <div role="group" aria-label="Selected dishes" className="ms-toolbar">
    <b>{count} selected</b>
    {actions.map(a => <button key={a.label} type="button" onClick={a.onClick}>{a.label}</button>)}
    <button type="button" className="clear" onClick={onClear}>Clear</button>
  </div>
);

export default SheetToolbar;
