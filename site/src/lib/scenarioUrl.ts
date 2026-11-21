/**
 * Encode and decode a netback scenario in a URL query string.
 * Only values that differ from the defaults are written, so links stay short.
 * Decoding ignores unknown keys and clamps values to the field bounds.
 */
import type { NetbackInputs, Route } from './netback';
import { DISTANCE_BOUNDS, FIELDS, clampField } from './fields';

export interface Scenario {
  inputs: NetbackInputs;
  /** Route id to one-way distance, nautical miles. */
  distances: Record<string, number>;
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** Trim float noise: 0.30000000000000004 becomes "0.3". */
function num(v: number): string {
  return String(Number(v.toPrecision(12)));
}

export function encodeScenario(s: Scenario, defaults: Scenario): string {
  const p = new URLSearchParams();
  for (const f of FIELDS) {
    const v = s.inputs[f.key];
    if (!sameNumber(v, defaults.inputs[f.key])) p.set(f.q, num(v));
  }
  for (const [id, d] of Object.entries(s.distances)) {
    if (id in defaults.distances && !sameNumber(d, defaults.distances[id])) p.set(`d_${id}`, num(d));
  }
  return p.toString();
}

export function decodeScenario(search: string, defaults: Scenario): Scenario {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const inputs = { ...defaults.inputs };
  for (const f of FIELDS) {
    const raw = p.get(f.q);
    if (raw === null || raw.trim() === '') continue;
    const v = clampField(Number(raw), f.min, f.max);
    if (v !== null) inputs[f.key] = v;
  }
  const distances = { ...defaults.distances };
  for (const id of Object.keys(defaults.distances)) {
    const raw = p.get(`d_${id}`);
    if (raw === null || raw.trim() === '') continue;
    const v = clampField(Number(raw), DISTANCE_BOUNDS.min, DISTANCE_BOUNDS.max);
    if (v !== null) distances[id] = v;
  }
  return { inputs, distances };
}

export function scenarioFromDefaults(inputs: NetbackInputs, routes: Route[]): Scenario {
  return { inputs: { ...inputs }, distances: Object.fromEntries(routes.map((r) => [r.id, r.distanceNm])) };
}

export function applyDistances(routes: Route[], distances: Record<string, number>): Route[] {
  return routes.map((r) => ({ ...r, distanceNm: distances[r.id] ?? r.distanceNm }));
}
