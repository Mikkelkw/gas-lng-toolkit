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
- 2026-11-21: EUR/USD from the ECB's documented eurofxref-hist-90d.xml download, not the Data Portal API, whose docs were unavailable (HTTP 503).
- 2026-11-21: Temperature basket: 16 cities in the 12 largest EU gas-consuming countries (91.4% of 2024 demand), country weight = Eurostat 2024 inland consumption share, split equally between cities where a country has two. Simplification noted in city_weights.json.
- 2026-11-21: History starts 2015-10-01 (10 full winters before 2025/26). Daily refresh re-fetches 45 days to pick up revisions and merges onto stored JSON in site/public/data/.
- 2026-11-21: Observed temperatures = Open-Meteo archive, with days after the archive end filled from the forecast API's past_days analysis.
- 2026-11-21: Validation rejects truncated history (start later than 2015-10-08), gaps over 3 days in the last 400 days, stale data, and shrinking history. Added after a live run once returned only 900 days.
- 2026-11-21: Model fitted on the last 5 complete winters, not all 10. Smallest back-test error of the windows tried (all 10, last 5, post-2022) and reflects the post-2021 supply mix. Meets SPEC minimum of 5.
- 2026-11-21: LNG deviation in projections = recent 30-day average send-out x scenario %, i.e. the recent average stands in for the winter average.
- 2026-11-21: Normal weather = each of the last 10 winters' temperature for that calendar day, shifted by the scenario offset, converted to HDD per year, then averaged. Forecast days use the forecast unshifted.
- 2026-11-21: Demand response cuts daily net withdrawal by % x average EU daily demand (AGSI EU annual consumption / 365). Simple and explainable; ignores seasonality of demand.
- 2026-11-21: Presets: Normal (0 C), Cold winter (-2 C), Cold + LNG shortfall (-2 C, -20% LNG), Mild (+2 C).
- 2026-11-21: Projection logic exists in Python (back-test) and TypeScript (site). A parity case in model.json is checked by both test suites so they cannot drift.
- 2026-11-21: Storage page payload computed at build time (current winter, range, normals, forecast) rather than shipping full history to the browser. Daily rebuild keeps it current.
- 2026-11-21: Daily workflow fails visibly (red run, GitHub email) when any source fails, but only after committing and deploying the last good data. Partial failure never blocks the deploy.
- 2026-11-21: Wrangler pinned to 4.166.0 in CI for reproducible deploys.
