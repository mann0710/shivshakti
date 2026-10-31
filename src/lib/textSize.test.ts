import { readTextSize, saveTextSize, stepTextSize, textSizeLabel } from './textSize';

describe('text size on this device', () => {
  beforeEach(() => localStorage.clear());
  it('steps within 85–140% and labels it', () => {
    expect(stepTextSize(1, 1)).toBe(1.1);
    expect(stepTextSize(0.85, -1)).toBe(0.85);
    expect(stepTextSize(1.4, 1)).toBe(1.4);
    expect(textSizeLabel(1.1)).toBe('110%');
  });
  it('saves on this device, applies it to the page, and 100% clears the setting', () => {
    expect(readTextSize()).toBe(1);
    saveTextSize(1.2);
    expect(readTextSize()).toBe(1.2);
    expect(document.documentElement.style.getPropertyValue('--text-size')).toBe('1.2');
    saveTextSize(1);
    expect(localStorage.getItem('shivshakti.textSize')).toBeNull();
  });
  it('snaps an odd saved value to the nearest step', () => {
    localStorage.setItem('shivshakti.textSize', '1.17');
    expect(readTextSize()).toBe(1.2);
  });
});
