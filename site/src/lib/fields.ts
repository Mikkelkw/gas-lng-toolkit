/**
 * Netback calculator input definitions: grouping, bounds, steps and URL keys.
 * Pure data, shared by the UI and the URL encoder so both apply the same limits.
 */
import type { NetbackInputs } from './netback';

export interface FieldDef {
  key: keyof NetbackInputs;
  /** Short key used in shareable URLs. */
  q: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  group: 'prices' | 'shipping' | 'fees' | 'supply';
}

export const FIELDS: FieldDef[] = [
  { key: 'henryHub', q: 'hh', label: 'Henry Hub', unit: '$/MMBtu', min: 0, max: 50, step: 0.01, group: 'prices' },
  { key: 'ttf', q: 'ttf', label: 'TTF', unit: '€/MWh', min: 0, max: 400, step: 0.1, group: 'prices' },
  { key: 'jkm', q: 'jkm', label: 'JKM', unit: '$/MMBtu', min: 0, max: 100, step: 0.01, group: 'prices' },
  { key: 'eurusd', q: 'fx', label: 'EUR/USD', unit: 'USD per EUR', min: 0.5, max: 2, step: 0.0001, group: 'prices' },
  { key: 'charterRate', q: 'cr', label: 'Charter rate', unit: '$/day', min: 0, max: 500000, step: 500, group: 'shipping' },
  { key: 'vesselSize', q: 'vs', label: 'Vessel size', unit: 'm³', min: 10000, max: 300000, step: 1000, group: 'shipping' },
  { key: 'mmbtuPerM3', q: 'cf', label: 'Conversion factor', unit: 'MMBtu per m³', min: 15, max: 30, step: 0.01, group: 'shipping' },
  { key: 'boilOff', q: 'bo', label: 'Boil-off rate', unit: '% per day', min: 0, max: 0.5, step: 0.005, group: 'shipping' },
  { key: 'speed', q: 'sp', label: 'Speed', unit: 'knots', min: 5, max: 25, step: 0.1, group: 'shipping' },
  { key: 'panamaFee', q: 'pf', label: 'Panama Canal fee', unit: '$ per transit', min: 0, max: 5000000, step: 1000, group: 'fees' },
  { key: 'suezFee', q: 'sf', label: 'Suez Canal fee', unit: '$ per transit', min: 0, max: 5000000, step: 1000, group: 'fees' },
  { key: 'portCosts', q: 'pc', label: 'Port and other costs', unit: '$ per voyage', min: 0, max: 5000000, step: 1000, group: 'fees' },
  { key: 'liquefactionFee', q: 'lf', label: 'Liquefaction fee', unit: '$/MMBtu', min: 0, max: 10, step: 0.01, group: 'supply' },
  { key: 'feedgasMultiplier', q: 'fg', label: 'Feedgas multiplier', unit: '% of Henry Hub', min: 100, max: 150, step: 0.5, group: 'supply' },
];

export const GROUP_LABELS: Record<FieldDef['group'], string> = {
  prices: 'Prices',
  shipping: 'Vessel and voyage',
  fees: 'Canal and port costs',
  supply: 'Cost of supply',
};

/** Route distance bounds, nautical miles. URL key is `d_<routeId>`. */
export const DISTANCE_BOUNDS = { min: 500, max: 30000, step: 1 };

/** Clamp to [min, max]; returns null for non-numeric input. */
export function clampField(value: number, min: number, max: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}
