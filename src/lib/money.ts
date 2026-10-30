// Indian-style currency helpers shared by screens, receipts and PDFs.

export const inr = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export type DiscountType = 'amount' | 'percentage';

export function discountValue(subtotal: number, value: number | string, type: DiscountType): number {
  const d = Math.max(0, Number(value) || 0);
  const amt = type === 'percentage' ? Math.round((subtotal * Math.min(d, 100)) / 100) : d;
  return Math.min(amt, subtotal);
}

// Keeps the last 10 digits of an Indian mobile number.
export const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10);
export const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(cleanPhone(p));
