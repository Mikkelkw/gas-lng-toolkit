import { describe, expect, it } from 'vitest';
import { computeNetbacks } from './netback';
import { defaultInputs, defaultRoutes } from './assumptions';
import { breakevenSentence, headline, marginWarning } from './netbackText';

describe('netback text', () => {
  it('headline names the best route and the gap to the other market', () => {
    const res = computeNetbacks(defaultInputs, defaultRoutes);
    const gap = Math.abs(res.arb).toFixed(2);
    expect(headline(res)).toBe(`Best destination: Northwest Europe, direct, by $${gap}/MMBtu`);
  });

  it('headline for an Asia win uses the route', () => {
    const res = computeNetbacks({ ...defaultInputs, jkm: 40 }, defaultRoutes);
    expect(headline(res)).toMatch(/^Best destination: North Asia via Panama, by \$\d+\.\d\d\/MMBtu$/);
  });

  it('breakeven sentence says which way JKM must move', () => {
    const res = computeNetbacks(defaultInputs, defaultRoutes);
    expect(breakevenSentence(res, defaultInputs.jkm)).toContain('would need to rise by');
    const res2 = computeNetbacks({ ...defaultInputs, jkm: 40 }, defaultRoutes);
    expect(breakevenSentence(res2, 40)).toContain('would need to fall by');
  });

  it('margin warning only when no route covers the cost of supply', () => {
    expect(marginWarning(computeNetbacks(defaultInputs, defaultRoutes))).toBe('');
    const low = computeNetbacks({ ...defaultInputs, ttf: 5, jkm: 2 }, defaultRoutes);
    expect(marginWarning(low)).toMatch(/^No route covers the cost of supply/);
  });

  it('never uses em-dashes (site style rule)', () => {
    const res = computeNetbacks(defaultInputs, defaultRoutes);
    for (const s of [headline(res), breakevenSentence(res, 27), marginWarning(computeNetbacks({ ...defaultInputs, ttf: 5, jkm: 2 }, defaultRoutes))]) {
      expect(s).not.toContain('—');
    }
  });
});
