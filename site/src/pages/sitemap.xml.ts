import type { APIRoute } from 'astro';
import { PAGES, canonical } from '../lib/pages';

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = Object.values(PAGES)
    .map((p) => `  <url><loc>${canonical(p.path)}</loc><lastmod>${lastmod}</lastmod><priority>${p.priority.toFixed(1)}</priority></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
