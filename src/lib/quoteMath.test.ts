import { dayNet, mealNet, mealSavings } from './quoteMath';

const lunch = { per_plate_amount: 500, discount_amount: 450, guest_count: 100, subtotal: 50000 };
const dinner = { per_plate_amount: 400, discount_amount: 0, guest_count: 50, subtotal: 20000 };

test('meal and day totals use the offer rate when set', () => {
  expect(mealNet(lunch)).toBe(45000);
  expect(mealNet(dinner)).toBe(20000);
  expect(dayNet({ meals: [lunch, dinner] })).toBe(65000);
  expect(mealSavings([{ meals: [lunch, dinner] }])).toBe(5000);
});
