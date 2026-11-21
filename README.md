# LNG Toolkit

Live: https://lngtoolkit.com/

A free, public site with two tools for gas and LNG market participants:

- **LNG netback and arbitrage calculator** (`/lng-netback-calculator/`): compares FOB netbacks for a US Gulf Coast cargo to Northwest Europe (TTF) and North Asia (JKM via Panama, Suez or the Cape).
- **EU gas storage forecast** (`/eu-gas-storage-forecast/`): projects EU gas storage to 31 March under weather and supply scenarios.

A primer for newcomers lives at `/learn/lng-trading-basics/`.

Every number comes from a documented public source or a documented assumption. No licensed price assessments are used.

## Layout

- `site/`: Astro static site (TypeScript, Preact islands). Calculation logic in `site/src/lib/`.
- `pipeline/`: Python fetchers and model fitting. Writes JSON to `site/public/data/`.
- `data/`: assumptions, their sources, city weights and the fitted storage model.

## Development

```
cd site && npm install && npm run dev      # site
npm test                                    # Vitest
python -m pytest                            # pipeline tests, from repo root
node scripts/build-map.mjs                  # from site/: rebuild the hero route map
```

The hero map uses Natural Earth 1:110m land (public domain, via the `world-atlas` package). The script writes
`site/public/map/land.svg` and `site/src/data/route-map.json`; both are committed, so a normal build does not need it.

Built by Mikkel Wahl. Not investment advice.

## Hosting

Cloudflare Pages, project `gas-lng-toolkit`, custom domain `lngtoolkit.com`. `site/functions/_middleware.ts` 301s every
`*.pages.dev` host and `www.lngtoolkit.com` to `https://lngtoolkit.com`, keeping path and query string (rules in
`site/src/lib/redirects.ts`).
