/** Formatting helpers shared by the tools. Pure functions, no DOM. */

/** Format a number with fixed decimals, using a true minus sign for negatives. */
export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return 'n/a';
  const s = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 && Number(s.replace(/,/g, '')) !== 0 ? `−${s}` : s;
}

/** Format a signed number with an explicit plus sign for positives. */
export function fmtSigned(value: number, decimals = 2): string {
  const s = fmt(value, decimals);
  return value > 0 && s !== fmt(0, decimals) ? `+${s}` : s;
}

/** Dollar amount with the sign before the symbol: "$1.09", "\u2212$1.09". */
export function fmtUsd(value: number, decimals = 2): string {
  const s = fmt(value, decimals);
  return s.startsWith('\u2212') ? `\u2212$${s.slice(1)}` : `$${s}`;
}
