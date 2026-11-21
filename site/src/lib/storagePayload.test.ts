import { describe, expect, it } from 'vitest';
import model from '../../../data/model.json';
import { buildStoragePayload, type ModelFile, type StorageFile, type WeatherFile } from './storagePayload';
import { addDays, winterDays } from './storage';

function storageFile(asOf: string): StorageFile {
  const days: string[] = [];
  for (let d = '2019-10-01'; d <= asOf; d = addDays(d, 1)) days.push(d);
  return {
    updated: '2026-11-21T10:00:00+00:00',
    asOf,
    workingGasVolumeTwh: 1130,
    annualConsumptionTwh: 3650,
    days,
    full_pct: days.map(() => 50),
    storage_twh: days.map((_, k) => 500 + k * 0),
    net_withdrawal_twh: days.map(() => 1),
    lng_sendout_twh: days.map((_, k) => (k % 2 ? 4 : 2)),
  };
}

const weather: WeatherFile = {
  updated: '2026-11-21T10:00:00+00:00',
  observed: { days: ['2026-11-19', '2026-11-20'], temp_c: [3, 4] },
  forecast: { days: ['2026-11-21', '2026-11-22'], temp_c: [5, 6] },
};

describe('buildStoragePayload', () => {
  it('builds the current winter with a 5-winter range and forecast after the last gas day', () => {
    const p = buildStoragePayload(storageFile('2026-11-19'), weather, model as unknown as ModelFile, null);
    expect(p.winter).toBe(2026);
    expect(p.winterLabel).toBe('2026/27');
    expect(p.endDay).toBe('2027-03-31');
    expect(p.actual[0].day).toBe('2026-10-01');
    expect(p.actual.at(-1)!.day).toBe('2026-11-19');
    expect(p.rangeWinters).toEqual(['2021/22', '2022/23', '2023/24', '2024/25', '2025/26']);
    expect(p.range).toHaveLength(winterDays(2026).length);
    expect(p.forecast).toEqual({ '2026-11-20': 4, '2026-11-21': 5, '2026-11-22': 6 });
    expect(p.forecastEnd).toBe('2026-11-22');
    expect(p.recentLng).toBe(3);
    expect(p.dailyDemand).toBe(10);
    expect(p.staleNote).toBeNull();
  });

  it('flags stale data when the last refresh failed', () => {
    const p = buildStoragePayload(storageFile('2026-11-19'), weather, model as unknown as ModelFile, {
      storage: { ok: false, error: 'x' },
    });
    expect(p.staleNote).toContain('2026-11-19');
  });

  it('falls back to the last complete winter outside October to March', () => {
    const p = buildStoragePayload(storageFile('2026-06-15'), weather, model as unknown as ModelFile, null);
    expect(p.winter).toBeNull();
    expect(p.winterLabel).toBe('2025/26');
  });
});
