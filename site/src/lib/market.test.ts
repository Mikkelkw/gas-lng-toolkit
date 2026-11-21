import { describe, expect, it } from 'vitest';
import { overlayMarket } from './market';
import { assumptionItems } from './assumptions';

describe('overlayMarket', () => {
  it('returns defaults unchanged when there is no market file', () => {
    expect(overlayMarket(assumptionItems, null)).toEqual(assumptionItems);
  });

  it('replaces Henry Hub and EUR/USD with newer valid values only', () => {
    const out = overlayMarket(assumptionItems, {
      updated: '2099-01-02',
      henryHub: { value: 4.2, asOf: '2099-01-01', source: 'EIA' },
      eurusd: { value: 1.2, asOf: '2000-01-01', source: 'ECB' }, // older than default: ignored
    });
    expect(out.henryHub.value).toBe(4.2);
    expect(out.henryHub.asOf).toBe('2099-01-01');
    expect(out.eurusd).toEqual(assumptionItems.eurusd);
    expect(out.ttf).toEqual(assumptionItems.ttf);
  });

  it('ignores invalid values', () => {
    const out = overlayMarket(assumptionItems, {
      updated: '2099-01-02',
      henryHub: { value: Number.NaN, asOf: '2099-01-01', source: 'EIA' },
      eurusd: { value: 1.1, asOf: 'yesterday', source: 'ECB' },
    });
    expect(out.henryHub).toEqual(assumptionItems.henryHub);
    expect(out.eurusd).toEqual(assumptionItems.eurusd);
  });
});
