/** Age of the last daily data refresh (status.json "updated"). Pure, so the threshold and wording are testable. */

/** A refresh older than this many hours means the daily run has been missed. */
export const DATA_STALE_HOURS = 36;

/** True when `updated` (ISO timestamp) is more than DATA_STALE_HOURS before `now`. Unknown or unparseable: false. */
export function isDataStale(updated: string | null | undefined, now: Date, staleHours = DATA_STALE_HOURS): boolean {
  if (!updated) return false;
  const t = Date.parse(updated);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > staleHours * 3_600_000;
}

/** "Data last refreshed 21 Nov 2026, 10:50 UTC." */
export function dataAgeText(updated: string): string {
  const d = new Date(updated);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  return `Data last refreshed ${date}, ${time} UTC.`;
}
