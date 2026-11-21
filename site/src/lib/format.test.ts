import { describe, expect, it } from 'vitest';
import { fmt, fmtSigned } from './format';

describe('fmt', () => {
  it('formats with fixed decimals and thousands separators', () => {
    expect(fmt(1234.5)).toBe('1,234.50');
    expect(fmt(3, 0)).toBe('3');
  });
  it('uses a minus sign for negatives, but not for values that round to zero', () => {
    expect(fmt(-1.234)).toBe('−1.23');
    expect(fmt(-0.001)).toBe('0.00');
  });
  it('returns n/a for non-finite values', () => {
    expect(fmt(NaN)).toBe('n/a');
    expect(fmt(Infinity)).toBe('n/a');
  });
});

describe('fmtSigned', () => {
  it('adds a plus sign to positives only', () => {
    expect(fmtSigned(0.5)).toBe('+0.50');
    expect(fmtSigned(-0.5)).toBe('−0.50');
    expect(fmtSigned(0)).toBe('0.00');
  });
});
