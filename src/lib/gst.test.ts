import { amountInWords, isValidGstin, taxSplit } from './gst';

const GUJ = '24AAACS1234A1Z5';
const MAH = '27AAACS1234A1Z5';

test('validates GSTIN format', () => {
  expect(isValidGstin(GUJ)).toBe(true);
  expect(isValidGstin(' 24aaacs1234a1z5 ')).toBe(true);
  expect(isValidGstin('24AAACS1234A1Z')).toBe(false);
});

test('splits GST into CGST + SGST within the state or for unregistered buyers', () => {
  expect(taxSplit(5000, 5, GUJ, GUJ)).toEqual([{ label: 'CGST @2.5%', amount: 2500 }, { label: 'SGST @2.5%', amount: 2500 }]);
  expect(taxSplit(101, 18, GUJ, '')).toEqual([{ label: 'CGST @9%', amount: 50.5 }, { label: 'SGST @9%', amount: 50.5 }]);
});

test('uses IGST for a buyer in another state', () => {
  expect(taxSplit(1800, 18, GUJ, MAH)).toEqual([{ label: 'IGST @18%', amount: 1800 }]);
  expect(taxSplit(0, 18, GUJ, MAH)).toEqual([]);
});

test('writes amounts in Indian words', () => {
  expect(amountInWords(0)).toBe('Rupees Zero Only');
  expect(amountInWords(102750)).toBe('Rupees One Lakh Two Thousand Seven Hundred Fifty Only');
  expect(amountInWords(12345678.5)).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Fifty Paise Only');
  expect(amountInWords(1015)).toBe('Rupees One Thousand Fifteen Only');
});
