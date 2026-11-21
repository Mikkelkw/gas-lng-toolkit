# LNG Flow Tools

Live: https://gas-lng-toolkit.pages.dev/

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
```

Built by Mikkel Wahl. Not investment advice.
