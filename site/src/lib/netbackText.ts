/** Plain-text summaries of netback results. Pure, so the wording is testable. */
import { fmtUsd } from './format';
import type { NetbackResult, Route } from './netback';

export type DisplayRoute = Route & { shortLabel: string; destination: string; via: string };

/** "Best destination: X via Y, by $Z/MMBtu" (SPEC section 3). Z is the gap to the best route in the other market. */
export function headline(res: NetbackResult): string {
  const best = res.best.route as DisplayRoute;
  const other = best.market === 'ttf' ? res.bestAsia : res.europe;
  const gap = res.best.netback - other.netback;
  const where = best.via === 'direct' ? `${best.destination}, direct` : `${best.destination} via ${best.via}`;
  return `Best destination: ${where}, by ${fmtUsd(gap)}/MMBtu`;
}

/** One sentence on where the arb flips, in JKM terms. */
export function breakevenSentence(res: NetbackResult, jkm: number): string {
  const be = res.breakevenJkm;
  if (!Number.isFinite(be)) return '';
  const diff = be - jkm;
  if (Math.abs(diff) < 0.005) return `JKM is at the breakeven of ${fmtUsd(be)}/MMBtu.`;
  const dir = diff > 0 ? 'rise' : 'fall';
  return `Asia and Europe netbacks are equal at JKM ${fmtUsd(be)}/MMBtu. JKM would need to ${dir} by ${fmtUsd(Math.abs(diff))}/MMBtu for the arb to flip.`;
}

/**
 * Warning when no route covers the full cost of supply. Empty string otherwise.
 * Says whether lifting still beats cancelling, with the liquefaction fee treated as sunk.
 */
export function marginWarning(res: NetbackResult): string {
  if (res.best.margin >= 0) return '';
  const full = `No route covers the full cost of supply of ${fmtUsd(res.costOfSupply)}/MMBtu. The best full-cost margin is ${fmtUsd(res.best.margin)}/MMBtu.`;
  if (res.best.liftMargin >= 0) {
    return `${full} The best lift/cancel margin is ${fmtUsd(res.best.liftMargin)}/MMBtu, so with the fee sunk, lifting still beats cancelling.`;
  }
  return `${full} No route covers the feedgas cost of ${fmtUsd(res.feedgasCost)}/MMBtu either, so cancelling beats lifting.`;
}

/** One sentence on the two margins, shown under the results table and on /methodology. */
export const MARGIN_EXPLAINER =
  'Lift/cancel margin leaves out the liquefaction fee, which is owed whether or not the cargo is lifted, so it shows whether lifting beats cancelling.';

