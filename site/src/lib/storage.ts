/**
 * EU storage projection. Pure functions, no DOM, no I/O.
 * Mirrors pipeline/model.py `project`; the parity case in data/model.json is
 * checked by both test suites.
 *
 * Units: storage in TWh, flows in TWh/d (gas day), temperature in C.
 */

export const HDD_BASE_C = 15.5;

export interface Coefficients {
  a: number;
  b: number;
  c: number;
}

export interface Scenario {
  /** Temperature vs normal, C, applied after the forecast window. */
  tempDelta: number;
  /** LNG send-out vs recent average, %. */
  lngPct: number;
  /** Supply removed, TWh/d. */
  disruptionTwh: number;
  /** First day of the disruption (YYYY-MM-DD). Null: day after the latest data. */
  disruptionStart?: string | null;
  /** Length in days. Null: until the end of the projection. */
  disruptionDays?: number | null;
  /** Demand response, % of average daily EU demand. */
  demandResponsePct: number;
}

export interface ProjectionInput {
  startDay: string; // last gas day with data
  startStorage: number; // TWh at end of startDay
  wgv: number; // working gas volume, TWh
  endDay: string; // usually 31 March
  coef: Coefficients;
  normals: Record<string, number[]>; // MM-DD -> one temperature per winter
  forecast: Record<string, number>; // YYYY-MM-DD -> temperature
  recentLng: number; // TWh/d
  dailyDemand: number; // TWh/d
  scenario: Scenario;
}

export interface PathPoint {
  day: string;
  storage: number;
  full: number;
  withdrawal: number;
  hdd: number;
}

export function hdd(tempC: number): number {
  return Math.max(0, HDD_BASE_C - tempC);
}

/** Mean over years of HDD, each year's temperature shifted by delta first. */
export function normalHdd(normals: Record<string, number[]>, mmdd: string, delta: number): number {
  const temps = normals[mmdd] ?? normals['02-28'];
  if (!temps || temps.length === 0) throw new RangeError(`No normal temperatures for ${mmdd}.`);
  return temps.reduce((s, t) => s + hdd(t + delta), 0) / temps.length;
}

// Dates are handled as UTC calendar days to avoid time-zone drift.
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Daily storage path from the day after startDay to endDay inclusive. */
export function project(i: ProjectionInput): PathPoint[] {
  const s0 = i.scenario;
  const disStart = s0.disruptionStart || addDays(i.startDay, 1);
  const disEnd = s0.disruptionDays ? addDays(disStart, s0.disruptionDays) : addDays(i.endDay, 1);
  const lngDev = (i.recentLng * s0.lngPct) / 100;
  const dr = (s0.demandResponsePct / 100) * i.dailyDemand;
  const out: PathPoint[] = [];
  let s = i.startStorage;
  let d = i.startDay;
  while (d < i.endDay) {
    d = addDays(d, 1);
    const h = d in i.forecast ? hdd(i.forecast[d]) : normalHdd(i.normals, d.slice(5), s0.tempDelta);
    let w = i.coef.a + i.coef.b * h + i.coef.c * lngDev;
    if (d >= disStart && d < disEnd) w += s0.disruptionTwh;
    w -= dr;
    s = Math.min(i.wgv, Math.max(0, s - w));
    out.push({ day: d, storage: s, full: (100 * s) / i.wgv, withdrawal: w, hdd: h });
  }
  return out;
}

// ------------------------------------------------------------------ winters

/** Winter label year (Oct to Mar). Null for April to September. */
export function winterOf(iso: string): number | null {
  const m = Number(iso.slice(5, 7));
  const y = Number(iso.slice(0, 4));
  if (m >= 10) return y;
  if (m <= 3) return y - 1;
  return null;
}

export function winterLabel(y: number): string {
  return `${y}/${String(y + 1).slice(-2)}`;
}

