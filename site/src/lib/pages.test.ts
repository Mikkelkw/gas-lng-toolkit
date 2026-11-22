import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, REDIRECTS, SITE_NAME, canonical, websiteJsonLd } from './pages';

const pages = Object.values(PAGES);

describe('page metadata', () => {
  it('every description is unique and at most 155 characters', () => {
    for (const p of pages) expect(p.description.length, p.path).toBeLessThanOrEqual(155);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  });
  it('every title is unique', () => {
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
  });
  it('uses the SPEC titles for the tools and primer', () => {
    expect(PAGES.netback.title).toBe('LNG Netback & Arbitrage Calculator: US Gulf to Europe and Asia');
    expect(PAGES.storage.title).toBe('EU Gas Storage Forecast: Winter Stress Test to 31 March');
    expect(PAGES.learn.title).toBe('LNG Trading Basics: Netbacks, Arbitrage and European Gas Storage Explained');
    expect(SITE_NAME).toBe('LNG Toolkit');
  });
  it('no em-dashes in any title or description (site style)', () => {
    for (const p of pages) expect(p.title + p.description).not.toContain('—');
  });
  it('canonical URLs are absolute with a trailing slash', () => {
    expect(canonical(PAGES.netback.path)).toBe('https://lngtoolkit.com/lng-netback-calculator/');
  });
  it('public/_redirects covers every old path with a 301', () => {
    const rules = readFileSync(new URL('../../public/_redirects', import.meta.url), 'utf-8');
    for (const [from, to] of REDIRECTS) {
      expect(rules).toContain(`${from} ${to} 301`);
      expect(rules).toContain(`${from}/ ${to} 301`);
    }
  });
});

describe('structured data', () => {
  it('home page WebSite JSON-LD names the site and its canonical URL', () => {
    expect(JSON.parse(websiteJsonLd())).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'LNG Toolkit',
      url: 'https://lngtoolkit.com/',
    });
  });
});

describe('icons', () => {
  const files = ['favicon.svg', 'favicon.ico', 'favicon-48.png', 'favicon-96.png', 'favicon-192.png', 'favicon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png', 'site.webmanifest'];
  it('every icon file exists and robots.txt blocks none of them', () => {
    for (const f of files) expect(existsSync(`public/${f}`), f).toBe(true);
    const robots = readFileSync('public/robots.txt', 'utf-8');
    expect(robots).not.toMatch(/^Disallow:\s*\/\S*/m);
  });
  it('manifest icons point at files that exist', () => {
    const m = JSON.parse(readFileSync('public/site.webmanifest', 'utf-8'));
    expect(m.name).toBe(SITE_NAME);
    for (const i of m.icons) expect(existsSync(`public${i.src}`), i.src).toBe(true);
  });
});

describe('no repository links', () => {
  it('site source and public files do not link to GitHub', () => {
    const files = ['src/pages/about.astro', 'src/components/NetbackMethod.astro', 'src/layouts/Base.astro', 'src/lib/pages.ts'];
    for (const f of files) expect(readFileSync(f, 'utf-8'), f).not.toMatch(/github\.com/i);
  });
});

describe('feature-request invitation', () => {
  it('footer and about page link to LinkedIn in a new tab with rel="noopener"', () => {
    const link = '<a href={LINKEDIN_URL} target="_blank" rel="noopener">LinkedIn</a>';
    expect(readFileSync('src/layouts/Base.astro', 'utf-8')).toContain(`Missing something? Suggest a feature on&nbsp;${link}.`);
    const about = readFileSync('src/pages/about.astro', 'utf-8');
    expect(about).toContain('<h2>Suggest a feature</h2>');
    expect(about).toContain(link);
  });
});
