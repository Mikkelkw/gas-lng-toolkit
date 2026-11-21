/**
 * Runs in front of every request on Cloudflare Pages (functions/_middleware).
 * 301s *.pages.dev and www to https://lngtoolkit.com, and old tool paths to their new
 * routes, keeping path and query string. Rules live in src/lib/redirects.ts (tested).
 */
import { redirectTarget } from '../src/lib/redirects';

interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const target = redirectTarget(new URL(context.request.url));
  if (target) {
    return new Response(null, { status: 301, headers: { Location: target, 'Cache-Control': 'public, max-age=3600' } });
  }
  return context.next();
};
