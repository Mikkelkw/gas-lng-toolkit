/**
 * US LNG netback engine. Pure functions, no DOM, no I/O.
 * Formulas follow SPEC.md section 3 and are shown on the netback page.
 *
 * Units: prices in $/MMBtu (TTF input in EUR/MWh), money in $, distances in
 * nautical miles, speed in knots, boil-off in % per day, size in m3.
 */

/** MMBtu per MWh, used for EUR/MWh to $/MMBtu conversion. */
export const MMBTU_PER_MWH = 3.412;

export type Market = 'ttf' | 'jkm';
export type Canal = 'panama' | 'suez' | null;

export interface Route {
  id: string;
  label: string;
  market: Market;
  canal: Canal;
  /** One-way laden distance, nautical miles. Ballast return assumed equal. */
  distanceNm: number;
}

export interface NetbackInputs {
  henryHub: number; // $/MMBtu
  ttf: number; // EUR/MWh
  jkm: number; // $/MMBtu
  eurusd: number; // USD per EUR
  charterRate: number; // $/day
  vesselSize: number; // m3
  mmbtuPerM3: number; // MMBtu per m3 LNG
  boilOff: number; // % per day, laden leg
  speed: number; // knots
  panamaFee: number; // $ per transit
  suezFee: number; // $ per transit
  portCosts: number; // $ per voyage
  liquefactionFee: number; // $/MMBtu
  feedgasMultiplier: number; // % of Henry Hub
}

export interface RouteResult {
  route: Route;
  destinationPrice: number; // $/MMBtu
  ladenDays: number;
  roundTripDays: number;
  loadedMmbtu: number;
  deliveredMmbtu: number;
  canalCost: number; // $ per voyage, both transits
  voyageCost: number; // $ per voyage: charter + canal + port
  shippingCost: number; // $/MMBtu delivered
  boilOffCost: number; // $/MMBtu delivered
  netback: number; // $/MMBtu, FOB
  margin: number; // $/MMBtu, full-cost margin: netback minus cost of supply
  liftMargin: number; // $/MMBtu, lift/cancel margin: netback minus feedgas cost (fee sunk)
}

export interface NetbackResult {
  ttfUsd: number;
  costOfSupply: number;
  feedgasCost: number;
  routes: RouteResult[];
  best: RouteResult;
  europe: RouteResult;
  bestAsia: RouteResult;
  /** Best Asia netback minus Europe netback, $/MMBtu. Positive means Asia pays more. */
  arb: number;
  /** JKM level ($/MMBtu) at which the best Asia netback equals the Europe netback. */
  breakevenJkm: number;
}

/** TTF EUR/MWh to $/MMBtu: EUR/MWh x EURUSD / 3.412. */
export function ttfToUsd(ttfEurMwh: number, eurusd: number): number {
  return (ttfEurMwh * eurusd) / MMBTU_PER_MWH;
}

/** One-way voyage days: distance / (speed x 24). */
export function voyageDays(distanceNm: number, speedKnots: number): number {
  if (!(speedKnots > 0)) throw new RangeError('Speed must be above 0 knots.');
  return distanceNm / (speedKnots * 24);
}

/** Cost of supply at FOB: feedgas multiplier x HH + liquefaction fee. */
export function costOfSupply(i: Pick<NetbackInputs, 'henryHub' | 'feedgasMultiplier' | 'liquefactionFee'>): number {
  return (i.feedgasMultiplier / 100) * i.henryHub + i.liquefactionFee;
}

/** Feedgas cost: feedgas multiplier x HH. The variable cost of lifting a cargo once the fee is sunk. */
export function feedgasCost(i: Pick<NetbackInputs, 'henryHub' | 'feedgasMultiplier'>): number {
  return (i.feedgasMultiplier / 100) * i.henryHub;
}

function canalFeePerTransit(canal: Canal, i: NetbackInputs): number {
  if (canal === 'panama') return i.panamaFee;
  if (canal === 'suez') return i.suezFee;
  return 0;
}

function destinationPrice(market: Market, i: NetbackInputs): number {
  return market === 'ttf' ? ttfToUsd(i.ttf, i.eurusd) : i.jkm;
}

