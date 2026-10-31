import { courseSummary, choiceNames, packageLines, packageDishes } from './packageMenu';

const farsan = { id: 'g', label: 'Farsan', pick: 1 };
const dish = (name: string, cat: string, extra: object = {}) => ({ item_id: name, item_name: name, category_name: cat, subcategory_name: cat, amount: 0, ...extra });
const items = [
  dish('Kaju Katli', 'Sweet'), dish('Paneer', 'Main Course'), dish('Dal', 'Main Course'),
  dish('South Boll', 'Farsan', { choice: farsan }), dish('Mix Bhajiya', 'Farsan', { choice: farsan, chosen: true }),
];
const menu = ['Kaju Katli', 'Paneer', 'Dal', 'South Boll', 'Mix Bhajiya'].map(name => ({ id: name, name }));

describe('quote menu as a package', () => {
  it('sums up the courses and names the choices', () => {
    expect(courseSummary(items)).toBe('Sweet · Main Course (2) · Farsan — choose 1 of 2');
    expect(choiceNames(items)).toEqual(['"choose 1 farsan"']);
  });

  it('keeps a choice as one course line, or lists the picked dish', () => {
    expect(packageLines(items, true)).toEqual(['Kaju Katli', 'Paneer', 'Dal', 'Farsan 1(South Boll / Mix Bhajiya)']);
    expect(packageLines(items, false)).toEqual(['Kaju Katli', 'Paneer', 'Dal', 'Mix Bhajiya']);
  });

  it('turns a kept choice back into a choose-1 group on a quote', () => {
    const { found, missing } = packageDishes([...packageLines(items, true), 'Sabji 2', 'Kheer 1(Kheer / Basundi)'], menu);
    expect(found.map(d => d.name)).toEqual(['Kaju Katli', 'Paneer', 'Dal', 'South Boll', 'Mix Bhajiya']);
    expect(found[3].choice).toMatchObject({ label: 'Farsan', pick: 1 });
    expect(found[3].choice).toBe(found[4].choice);
    expect(missing).toEqual(['Sabji 2', 'Kheer', 'Basundi']);
  });
});
