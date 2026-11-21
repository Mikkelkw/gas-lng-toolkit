import { describe, expect, it } from 'vitest';
import model from '../../../data/model.json';
import {
  addDays,
  backtestErrors,
  biasNote,
  completeWinters,
  daysBetween,
  hdd,
  likelyRange,
  meanOfLast,
  normalHdd,
  project,
  seasonIndex,
  storageHeadline,
  uncertaintyPp,
  winterDays,
  winterLabel,
  winterOf,
  winterRange,
  type ProjectionInput,
  type StorageSeries,
} from './storage';

const coef = { a: model.coefficients.a.value, b: model.coefficients.b.value, c: model.coefficients.c.value };

describe('parity with pipeline/model.py', () => {
  it('reproduces the Python projection in data/model.json exactly', () => {
    const p = model.parity.inputs;
    const path = project({
      startDay: p.startDay,
      startStorage: p.startStorage,
      wgv: p.wgv,
      endDay: p.endDay,
      coef,
      normals: model.normals.temps,
      forecast: p.forecast,
      recentLng: p.recentLng,
      dailyDemand: p.dailyDemand,
      scenario: p.scenario,
    });
    expect(path).toHaveLength(model.parity.expected.days);
    expect(path[path.length - 1].storage).toBeCloseTo(model.parity.expected.endStorage, 9);
    for (const [day, v] of Object.entries(model.parity.expected.storageAt)) {
      expect(path.find((x) => x.day === day)!.storage).toBeCloseTo(v as number, 9);
    }
  });
});

describe('helpers', () => {
  it('hdd and normal hdd', () => {
    expect(hdd(20)).toBe(0);
    expect(hdd(5.5)).toBe(10);
    expect(normalHdd({ '01-15': [10, 20] }, '01-15', 0)).toBeCloseTo(2.75);
    expect(normalHdd({ '01-15': [10, 20] }, '01-15', -5)).toBeCloseTo(5.5);
    expect(normalHdd({ '02-28': [5.5] }, '02-29', 0)).toBeCloseTo(10);
  });
  it('dates', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2025-10-01', '2026-03-31')).toBe(181);
  });
  it('winters', () => {
    expect(winterOf('2026-11-19')).toBe(2026);
    expect(winterOf('2027-02-01')).toBe(2026);
    expect(winterOf('2026-06-01')).toBeNull();
    expect(winterLabel(2026)).toBe('2026/27');
    expect(winterDays(2027)).toHaveLength(183);
    expect(seasonIndex('2026-10-01')).toBe(0);
    expect(() => seasonIndex('2026-06-01')).toThrow(RangeError);
  });
  it('meanOfLast skips nulls', () => {
    expect(meanOfLast([1, null, 3, 5], 2)).toBe(4);
    expect(Number.isNaN(meanOfLast([null], 2))).toBe(true);
  });
  it('headline wording', () => {
    const h = storageHeadline({ day: '2027-03-31', storage: 401.6, full: 35.46, withdrawal: 0, hdd: 0 }, '2027-03-31');
    expect(h).toBe('Projected 31 March storage: 35.5% (402 TWh) under this scenario');
    expect(h).not.toContain('—');
  });
  it('headline with a likely range keeps the SPEC wording first', () => {
    const end = { day: '2027-03-31', storage: 401.6, full: 35.46, withdrawal: 0, hdd: 0 };
    const h = storageHeadline(end, '2027-03-31', likelyRange(35.46, 2.5));
    expect(h).toBe('Projected 31 March storage: 35.5% (402 TWh) under this scenario, likely range 33.0 to 38.0%');
  });
});

describe('model uncertainty from the back-test', () => {
  const cases = [
    { start: '2025-10-01', actualWeather: { errorPp: 5.2 }, normalWeather: { errorPp: 5.5 } },
    { start: '2025-11-01', actualWeather: { errorPp: 3.3 }, normalWeather: { errorPp: 2.8 } },
    { start: '2026-01-01', actualWeather: { errorPp: 1.5 }, normalWeather: { errorPp: -0.9 } },
  ];
  const pts = backtestErrors(cases, '2026-03-31');

  it('one point per case, by days left, larger error of the two runs with its sign', () => {
    expect(pts).toEqual([
      { daysLeft: 90, errorPp: 1.5 },
      { daysLeft: 151, errorPp: 3.3 },
      { daysLeft: 182, errorPp: 5.5 },
    ]);
  });

  it('half-width is zero at 31 March, linear between points, flat beyond the longest horizon', () => {
    expect(uncertaintyPp(pts, 0)).toBe(0);
    expect(uncertaintyPp(pts, 45)).toBeCloseTo(0.75, 10);
    expect(uncertaintyPp(pts, 90)).toBeCloseTo(1.5, 10);
    expect(uncertaintyPp(pts, 120.5)).toBeCloseTo(2.4, 10);
    expect(uncertaintyPp(pts, 182)).toBeCloseTo(5.5, 10);
    expect(uncertaintyPp(pts, 250)).toBeCloseTo(5.5, 10);
    expect(uncertaintyPp([], 100)).toBe(0);
  });

  it('uses absolute errors, so a negative error still widens the band', () => {
    expect(uncertaintyPp([{ daysLeft: 100, errorPp: -2 }], 50)).toBeCloseTo(1, 10);
  });

  it('range is symmetric (no bias correction) and kept within 0 to 100%', () => {
    expect(likelyRange(19.6, 2.2)).toEqual({ low: 19.6 - 2.2, high: 19.6 + 2.2 });
    expect(likelyRange(1.0, 2.5).low).toBe(0);
    expect(likelyRange(99, 2.5).high).toBe(100);
  });

  it("bias note states the direction and size of last winter's error", () => {
    expect(biasNote(pts, '2025/26')).toBe(
      'The model under-predicted withdrawals last winter (2025/26): run from 1 October, it left 5.5 points too much gas in storage at 31 March. The range is not bias-corrected.',
    );
    expect(biasNote([{ daysLeft: 182, errorPp: -3 }], '2025/26')).toContain('over-predicted withdrawals');
    expect(biasNote([], '2025/26')).toBe('');
    expect(biasNote(pts, '2025/26')).not.toContain('—');
  });

  it('runs on the real back-test in model.json', () => {
    const real = backtestErrors(model.backtest.cases, `${Number(model.backtest.winter.slice(0, 4)) + 1}-03-31`);
    expect(real.length).toBeGreaterThan(0);
    expect(uncertaintyPp(real, 132)).toBeGreaterThan(0);
  });
});

