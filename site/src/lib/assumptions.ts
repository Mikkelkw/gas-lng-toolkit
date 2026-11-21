/** Typed access to data/assumptions.json (the documented netback defaults). */
import raw from '../../../data/assumptions.json';
import type { NetbackInputs, Route } from './netback';

export interface AssumptionItem {
  label: string;
  value: number;
  unit: string;
  asOf: string;
  source: string;
}

export type InputKey = keyof NetbackInputs;

export const assumptionItems = raw.inputs as Record<InputKey, AssumptionItem>;

export const defaultInputs: NetbackInputs = Object.fromEntries(
  Object.entries(assumptionItems).map(([k, v]) => [k, v.value]),
) as unknown as NetbackInputs;

export type SourcedRoute = Route & { source: string; shortLabel: string; destination: string; via: string };

export const defaultRoutes: SourcedRoute[] = raw.routes as SourcedRoute[];

export const assumptionsVerified: string = raw.verified;
