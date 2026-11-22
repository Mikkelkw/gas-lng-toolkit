/** Site identity and per-page SEO metadata. One source for layout, nav and sitemap. */

export const SITE_NAME = 'LNG Toolkit';
/** Canonical origin. *.pages.dev and www redirect here (functions/_middleware.ts). */
export const SITE_URL = 'https://lngtoolkit.com';
export const AUTHOR = 'Mikkel Wahl';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/mikkelwahl/';

export interface PageMeta {
  path: string; // with trailing slash, as served
  title: string; // full <title>
  description: string; // max 155 characters
  nav?: string; // label in the main nav
  priority: number; // sitemap priority
}

export const PAGES = {
  home: {
    path: '/',
    title: `${SITE_NAME}: LNG Netback Calculator and EU Gas Storage Forecast`,
    description:
      'Free tools for gas and LNG traders: a US LNG netback and arbitrage calculator and an EU gas storage forecast to 31 March. Every number sourced.',
    priority: 1.0,
  },
  netback: {
    path: '/lng-netback-calculator/',
    title: 'LNG Netback & Arbitrage Calculator: US Gulf to Europe and Asia',
    description:
      'Compare FOB netbacks for a US Gulf LNG cargo to Europe (TTF) and Asia (JKM) via Panama, Suez or the Cape. See the JKM-TTF arb and its breakeven.',
    nav: 'LNG netback',
    priority: 0.9,
  },
  storage: {
    path: '/eu-gas-storage-forecast/',
    title: 'EU Gas Storage Forecast: Winter Stress Test to 31 March',
    description:
      'Where will EU gas storage be on 31 March? Daily GIE AGSI+ data, a 16-day weather forecast and scenarios for cold weather, LNG and supply cuts.',
    nav: 'EU storage',
    priority: 0.9,
  },
  learn: {
    path: '/learn/lng-trading-basics/',
    title: 'LNG Trading Basics: Netbacks, Arbitrage and European Gas Storage Explained',
    description:
      'A 10-minute primer on LNG for finance readers: Henry Hub, TTF and JKM, US cargo economics, netbacks, the arb, shipping and EU gas storage.',
    nav: 'Learn',
    priority: 0.8,
  },
  methodology: {
    path: '/methodology/',
    title: `Methodology: Formulas, Sources and Model Fit | ${SITE_NAME}`,
    description:
      'How the LNG netback calculator and the EU gas storage forecast work: formulas, default assumptions with sources, model fit, back-test and limitations.',
    nav: 'Methodology',
    priority: 0.6,
  },
  about: {
    path: '/about/',
    title: `About | ${SITE_NAME}`,
    description:
      'Who built LNG Toolkit and why: a free, non-commercial project by Mikkel Wahl with open code and public data sources.',
    nav: 'About',
    priority: 0.4,
  },
} satisfies Record<string, PageMeta>;

export const NAV: PageMeta[] = [PAGES.netback, PAGES.storage, PAGES.learn, PAGES.methodology, PAGES.about];

/** Old paths and where they now live. Served as 301s by functions/_middleware.ts (public/_redirects is the fallback when Functions do not run). */
export const REDIRECTS: [string, string][] = [
  ['/netback', PAGES.netback.path],
  ['/storage', PAGES.storage.path],
];

export function canonical(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** WebSite structured data for the home page, so Google shows "LNG Toolkit" as the site name. */
export function websiteJsonLd(): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/` });
}
