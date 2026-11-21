/**
 * Host and path redirects, run by functions/_middleware.ts on every request (SPEC 11.3).
 * Pure, so the rules are tested. Cloudflare does not apply public/_redirects to requests
 * served by Pages Functions, so the old tool paths are handled here too.
 */
import { REDIRECTS, SITE_URL } from './pages';

const CANONICAL = new URL(SITE_URL);

/** Hosts that must 301 to the canonical domain: any *.pages.dev host and www. */
export function isOffCanonicalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return h.endsWith('.pages.dev') || h === `www.${CANONICAL.hostname}`;
}

/** New path for an old tool path (with or without a trailing slash), else null. */
export function legacyPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  return REDIRECTS.find(([from]) => from === p)?.[1] ?? null;
}

/**
 * Absolute target for a 301, or null to serve the request as is.
 * One hop: the host and an old path are fixed together. Path and query string are kept.
 */
export function redirectTarget(url: URL): string | null {
  const offHost = isOffCanonicalHost(url.hostname);
  const moved = legacyPath(url.pathname);
  if (!offHost && !moved) return null;
  const origin = offHost ? CANONICAL.origin : url.origin;
  return `${origin}${moved ?? url.pathname}${url.search}`;
}
