import React, { useEffect, useRef } from 'react';
import { PERIODS, Period } from '../../lib/moneyView';
import { Range } from '../../lib/reports/model';
import { todayIST } from '../../lib/ist';

interface Props { value: Period; onChange: (p: Period) => void; custom: Range; onCustom: (r: Range) => void; seasonName?: string }

// Today · This week · This month · This season · This year · Pick dates.
const PeriodPicker: React.FC<Props> = ({ value, onChange, custom, onCustom, seasonName }) => {
  const box = useRef<HTMLDivElement>(null);
  // Phones scroll the chips sideways: keep the picked one in view.
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (box.current && el && box.current.scrollWidth > box.current.clientWidth) box.current.scrollLeft = el.offsetLeft - box.current.offsetLeft - 16;
  }, [value]);
  return (
    <>
      <div ref={box} role="radiogroup" aria-label="Period" className="mx-seg">
        {PERIODS.filter(([p]) => p !== 'season' || seasonName).map(([p, label]) => (
          <button key={p} type="button" role="radio" aria-checked={value === p} title={p === 'season' ? seasonName : undefined} onClick={() => onChange(p)}>{label}</button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="mx-dates">
          <input type="date" aria-label="From" value={custom.from} max={todayIST()} onChange={e => onCustom({ ...custom, from: e.target.value })} />
          <span>to</span>
          <input type="date" aria-label="To" value={custom.to} max={todayIST()} onChange={e => onCustom({ ...custom, to: e.target.value })} />
        </div>
      )}
    </>
  );
};

export default PeriodPicker;
