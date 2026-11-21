import { describe, expect, it } from 'vitest';
import { assumptionItems } from './assumptions';
import { STALE_AFTER_DAYS, ageInDays, priceNotice, todayUtc } from './priceAge';

describe('manual price age notice', () => {
  it('counts whole UTC days and never goes negative', () => {
    expect(ageInDays('2026-11-20', '2026-11-20')).toBe(0);
    expect(ageInDays('2026-11-20', '2026-11-27')).toBe(7);
    expect(ageInDays('2026-11-20', '2026-11-19')).toBe(0);
    expect(todayUtc(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-21');
  });

  it('is not stale up to 7 days, stale from day 8', () => {
    expect(STALE_AFTER_DAYS).toBe(7);
    expect(priceNotice(['2026-11-20'], '2026-11-27').stale).toBe(false);
    expect(priceNotice(['2026-11-20'], '2026-11-28').stale).toBe(true);
  });

  it('uses the older of the TTF and JKM dates', () => {
    const n = priceNotice(['2026-11-20', '2026-11-10'], '2026-11-20');
    expect(n.asOf).toBe('2026-11-10');
    expect(n.ageDays).toBe(10);
    expect(n.stale).toBe(true);
  });

  it('wording', () => {
    expect(priceNotice(['2026-11-20'], '2026-11-21').text).toBe(
      'Prices last updated 20 Nov 2026 (1 day ago). TTF and JKM defaults are entered manually.',
    );
    const stale = priceNotice(['2026-11-20'], '2026-11-30').text;
    expect(stale).toBe(
      'Prices last updated 20 Nov 2026, 10 days ago. The TTF and JKM defaults are entered manually and may be out of date. Enter current levels.',
    );
    expect(stale).not.toContain('—');
  });

  it('works on the shipped defaults', () => {
    const n = priceNotice([assumptionItems.ttf.asOf, assumptionItems.jkm.asOf], assumptionItems.ttf.asOf);
    expect(n.stale).toBe(false);
  });
});
