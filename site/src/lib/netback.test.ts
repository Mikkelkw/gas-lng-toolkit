import { describe, expect, it } from 'vitest';
import {
  breakevenCharter,
  breakevenJkm,
  charterSensitivity,
  computeNetbacks,
  costOfSupply,
  routeNetback,
  ttfToUsd,
  voyageDays,
  type NetbackInputs,
  type Route,
} from './netback';
import { defaultInputs, defaultRoutes } from './assumptions';

/*
 * Hand-calculated case (round numbers so it can be checked with a pen):
 *   Vessel 100,000 m3 x 20 MMBtu/m3          = 2,000,000 MMBtu loaded
 *   Distance 2,400 nm at 10 knots            = 2,400 / 240 = 10 laden days, 20 round trip
 *   Boil-off 0.1%/day x 10 days              = 1% lost, delivered 1,980,000 MMBtu
 *   Charter 50,000 x 20 days                 = 1,000,000
 *   Canal 100,000 x 2 transits               =   200,000
 *   Port costs                               =   180,000
 *   Voyage cost                              = 1,380,000 / 1,980,000 = 0.696970 $/MMBtu
 *   Boil-off cost at $10: 2,000,000 x 1% x 10 / 1,980,000 = 0.101010 $/MMBtu
 *   FOB netback = 10 - 0.696970 - 0.101010   = 9.202020 $/MMBtu
 *   Cost of supply = 115% x 3.00 + 2.50      = 5.95 $/MMBtu
 *   Margin = 9.202020 - 5.95                 = 3.252020 $/MMBtu
 *   TTF 30 EUR/MWh x 1.10 / 3.412            = 9.671747 $/MMBtu
 */
const hand: NetbackInputs = {
  henryHub: 3,
  ttf: 30,
  jkm: 10,
  eurusd: 1.1,
  charterRate: 50_000,
  vesselSize: 100_000,
  mmbtuPerM3: 20,
  boilOff: 0.1,
  speed: 10,
  panamaFee: 100_000,
  suezFee: 150_000,
  portCosts: 180_000,
  liquefactionFee: 2.5,
  feedgasMultiplier: 115,
};
const handAsia: Route = { id: 'a', label: 'Asia test', market: 'jkm', canal: 'panama', distanceNm: 2400 };
const handEurope: Route = { id: 'e', label: 'Europe test', market: 'ttf', canal: null, distanceNm: 1200 };

describe('hand-calculated case', () => {
  const r = routeNetback(handAsia, hand);
  it('voyage days and volumes', () => {
    expect(r.ladenDays).toBeCloseTo(10, 10);
    expect(r.roundTripDays).toBeCloseTo(20, 10);
    expect(r.loadedMmbtu).toBe(2_000_000);
    expect(r.deliveredMmbtu).toBeCloseTo(1_980_000, 6);
    expect(r.canalCost).toBe(200_000);
    expect(r.voyageCost).toBeCloseTo(1_380_000, 6);
  });
  it('costs, netback and margin', () => {
    expect(r.shippingCost).toBeCloseTo(0.69697, 5);
    expect(r.boilOffCost).toBeCloseTo(0.10101, 5);
    expect(r.netback).toBeCloseTo(9.20202, 5);
    expect(r.margin).toBeCloseTo(3.25202, 5);
  });
  it('TTF conversion and cost of supply', () => {
    expect(ttfToUsd(30, 1.1)).toBeCloseTo(9.671747, 6);
    expect(costOfSupply(hand)).toBeCloseTo(5.95, 10);
  });
  it('Europe leg: 5 laden days, no canal', () => {
    const e = routeNetback(handEurope, hand);
    // delivered = 2,000,000 x (1 - 0.005) = 1,990,000; voyage = 50,000 x 10 + 180,000 = 680,000
    expect(e.canalCost).toBe(0);
    expect(e.shippingCost).toBeCloseTo(680_000 / 1_990_000, 10);
    expect(e.boilOffCost).toBeCloseTo((10_000 * 9.671747) / 1_990_000, 6);
  });
});

