/**
 * The three live figures on the landing page (SPEC 11.2). Pure: callers pass in the data.
 * Each figure carries its own date so the reader knows how fresh it is.
 */
import type { AssumptionItem, InputKey } from './assumptions';
import { fmtUsd } from './format';
import { computeNetbacks, type NetbackInputs } from './netback';
import type { DisplayRoute } from './netbackText';
import { daysBetween, inDeliverabilityZone, likelyRange, project, uncertaintyBand, type Scenario } from './storage';
import type { StoragePayload } from './storagePayload';

export interface LiveFigure {
  label: string;
  value: string;
  detail: string;
  /** "Gas day 19 Nov 2026" or similar. Null if there is no data. */
  dated: string | null;
}

export function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const NORMAL: Scenario = { tempDelta: 0, lngPct: 0, disruptionTwh: 0, disruptionStart: null, disruptionDays: null, demandResponsePct: 0 };

/** EU storage % full on the latest gas day. */
export function storageFigure(storage: { asOf: string; full_pct: number[] } | null): LiveFigure {
  const full = storage?.full_pct.at(-1);
  if (!storage || full === undefined || !Number.isFinite(full)) {
    return { label: 'EU gas storage', value: 'n/a', detail: 'Data not available yet.', dated: null };
  }
  return { label: 'EU gas storage', value: `${full.toFixed(1)}% full`, detail: 'GIE AGSI+, EU aggregate.', dated: `Gas day ${fmtDay(storage.asOf)}` };
}

/** Best destination for a US cargo at the default inputs, and its lead in $/MMBtu. */
export function netbackFigure(items: Record<InputKey, AssumptionItem>, routes: DisplayRoute[]): LiveFigure {
  const inputs = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.value])) as unknown as NetbackInputs;
  const res = computeNetbacks(inputs, routes);
  const best = res.best.route as DisplayRoute;
  const other = best.market === 'ttf' ? res.bestAsia : res.europe;
  const gap = res.best.netback - other.netback;
  const versus = best.market === 'ttf' ? 'the best Asia route' : 'Europe';
  const where = best.via === 'direct' ? best.destination : `${best.destination} via ${best.via}`;
  // The figure is only as fresh as its oldest price input.
  const priceKeys: InputKey[] = ['henryHub', 'ttf', 'jkm', 'eurusd'];
  const oldest = priceKeys.map((k) => items[k].asOf).sort()[0];
  return {
    label: 'Best destination for a US cargo',
    value: where,
    detail: `Ahead of ${versus} by ${fmtUsd(gap)}/MMBtu, default inputs.`,
    dated: `Prices as of ${fmtDay(oldest)}`,
  };
}

/** Projected 31 March storage under the Normal preset, with the back-test likely range. */
export function projectionFigure(p: StoragePayload | null): LiveFigure {
  const label = 'Projected 31 March storage';
  if (!p || p.winter === null || p.asOf >= p.endDay) {
    return { label, value: 'From 1 October', detail: 'The winter projection restarts with the next storage season.', dated: null };
  }
  const path = project({
    startDay: p.asOf,
    startStorage: p.startStorage,
    wgv: p.wgv,
    endDay: p.endDay,
    coef: p.coef,
    normals: p.normals,
    forecast: p.forecast,
    recentLng: p.recentLng,
    dailyDemand: p.dailyDemand,
    scenario: NORMAL,
  });
  const end = path.at(-1);
  if (!end) return { label, value: 'n/a', detail: 'Projection not available.', dated: null };
  const band = uncertaintyBand(p.errors, daysBetween(p.asOf, p.endDay), p.noisePp);
  const r = likelyRange(end.full, band);
  const range = band.down + band.up > 0 ? `, likely range ${r.low.toFixed(1)} to ${r.high.toFixed(1)}%` : '';
  const zone = inDeliverabilityZone(end.full) ? ' At or below 20% full, withdrawal capacity is constrained.' : '';
  return { label, value: `${end.full.toFixed(1)}% full`, detail: `Normal weather${range}.${zone}`, dated: `From gas day ${fmtDay(p.asOf)}` };
}
