/**
 * Overlay the pipeline's latest market data (site/public/data/market.json) on the
 * documented defaults. Pure: callers pass in whatever JSON they loaded (or null).
 */
import type { AssumptionItem, InputKey } from './assumptions';

export interface MarketPoint {
  value: number;
  asOf: string;
  source: string;
}

/** Shape written by pipeline/build_market.py. Only these keys are refreshed daily. */
export interface MarketFile {
  updated: string;
  henryHub?: MarketPoint;
  eurusd?: MarketPoint;
}

const LIVE_KEYS = ['henryHub', 'eurusd'] as const;

function valid(p: unknown): p is MarketPoint {
  const m = p as MarketPoint;
  return !!m && Number.isFinite(m.value) && m.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.asOf ?? '');
}

/**
 * Returns a copy of `items` with Henry Hub and EUR/USD replaced by the market file's
 * values, but only where those are valid and not older than the documented default.
 */
export function overlayMarket(
  items: Record<InputKey, AssumptionItem>,
  market: MarketFile | null | undefined,
): Record<InputKey, AssumptionItem> {
  const out = { ...items };
  if (!market) return out;
  for (const k of LIVE_KEYS) {
    const p = market[k];
    if (valid(p) && p.asOf >= items[k].asOf) {
      out[k] = { ...items[k], value: p.value, asOf: p.asOf, source: p.source };
    }
  }
  return out;
}