describe('formula properties', () => {
  it('voyageDays = distance / (speed x 24)', () => {
    expect(voyageDays(4080, 17)).toBeCloseTo(10, 10);
    expect(() => voyageDays(100, 0)).toThrow(RangeError);
  });
  it('zero boil-off gives zero boil-off cost and delivered = loaded', () => {
    const r = routeNetback(handAsia, { ...hand, boilOff: 0 });
    expect(r.boilOffCost).toBe(0);
    expect(r.deliveredMmbtu).toBe(r.loadedMmbtu);
  });
  it('uses the Suez fee for Suez routes and no fee for the Cape', () => {
    expect(routeNetback({ ...handAsia, canal: 'suez' }, hand).canalCost).toBe(300_000);
    expect(routeNetback({ ...handAsia, canal: null }, hand).canalCost).toBe(0);
  });
  it('higher charter rate lowers every netback', () => {
    const a = computeNetbacks(defaultInputs, defaultRoutes);
    const b = computeNetbacks({ ...defaultInputs, charterRate: defaultInputs.charterRate * 2 }, defaultRoutes);
    a.routes.forEach((r, k) => expect(b.routes[k].netback).toBeLessThan(r.netback));
  });
  it('rejects routes where boil-off would consume the cargo', () => {
    expect(() => routeNetback({ ...handAsia, distanceNm: 1e7 }, hand)).toThrow(RangeError);
  });
});

describe('computeNetbacks', () => {
  const res = computeNetbacks(hand, [handEurope, handAsia]);
  it('picks the best destination and computes the arb', () => {
    expect(res.europe.route.id).toBe('e');
    expect(res.bestAsia.route.id).toBe('a');
    expect(res.arb).toBeCloseTo(res.bestAsia.netback - res.europe.netback, 12);
    expect(res.best.netback).toBe(Math.max(res.europe.netback, res.bestAsia.netback));
  });
  it('requires both a Europe and an Asia route', () => {
    expect(() => computeNetbacks(hand, [handAsia])).toThrow(RangeError);
    expect(() => computeNetbacks(hand, [])).toThrow(RangeError);
  });
});

describe('breakeven JKM', () => {
  it('makes the arb zero when JKM is set to it (default routes)', () => {
    const be = breakevenJkm(defaultInputs, defaultRoutes);
    const res = computeNetbacks({ ...defaultInputs, jkm: be }, defaultRoutes);
    expect(res.arb).toBeCloseTo(0, 9);
    expect(res.breakevenJkm).toBeCloseTo(be, 9);
  });
  it('is the minimum over Asia routes (just below it the arb is negative)', () => {
    const be = breakevenJkm(defaultInputs, defaultRoutes);
    expect(computeNetbacks({ ...defaultInputs, jkm: be - 0.01 }, defaultRoutes).arb).toBeLessThan(0);
    expect(computeNetbacks({ ...defaultInputs, jkm: be + 0.01 }, defaultRoutes).arb).toBeGreaterThan(0);
  });
});

describe('charter sensitivity', () => {
  it('returns steps + 1 points from the first to the last rate', () => {
    const pts = charterSensitivity(defaultInputs, defaultRoutes, 0, 200_000, 20);
    expect(pts).toHaveLength(21);
    expect(pts[0].charterRate).toBe(0);
    expect(pts[20].charterRate).toBe(200_000);
  });
  it('arb falls as the charter rate rises', () => {
    const pts = charterSensitivity(defaultInputs, defaultRoutes, 0, 200_000, 20);
    for (let k = 1; k < pts.length; k++) expect(pts[k].arb).toBeLessThan(pts[k - 1].arb);
  });
  it('breakeven charter rate gives a zero arb', () => {
    // Set JKM so Asia wins at zero charter but loses at high charter rates.
    const be = breakevenJkm({ ...defaultInputs, charterRate: 0 }, defaultRoutes);
    const i = { ...defaultInputs, jkm: be + 0.5 };
    const c = breakevenCharter(i, defaultRoutes);
    expect(c).not.toBeNull();
    expect(computeNetbacks({ ...i, charterRate: c as number }, defaultRoutes).arb).toBeCloseTo(0, 4);
  });
  it('returns null when Europe wins at every charter rate', () => {
    expect(breakevenCharter({ ...defaultInputs, jkm: 1 }, defaultRoutes)).toBeNull();
  });
});

describe('defaults from assumptions.json', () => {
  it('produce finite results for every route', () => {
    const res = computeNetbacks(defaultInputs, defaultRoutes);
    expect(res.routes).toHaveLength(4);
    for (const r of res.routes) {
      expect(Number.isFinite(r.netback)).toBe(true);
      expect(r.shippingCost).toBeGreaterThan(0);
    }
  });
});
