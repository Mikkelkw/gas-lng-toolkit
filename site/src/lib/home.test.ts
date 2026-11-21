import { describe, expect, it } from 'vitest';
import model from '../../../data/model.json';
import { assumptionItems, defaultRoutes } from './assumptions';
import { netbackFigure, projectionFigure, storageFigure } from './home';
import { computeNetbacks, type NetbackInputs } from './netback';
import { project } from './storage';
import { buildStoragePayload, type ModelFile, type StorageFile, type WeatherFile } from './storagePayload';
import { addDays, daysBetween, likelyRange, uncertaintyPp } from './storage';

function storageFile(asOf: string): StorageFile {
  const days: string[] = [];
  for (let d = '2019-10-01'; d <= asOf; d = addDays(d, 1)) days.push(d);
  return {
    updated: '2026-11-21T10:00:00+00:00',
    asOf,
    workingGasVolumeTwh: 1130,
    annualConsumptionTwh: 3650,
    days,
    full_pct: days.map(() => 70),
    storage_twh: days.map(() => 791),
    net_withdrawal_twh: days.map(() => 1),
    lng_sendout_twh: days.map((_, k) => (k % 2 ? 4 : 2)),
  };
}
const weather: WeatherFile = {
  updated: '2026-11-21T10:00:00+00:00',
  observed: { days: ['2026-11-20'], temp_c: [4] },
  forecast: { days: ['2026-11-21', '2026-11-22'], temp_c: [5, 6] },
};

describe('landing page live figures', () => {
  it('storage figure shows the latest % full and its gas day', () => {
    const f = storageFigure({ asOf: '2026-11-19', full_pct: [70.1, 69.64] });
    expect(f.value).toBe('69.6% full');
    expect(f.dated).toBe('Gas day 19 Nov 2026');
    expect(storageFigure(null).value).toBe('n/a');
    expect(storageFigure(null).dated).toBeNull();
  });

  it('netback figure matches the calculator at default inputs and dates by the oldest price', () => {
    const f = netbackFigure(assumptionItems, defaultRoutes);
    const inputs = Object.fromEntries(Object.entries(assumptionItems).map(([k, v]) => [k, v.value])) as unknown as NetbackInputs;
    const res = computeNetbacks(inputs, defaultRoutes);
    expect(res.best.route.id).toBe('nwe');
    expect(f.value).toBe('Northwest Europe');
    expect(f.detail).toBe(`Ahead of the best Asia route by $${(res.europe.netback - res.bestAsia.netback).toFixed(2)}/MMBtu, default inputs.`);
    const oldest = [assumptionItems.henryHub, assumptionItems.ttf, assumptionItems.jkm, assumptionItems.eurusd].map((i) => i.asOf).sort()[0];
    expect(f.dated).toContain(new Date(`${oldest}T00:00:00Z`).getUTCFullYear().toString());
  });

  it('netback figure names the canal when Asia wins', () => {
    const items = { ...assumptionItems, jkm: { ...assumptionItems.jkm, value: 40 } };
    const f = netbackFigure(items, defaultRoutes);
    expect(f.value).toBe('North Asia via Panama');
    expect(f.detail).toMatch(/^Ahead of Europe by \$\d+\.\d\d\/MMBtu, default inputs\.$/);
  });

  it('projection figure equals the storage tool Normal run, with the likely range', () => {
    const p = buildStoragePayload(storageFile('2026-11-19'), weather, model as unknown as ModelFile, null);
    const f = projectionFigure(p);
    const end = project({
      startDay: p.asOf, startStorage: p.startStorage, wgv: p.wgv, endDay: p.endDay, coef: p.coef, normals: p.normals,
      forecast: p.forecast, recentLng: p.recentLng, dailyDemand: p.dailyDemand,
      scenario: { tempDelta: 0, lngPct: 0, disruptionTwh: 0, disruptionStart: null, disruptionDays: null, demandResponsePct: 0 },
    }).at(-1)!;
    const r = likelyRange(end.full, uncertaintyPp(p.errors, daysBetween(p.asOf, p.endDay)));
    expect(f.value).toBe(`${end.full.toFixed(1)}% full`);
    expect(f.detail).toBe(`Normal weather, likely range ${r.low.toFixed(1)} to ${r.high.toFixed(1)}%.`);
    expect(f.dated).toBe('From gas day 19 Nov 2026');
  });

  it('projection figure outside the winter says when it restarts', () => {
    const p = buildStoragePayload(storageFile('2027-06-15'), weather, model as unknown as ModelFile, null);
    expect(projectionFigure(p).value).toBe('From 1 October');
    expect(projectionFigure(null).dated).toBeNull();
  });

  it('never uses em-dashes', () => {
    const p = buildStoragePayload(storageFile('2026-11-19'), weather, model as unknown as ModelFile, null);
    for (const f of [storageFigure({ asOf: '2026-11-19', full_pct: [69.6] }), netbackFigure(assumptionItems, defaultRoutes), projectionFigure(p)]) {
      expect(JSON.stringify(f)).not.toContain('—');
    }
  });
});
