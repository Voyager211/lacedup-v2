import { describe, expect, it } from 'vitest';
import { formatDate, formatINR, formatNumber, truncate } from './format';

describe('formatINR', () => {
  it('groups in the Indian system, not thousands', () => {
    // 12,34,567 - not 1,234,567. This is the whole reason the app cannot use
    // a default Intl locale.
    expect(formatINR(1234567)).toBe('₹12,34,567');
  });

  it('drops the decimals on whole amounts', () => {
    expect(formatINR(1299)).toBe('₹1,299');
  });

  it('pads to paise when the amount is fractional', () => {
    expect(formatINR(1299.5)).toBe('₹1,299.50');
  });

  it('renders zero rather than treating it as missing', () => {
    expect(formatINR(0)).toBe('₹0');
  });

  it.each([null, undefined, NaN])('renders a dash for %s', (value) => {
    expect(formatINR(value)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('groups without a currency symbol', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
  });
});

describe('formatDate', () => {
  const date = new Date('2026-03-09T10:30:00Z');

  it('defaults to a short day-first date', () => {
    expect(formatDate(date)).toMatch(/9 Mar 2026/);
  });

  it('accepts an ISO string', () => {
    expect(formatDate('2026-03-09T10:30:00Z')).toMatch(/9 Mar 2026/);
  });

  it('renders a dash for an unparseable value', () => {
    expect(formatDate('not a date')).toBe('—');
  });

  it.each([null, undefined])('renders a dash for %s', (value) => {
    expect(formatDate(value)).toBe('—');
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('Air Max 90', 20)).toBe('Air Max 90');
  });

  it('cuts on a word boundary when there is a sensible one', () => {
    expect(truncate('Nike Air Max 90 Essential White', 20)).toBe('Nike Air Max 90…');
  });

  it('cuts mid-word rather than losing most of the text', () => {
    expect(truncate('Supercalifragilistic', 10)).toBe('Supercalif…');
  });
});
