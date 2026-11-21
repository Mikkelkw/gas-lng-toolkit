# Decisions

One line each: date, decision, reason.

- 2026-11-21: Astro 7 + @astrojs/preact + Observable Plot, static output. Matches SPEC section 6.
- 2026-11-21: Site deployed by direct upload to Cloudflare Pages with `wrangler pages deploy`, using the API token from `.env` locally. Matches CLAUDE.md.
- 2026-11-21: Automated deploys deferred to the daily/refresh workflow in phase 8; phase 1 CI runs tests and build only. Keeps phases in SPEC order.
- 2026-11-21: Local Windows note: run Vitest from a `C:\` (upper-case) path; a lower-case `c:\` cwd loads Vitest twice and fails. CI on Linux is unaffected.
- 2026-11-21: Pipeline run as a package (`python -m pipeline.<module>`) from repo root, with a repo-root `.venv` locally. Keeps imports simple and consistent with CI.
- 2026-11-21: Pages project created with `wrangler pages project create --force`. Wrangler 4.166 otherwise redirects Pages commands to Workers; SPEC names Cloudflare Pages. Wrangler confirms `--force` is needed only once, at creation.
- 2026-11-21: Added `site/wrangler.toml` with `pages_build_output_dir = "./dist"` so wrangler treats `site/` as a Pages project.
- 2026-11-21: Cloudflare token can deploy Pages but cannot read user details (`wrangler whoami` fails). Not needed, so left as is.
- 2026-11-21: ">10% change" flag in phase 2 read as "public sources disagree by more than 10%", since no assumptions.json existed to compare against. Flags listed in data/assumptions_sources.md.
- 2026-11-21: TTF and JKM defaults stored as indicative round numbers from public press reports (EUR 85/MWh, $27/MMBtu), labelled manual and user-editable. JKM labelled "North Asia spot LNG (JKM proxy)". No licensed assessment or exchange feed is fetched or stored (hard rule 1).
- 2026-11-21: Canal fee per transit = average of laden and ballast toll, applied twice per round trip, so the SPEC formula "canal fees (both ways)" stays a simple 2 x fee.
- 2026-11-21: Tokyo Bay used as the North Asia reference port for all three Asia routes.
- 2026-11-21: Cargo MMBtu = full vessel capacity x conversion factor; heel and fill limit ignored. Documented simplification.
- 2026-11-21: ECB API docs (data.ecb.europa.eu/help) returned HTTP 503 on 2026-11-21. EUR/USD default taken from the ECB reference-rate web page; API endpoint to be confirmed from docs in phase 5.
- 2026-11-21: Breakeven JKM solved in closed form (netback linear in JKM per route); breakeven charter rate by bisection, valid because the arb falls monotonically with charter rate.
- 2026-11-21: Netback page reads optional `site/public/data/market.json` at build time for Henry Hub and EUR/USD; falls back to assumptions.json. Newer valid values only.
- 2026-11-21: URL updates live with replaceState, so the address bar is always the shareable scenario; "Copy link" copies it.
- 2026-11-21: Breakeven charter rate shown rounded to the nearest $100/day; finer precision would be false precision.
- 2026-11-21: Site is light-theme only, per SPEC "dark-on-light" visual style.
