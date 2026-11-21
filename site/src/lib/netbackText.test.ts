import { describe, expect, it } from 'vitest';
import { computeNetbacks } from './netback';
import { defaultInputs, defaultRoutes } from './assumptions';
import { MARGIN_EXPLAINER, breakevenSentence, headline, marginWarning } from './netbackText';

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

  it('margin warning only when no route covers the full cost of supply', () => {
    expect(marginWarning(computeNetbacks(defaultInputs, defaultRoutes))).toBe('');
    const low = computeNetbacks({ ...defaultInputs, ttf: 5, jkm: 2 }, defaultRoutes);
    expect(low.best.liftMargin).toBeLessThan(0);
    expect(marginWarning(low)).toMatch(/^No route covers the full cost of supply/);
    expect(marginWarning(low)).toContain('cancelling beats lifting');
  });

  it('margin warning says lifting still pays when only the fee is uncovered', () => {
    // TTF 18 €/MWh is about $5.80/MMBtu: below the full cost of $6.32, above feedgas of $3.57.
    const res = computeNetbacks({ ...defaultInputs, ttf: 18, jkm: 5 }, defaultRoutes);
    expect(res.best.margin).toBeLessThan(0);
    expect(res.best.liftMargin).toBeGreaterThan(0);
    expect(marginWarning(res)).toContain('lifting still beats cancelling');
  });

  it('never uses em-dashes (site style rule)', () => {
    const res = computeNetbacks(defaultInputs, defaultRoutes);
    for (const s of [headline(res), breakevenSentence(res, 27), marginWarning(computeNetbacks({ ...defaultInputs, ttf: 5, jkm: 2 }, defaultRoutes)), marginWarning(computeNetbacks({ ...defaultInputs, ttf: 18, jkm: 5 }, defaultRoutes)), MARGIN_EXPLAINER]) {
      expect(s).not.toContain('—');
    }
  });
});
