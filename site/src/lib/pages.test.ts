import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, REDIRECTS, SITE_NAME, canonical } from './pages';

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