describe('projection rules', () => {
  const base: ProjectionInput = {
    startDay: '2026-01-01',
    startStorage: 500,
    wgv: 1000,
    endDay: '2026-01-10',
    coef: { a: 1, b: 0, c: 0 },
    normals: Object.fromEntries(Array.from({ length: 31 }, (_, k) => [`01-${String(k + 1).padStart(2, '0')}`, [10]])),
    forecast: {},
    recentLng: 4,
    dailyDemand: 10,
    scenario: { tempDelta: 0, lngPct: 0, disruptionTwh: 0, demandResponsePct: 0 },
  };
  it('constant withdrawal from the day after the start', () => {
    const p = project(base);
    expect(p[0].day).toBe('2026-01-02');
    expect(p[p.length - 1].storage).toBeCloseTo(491);
  });
  it('forecast days ignore the temperature shift', () => {
    const p = project({ ...base, coef: { a: 0, b: 1, c: 0 }, forecast: { '2026-01-02': 5.5 }, scenario: { ...base.scenario, tempDelta: -3 } });
    expect(p[0].hdd).toBeCloseTo(10);
    expect(p[1].hdd).toBeCloseTo(8.5);
  });
  it('colder weather, LNG shortfall and disruption all lower the end level; demand response raises it', () => {
    const end = (s: Partial<ProjectionInput['scenario']>, c = { a: 0.5, b: 0.5, c: -0.5 }) =>
      project({ ...base, coef: c, scenario: { ...base.scenario, ...s } }).at(-1)!.storage;
    const ref = end({});
    expect(end({ tempDelta: -2 })).toBeLessThan(ref);
    expect(end({ lngPct: -20 })).toBeLessThan(ref);
    expect(end({ disruptionTwh: 0.3 })).toBeLessThan(ref);
    expect(end({ demandResponsePct: 10 })).toBeGreaterThan(ref);
  });
  it('disruption window respects start and duration', () => {
    const p = project({
      ...base,
      coef: { a: 0, b: 0, c: 0 },
      scenario: { ...base.scenario, disruptionTwh: 0.4, disruptionStart: '2026-01-03', disruptionDays: 2 },
    });
    expect(p.map((x) => x.withdrawal)).toEqual([0, 0.4, 0.4, 0, 0, 0, 0, 0, 0]);
  });
  it('clamps to [0, capacity]', () => {
    expect(project({ ...base, startStorage: 3 }).at(-1)!.storage).toBe(0);
    expect(project({ ...base, startStorage: 995, coef: { a: -50, b: 0, c: 0 } }).at(-1)!.storage).toBe(1000);
  });
});

describe('winter range', () => {
  // Two complete winters with constant fill levels 40% and 60%.
  const days = [...winterDays(2023), ...winterDays(2024)];
  const series: StorageSeries = {
    days,
    full_pct: days.map((d) => (winterOf(d) === 2023 ? 40 : 60)),
    storage_twh: days.map(() => 0),
    lng_sendout_twh: days.map(() => 1),
  };
  it('finds complete winters', () => {
    expect(completeWinters(series)).toEqual([2023, 2024]);
    expect(completeWinters({ ...series, days: days.slice(1) })).toEqual([2024]);
  });
  it('maps min, max and average onto the target winter dates, including 29 Feb', () => {
    const r = winterRange(series, [2023, 2024], 2027);
    expect(r).toHaveLength(183);
    expect(r[0]).toEqual({ day: '2027-10-01', min: 40, max: 60, avg: 50 });
    const feb29 = r.find((x) => x.day === '2028-02-29')!;
    expect(feb29.min).toBe(40); // 2024 has 29 Feb; 2025 falls back to 28 Feb
    expect(feb29.max).toBe(60);
  });
});
