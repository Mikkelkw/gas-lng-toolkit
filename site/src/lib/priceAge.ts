/** Age of the manually entered TTF and JKM defaults. Pure, so the wording and threshold are testable. */

/** Manual price defaults older than this many days are flagged. */
export const STALE_AFTER_DAYS = 7;

export interface PriceNotice {
  asOf: string;
  ageDays: number;
  stale: boolean;
  text: string;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Whole days from `asOf` to `today`, both YYYY-MM-DD. Never negative. */
export function ageInDays(asOf: string, today: string): number {
  const d = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000);
  return Math.max(0, d);
}

/** Today's date in UTC as YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Notice for the oldest of the given "as of" dates. */
export function priceNotice(asOfDates: string[], today: string, staleAfter = STALE_AFTER_DAYS): PriceNotice {
  const asOf = [...asOfDates].sort()[0];
  const ageDays = ageInDays(asOf, today);
  const stale = ageDays > staleAfter;
  const age = ageDays === 0 ? 'today' : ageDays === 1 ? '1 day ago' : `${ageDays} days ago`;
  const text = stale
    ? `Prices last updated ${fmtDate(asOf)}, ${age}. The TTF and JKM defaults are entered manually and may be out of date. Enter current levels.`
    : `Prices last updated ${fmtDate(asOf)} (${age}). TTF and JKM defaults are entered manually.`;
  return { asOf, ageDays, stale, text };
}
