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

/** Warning when no route covers the cost of supply. Empty string otherwise. */
export function marginWarning(res: NetbackResult): string {
  if (res.best.margin >= 0) return '';
  return `No route covers the cost of supply of ${fmtUsd(res.costOfSupply)}/MMBtu. The best margin is ${fmtUsd(res.best.margin)}/MMBtu.`;
}
