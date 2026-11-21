/**
 * Builds the compact data the storage tool needs from the pipeline files.
 * Runs at build time, so the browser only downloads what the page uses.
 */
import {
  addDays,
  completeWinters,
  meanOfLast,
  winterDays,
  winterLabel,
  winterOf,
  winterRange,
  type Coefficients,
  type RangePoint,
  type Scenario,
  type StorageSeries,
} from './storage';

export interface StorageFile extends StorageSeries {
  updated: string;
  asOf: string;
  workingGasVolumeTwh: number;
  annualConsumptionTwh?: number | null;
  net_withdrawal_twh: number[];
}

export interface WeatherFile {
  updated: string;
  observed: { days: string[]; temp_c: number[] };
  forecast: { days: string[]; temp_c: number[] };
}

export interface ModelFile {
  coefficients: { a: { value: number }; b: { value: number }; c: { value: number } };
  normals: { winters: string[]; temps: Record<string, number[]> };
  recentLngTwh: number;
  recentLngDays: number;
  dailyDemandTwh: number;
  presets: (Scenario & { id: string; label: string })[];
}

export interface StatusFile {
  storage?: { ok: boolean; lastSuccess?: string; error?: string | null };
  weather?: { ok: boolean; lastSuccess?: string; error?: string | null };
}

export interface StoragePayload {
  asOf: string;
  updated: string;
  weatherUpdated: string;
  wgv: number;
  /** Winter being projected, or null outside October to March. */
  winter: number | null;
  winterLabel: string;
  endDay: string;
  actual: { day: string; full: number; storage: number }[];
  range: RangePoint[];
  rangeWinters: string[];
  startStorage: number;
  forecast: Record<string, number>;
  forecastEnd: string | null;
  normals: Record<string, number[]>;
  normalWinters: string[];
  coef: Coefficients;
  recentLng: number;
  recentLngDays: number;
  dailyDemand: number;
  presets: (Scenario & { id: string; label: string })[];
  /** Set when the last refresh failed and older data is shown. */
  staleNote: string | null;
}

const RANGE_WINTERS = 5;

export function buildStoragePayload(
  storage: StorageFile,
  weather: WeatherFile,
  model: ModelFile,
  status: StatusFile | null,
): StoragePayload {
  const asOf = storage.asOf;
  const live = winterOf(asOf);
  // Outside October to March there is no winter to project; show the last complete one.
  const done = completeWinters(storage);
  const winter = live ?? done[done.length - 1];
  const days = new Set(winterDays(winter));
  const actual = storage.days
    .map((d, k) => ({ day: d, full: storage.full_pct[k], storage: storage.storage_twh[k] }))
    .filter((p) => days.has(p.day));
  const past = done.filter((y) => y < winter).slice(-RANGE_WINTERS);
  const forecast: Record<string, number> = {};
  weather.forecast.days.forEach((d, k) => {
    if (d > asOf) forecast[d] = weather.forecast.temp_c[k];
  });
  // Days between the last storage day and today use the observed temperatures.
  weather.observed.days.forEach((d, k) => {
    if (d > asOf) forecast[d] = weather.observed.temp_c[k];
  });
  const fcDays = Object.keys(forecast).sort();

  const failed = [status?.storage, status?.weather].some((s) => s && s.ok === false);
  return {
    asOf,
    updated: storage.updated,
    weatherUpdated: weather.updated,
    wgv: storage.workingGasVolumeTwh,
    winter: live,
    winterLabel: winterLabel(winter),
    endDay: `${winter + 1}-03-31`,
    actual,
    range: winterRange(storage, past, winter),
    rangeWinters: past.map(winterLabel),
    startStorage: storage.storage_twh[storage.storage_twh.length - 1],
    forecast,
    forecastEnd: fcDays.length ? fcDays[fcDays.length - 1] : null,
    normals: model.normals.temps,
    normalWinters: model.normals.winters,
    coef: { a: model.coefficients.a.value, b: model.coefficients.b.value, c: model.coefficients.c.value },
    // Use the latest data for recent LNG, not the value frozen at fit time.
    recentLng: meanOfLast(storage.lng_sendout_twh, model.recentLngDays) || model.recentLngTwh,
    recentLngDays: model.recentLngDays,
    dailyDemand: storage.annualConsumptionTwh ? storage.annualConsumptionTwh / 365 : model.dailyDemandTwh,
    presets: model.presets,
    staleNote: failed ? `The latest data refresh did not complete. Showing the last good data, gas day ${asOf}.` : null,
  };
}

/** First day a disruption can start: the day after the latest data. */
export function firstProjectionDay(p: StoragePayload): string {
  return addDays(p.asOf, 1);
}
