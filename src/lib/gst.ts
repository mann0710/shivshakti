// GST helpers for tax invoices: GSTIN checks, CGST/SGST vs IGST split, amount in words.

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const cleanGstin = (v: string) => v.replace(/\s/g, '').toUpperCase();
export const isValidGstin = (v: string) => GSTIN_RE.test(cleanGstin(v));

// First two digits of a GSTIN are the state code.
const stateOf = (gstin?: string | null) => (gstin && isValidGstin(gstin) ? cleanGstin(gstin).slice(0, 2) : '');

export type TaxLine = { label: string; amount: number };

// Same state (or unknown buyer state) → CGST + SGST halves; different state → IGST.
export const taxSplit = (gstAmount: number, rate: number, shopGstin?: string | null, buyerGstin?: string | null): TaxLine[] => {
  if (!(gstAmount > 0)) return [];
  const shop = stateOf(shopGstin);
  const buyer = stateOf(buyerGstin);
  if (shop && buyer && shop !== buyer) return [{ label: `IGST @${rate}%`, amount: gstAmount }];
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const half = rate / 2;
  return [
    { label: `CGST @${half}%`, amount: cgst },
    { label: `SGST @${half}%`, amount: Math.round((gstAmount - cgst) * 100) / 100 },
  ];
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const threeDigits = (n: number) => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
};

// Indian system: crore, lakh, thousand, hundred.
const integerWords = (n: number): string => {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  if (crore) parts.push(`${integerWords(crore)} Crore`);
  const lakh = Math.floor((n % 1e7) / 1e5);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  const thousand = Math.floor((n % 1e5) / 1e3);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  const rest = n % 1e3;
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
};

// e.g. 102750.5 → "Rupees One Lakh Two Thousand Seven Hundred Fifty and Fifty Paise Only"
export const amountInWords = (amount: number) => {
  const total = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(total / 100);
  const paise = total % 100;
  return `Rupees ${integerWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
};