export function winterDays(y: number): string[] {
  const out: string[] = [];
  for (let d = `${y}-10-01`; d <= `${y + 1}-03-31`; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Position in the winter, 0 = 1 October. Feb 29 shares the slot of Feb 28 + 1. */
export function seasonIndex(iso: string): number {
  const y = winterOf(iso);
  if (y === null) throw new RangeError(`${iso} is not in a winter.`);
  return daysBetween(`${y}-10-01`, iso);
}

export interface StorageSeries {
  days: string[];
  full_pct: number[];
  storage_twh: number[];
  lng_sendout_twh: (number | null)[];
}

export interface RangePoint {
  /** Date in the current winter that this calendar day maps to. */
  day: string;
  min: number;
  max: number;
  avg: number;
}

/**
 * Min, max and average % full by calendar day over the given past winters,
 * mapped onto the dates of `targetWinter` so they plot on one axis.
 */
export function winterRange(series: StorageSeries, winters: number[], targetWinter: number): RangePoint[] {
  const byDay = new Map(series.days.map((d, k) => [d, series.full_pct[k]]));
  return winterDays(targetWinter).map((day) => {
    const mmdd = day.slice(5);
    const vals = winters
      .map((y) => {
        const yy = Number(mmdd.slice(0, 2)) >= 10 ? y : y + 1;
        return byDay.get(`${yy}-${mmdd}`) ?? (mmdd === '02-29' ? byDay.get(`${yy}-02-28`) : undefined);
      })
      .filter((v): v is number => typeof v === 'number');
    return {
      day,
      min: vals.length ? Math.min(...vals) : NaN,
      max: vals.length ? Math.max(...vals) : NaN,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN,
    };
  });
}

/** Winters fully covered by the series (every day 1 Oct to 31 Mar present). */
export function completeWinters(series: StorageSeries): number[] {
  const have = new Set(series.days);
  const first = winterOf(series.days[0]) ?? Number(series.days[0].slice(0, 4));
  const last = Number(series.days[series.days.length - 1].slice(0, 4));
  const out: number[] = [];
  for (let y = first; y <= last; y++) if (winterDays(y).every((d) => have.has(d))) out.push(y);
  return out;
}

export function meanOfLast(values: (number | null)[], n: number): number {
  const v = values.filter((x): x is number => typeof x === 'number').slice(-n);
  if (v.length === 0) return NaN;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/**
 * "Projected 31 March storage: X% (Y TWh) under this scenario" (SPEC section 4),
 * followed by ", likely range A to B%" when a back-test range is given.
 */
export function storageHeadline(end: PathPoint, endDay: string, range?: LikelyRange): string {
  const d = new Date(`${endDay}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const base = `Projected ${d} storage: ${end.full.toFixed(1)}% (${Math.round(end.storage)} TWh) under this scenario`;
  return range ? `${base}, ${rangeText(range)}` : base;
}

// ------------------------------------------------------------------ model uncertainty

/** Back-test error for one projection horizon, in percentage points of working gas volume. */
export interface ErrorPoint {
  /** Days from the last data day to 31 March. */
  daysLeft: number;
  /** Projected minus actual 31 March storage. Positive means the model left too much gas in storage. */
  errorPp: number;
}

export interface BacktestCase {
  start: string;
  actualWeather: { errorPp: number };
  normalWeather: { errorPp: number };
}

/**
 * One error point per back-test case: the larger absolute error of the actual-weather and
 * normal-weather runs, keeping its sign. A case starting on day S uses data to S - 1.
 */
export function backtestErrors(cases: BacktestCase[], endDay: string): ErrorPoint[] {
  return cases
    .map((c) => {
      const a = c.actualWeather.errorPp;
      const n = c.normalWeather.errorPp;
      return { daysLeft: daysBetween(addDays(c.start, -1), endDay), errorPp: Math.abs(a) >= Math.abs(n) ? a : n };
    })
    .sort((x, y) => x.daysLeft - y.daysLeft);
}

/**
 * Half-width of the likely range (pp) for a projection with `daysLeft` days to go.
 * Linear in the horizon through the back-test points, zero at 31 March, flat beyond the
 * longest back-tested horizon. No bias correction: the band is symmetric about the projection.
 */
export function uncertaintyPp(points: ErrorPoint[], daysLeft: number): number {
  if (daysLeft <= 0 || points.length === 0) return 0;
  const pts = [{ daysLeft: 0, err: 0 }, ...points.map((p) => ({ daysLeft: p.daysLeft, err: Math.abs(p.errorPp) }))];
  for (let k = 1; k < pts.length; k++) {
    const lo = pts[k - 1];
    const hi = pts[k];
    if (daysLeft <= hi.daysLeft) {
      const t = hi.daysLeft === lo.daysLeft ? 1 : (daysLeft - lo.daysLeft) / (hi.daysLeft - lo.daysLeft);
      return lo.err + t * (hi.err - lo.err);
    }
  }
  return pts[pts.length - 1].err;
}

export interface LikelyRange {
  low: number; // % full
  high: number; // % full
}

/** Projection ± half-width, kept between 0% and 100% full. */
export function likelyRange(fullPct: number, halfWidthPp: number): LikelyRange {
  return { low: Math.max(0, fullPct - halfWidthPp), high: Math.min(100, fullPct + halfWidthPp) };
}

/** "Likely range 16.9 to 22.4%". */
export function rangeText(r: LikelyRange): string {
  return `likely range ${r.low.toFixed(1)} to ${r.high.toFixed(1)}%`;
}

/**
 * One line on the direction of last winter's back-test error, from the longest horizon.
 * Empty when there is no back-test.
 */
export function biasNote(points: ErrorPoint[], winter: string): string {
  if (points.length === 0) return '';
  const p = points[points.length - 1];
  if (Math.abs(p.errorPp) < 0.05) return `In the ${winter} back-test the model matched actual 31 March storage.`;
  const dir = p.errorPp > 0 ? 'under-predicted withdrawals' : 'over-predicted withdrawals';
  const left = p.errorPp > 0 ? 'too much' : 'too little';
  return `The model ${dir} last winter (${winter}): run from 1 October, it left ${Math.abs(p.errorPp).toFixed(1)} points ${left} gas in storage at 31 March. The range is not bias-corrected.`;
}
