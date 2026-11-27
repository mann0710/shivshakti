import React from 'react';
import { inr } from '../../lib/money';

interface Props { full: number; price: number; hidden: boolean; onShow: (show: boolean) => void }

// "Discount on the PDF" tick, shown once a full price is above the plate price (meal cards and one-meal quotes).
const DiscountTick: React.FC<Props> = ({ full, price, hidden, onShow }) => (full > price ? (
  <label className="q-check">
    <input type="checkbox" checked={!hidden} onChange={e => onShow(e.target.checked)} />
    <span className="t"><b>Discount on the PDF</b>
      <small>{hidden ? `Off: the PDF shows ${inr(price)} a plate only` : `Shows ${inr(full)} struck through, then ${inr(price)} a plate, and what they save`}</small></span>
  </label>
) : null);

export default DiscountTick;