/** Netback for a single route. */
export function routeNetback(route: Route, i: NetbackInputs): RouteResult {
  const price = destinationPrice(route.market, i);
  const ladenDays = voyageDays(route.distanceNm, i.speed);
  const roundTripDays = 2 * ladenDays;
  const bor = i.boilOff / 100;
  const loadedMmbtu = i.vesselSize * i.mmbtuPerM3;
  const lostShare = bor * ladenDays;
  if (lostShare >= 1) throw new RangeError('Boil-off consumes the whole cargo on this route.');
  const deliveredMmbtu = loadedMmbtu * (1 - lostShare);
  const canalCost = 2 * canalFeePerTransit(route.canal, i);
  const voyageCost = i.charterRate * roundTripDays + canalCost + i.portCosts;
  const shippingCost = voyageCost / deliveredMmbtu;
  const boilOffCost = (loadedMmbtu * lostShare * price) / deliveredMmbtu;
  const netback = price - shippingCost - boilOffCost;
  return {
    route,
    destinationPrice: price,
    ladenDays,
    roundTripDays,
    loadedMmbtu,
    deliveredMmbtu,
    canalCost,
    voyageCost,
    shippingCost,
    boilOffCost,
    netback,
    margin: netback - costOfSupply(i),
    liftMargin: netback - feedgasCost(i),
  };
}

function maxBy<T>(xs: T[], f: (x: T) => number): T {
  return xs.reduce((a, b) => (f(b) > f(a) ? b : a));
}

/**
 * Breakeven JKM. For an Asia route r, netback is linear in JKM:
 *   netback_r = J x (1 - k_r) - S_r,  k_r = lostShare / (1 - lostShare),  S_r = shipping cost.
 * The best Asia netback first reaches the Europe netback E at J = min_r (E + S_r) / (1 - k_r).
 */
export function breakevenJkm(i: NetbackInputs, routes: Route[]): number {
  const europe = routes.filter((r) => r.market === 'ttf').map((r) => routeNetback(r, i));
  const asia = routes.filter((r) => r.market === 'jkm');
  if (europe.length === 0 || asia.length === 0) return NaN;
  const e = maxBy(europe, (r) => r.netback).netback;
  const candidates = asia.map((r) => {
    const res = routeNetback(r, i);
    const lostShare = (i.boilOff / 100) * res.ladenDays;
    const k = lostShare / (1 - lostShare);
    return (e + res.shippingCost) / (1 - k);
  });
  return Math.min(...candidates);
}

/** Full calculation across all routes. */
export function computeNetbacks(i: NetbackInputs, routes: Route[]): NetbackResult {
  if (routes.length === 0) throw new RangeError('At least one route is required.');
  const results = routes.map((r) => routeNetback(r, i));
  const europeAll = results.filter((r) => r.route.market === 'ttf');
  const asiaAll = results.filter((r) => r.route.market === 'jkm');
  if (europeAll.length === 0 || asiaAll.length === 0) {
    throw new RangeError('Need at least one Europe and one Asia route.');
  }
  const europe = maxBy(europeAll, (r) => r.netback);
  const bestAsia = maxBy(asiaAll, (r) => r.netback);
  return {
    ttfUsd: ttfToUsd(i.ttf, i.eurusd),
    costOfSupply: costOfSupply(i),
    feedgasCost: feedgasCost(i),
    routes: results,
    best: maxBy(results, (r) => r.netback),
    europe,
    bestAsia,
    arb: bestAsia.netback - europe.netback,
    breakevenJkm: breakevenJkm(i, routes),
  };
}

/** Arb (best Asia minus Europe, $/MMBtu) at a given charter rate. */
export function arbAtCharter(i: NetbackInputs, routes: Route[], charterRate: number): number {
  return computeNetbacks({ ...i, charterRate }, routes).arb;
}

export interface SensitivityPoint {
  charterRate: number;
  arb: number;
}

/** Arb across a range of charter rates, for the sensitivity chart. */
export function charterSensitivity(
  i: NetbackInputs,
  routes: Route[],
  from: number,
  to: number,
  steps = 40,
): SensitivityPoint[] {
  const out: SensitivityPoint[] = [];
  for (let s = 0; s <= steps; s++) {
    const c = from + ((to - from) * s) / steps;
    out.push({ charterRate: c, arb: arbAtCharter(i, routes, c) });
  }
  return out;
}

/**
 * Charter rate ($/day) at which the arb is zero, or null if there is none in [lo, hi].
 * Asia voyages are longer, so each Asia-minus-Europe spread falls as the charter rate
 * rises, and so does their maximum. Bisection is therefore safe.
 */
export function breakevenCharter(i: NetbackInputs, routes: Route[], lo = 0, hi = 500_000): number | null {
  let fLo = arbAtCharter(i, routes, lo);
  const fHi = arbAtCharter(i, routes, hi);
  if (fLo === 0) return lo;
  if (Math.sign(fLo) === Math.sign(fHi)) return null;
  let a = lo;
  let b = hi;
  for (let n = 0; n < 100 && b - a > 0.01; n++) {
    const m = (a + b) / 2;
    const fM = arbAtCharter(i, routes, m);
    if (Math.sign(fM) === Math.sign(fLo)) {
      a = m;
      fLo = fM;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}
