import { describe, expect, it } from 'vitest';
import { DATA_STALE_HOURS, dataAgeText, isDataStale } from './dataAge';

describe('data refresh staleness', () => {
  const updated = '2026-11-21T10:50:03+00:00';

  it('is fresh up to 36 hours, stale after', () => {
    expect(DATA_STALE_HOURS).toBe(36);
    expect(isDataStale(updated, new Date('2026-11-22T22:50:03Z'))).toBe(false);
    expect(isDataStale(updated, new Date('2026-11-22T22:50:04Z'))).toBe(true);
    expect(isDataStale(updated, new Date('2026-11-21T11:00:00Z'))).toBe(false);
  });

  it('unknown or unparseable dates never show the notice', () => {
    expect(isDataStale(null, new Date())).toBe(false);
    expect(isDataStale(undefined, new Date())).toBe(false);
    expect(isDataStale('not a date', new Date())).toBe(false);
  });

  it('notice gives the date and UTC time, no em-dashes', () => {
    expect(dataAgeText(updated)).toBe('Data last refreshed 21 Nov 2026, 10:50 UTC.');
    expect(dataAgeText(updated)).not.toContain('—');
  });
});
