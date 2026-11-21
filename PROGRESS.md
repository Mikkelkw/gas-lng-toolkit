# Progress

| Phase | Status |
|---|---|
| 1. Scaffold | done |
| 2. Assumptions | done |
| 3. Netback engine | done |
| 4. Netback page | done |
| 5. Storage pipeline | done |
| 6. Storage model | done |
| 7. Storage page | done |
| 8. Automation | done |
| 9. Polish | done |
| 10. Final review | done, awaiting checkpoint review |

## Log

### Phase 1: Scaffold
- Git repo, `.gitignore` (excludes `.env`), folder structure per CLAUDE.md.
- Astro site with Preact, base layout, nav, mandatory footer, placeholder pages. Vitest set up.
- Python pipeline skeleton with `.env` loading (`pipeline/config.py`) and pytest.
- CI workflow: site tests and build, pipeline tests.
- `.env` secrets copied to GitHub Actions secrets with `gh secret set -f .env`.
- Public repo: https://github.com/Mikkelkw/gas-lng-toolkit
- Cloudflare Pages project `gas-lng-toolkit` created; placeholder site deployed by direct upload.
- Live URL: https://gas-lng-toolkit.pages.dev/
- Tests: Vitest 4 passed, pytest 3 passed. CI runs both plus the site build.


### Phase 2: Assumptions
- Created `data/assumptions.json` (14 inputs, 4 routes) and `data/assumptions_sources.md` with source, date and verification note for each.
- Henry Hub default fetched from the EIA API v2 (endpoint confirmed from route metadata, recorded in `pipeline/README.md`).
- Eight defaults flagged where public sources disagree by over 10%: JKM proxy, charter rate, boil-off, speed, Suez fee, port costs, liquefaction fee (and TTF/JKM are manual by design).
- New pytest checks every input has a value, unit, date and source, and appears in the sources doc. 20 tests pass.
- ECB API docs were down (HTTP 503); retry in phase 5.

### Phase 3: Netback engine
- `site/src/lib/netback.ts`: pure module with SPEC formulas, closed-form breakeven JKM, charter sensitivity and breakeven charter rate (bisection).
- `site/src/lib/assumptions.ts`: typed loader for `data/assumptions.json`.
- 18 netback tests including a hand-calculated case. Vitest 22 passed, pytest 20 passed.
- Defaults give: TTF $27.38, NWE netback $26.78, best Asia (Panama) $25.69, arb -$1.09, breakeven JKM $28.11/MMBtu.
- Note: owner added SEO and rename items to SPEC phase 9 (rename to "LNG Flow Tools", new routes). Picked up in phase 9.

### Phase 4: Netback page
- Preact island `NetbackTool` with grouped inputs (defaults show "as of" dates), results table, headline, breakeven sentence, margin warning.
- Charts (Observable Plot): netback by route (best highlighted), arb vs charter rate with current rate and breakeven marked. Tooltips on both.
- Scenario encoded in the URL (only changed values), "Copy link" and "Reset". Pure modules `fields.ts`, `scenarioUrl.ts`, `netbackText.ts`, `market.ts` with tests.
- "How this is calculated", simplifications, and a table of every default with its source on the page.
- Checked rendering at 390px and 1280px with Chrome device emulation: no horizontal scroll, no console errors, no label collisions.
- Vitest 38 passed.

### Phase 5: Storage pipeline
- Read docs for every source first: GIE API manual v008 (PDF), Open-Meteo docs and terms, ECB reference-rate page, EIA route metadata. Endpoints recorded in `pipeline/README.md`.
- `pipeline/sources.py`: fetchers and pure parsers for EIA, ECB, AGSI+, ALSI, Open-Meteo (archive and forecast).
- `pipeline/build.py`: incremental fetch merged onto stored history, validation, atomic writes, keep last good file, `status.json`.
- `data/city_weights.json`: 16 cities in 12 countries (91.4% of EU gas demand), weighted by Eurostat 2024 inland consumption.
- Live run: storage 2015-10-01 to 2026-11-19 (4,068 days, 69.59% full), weather to 2026-11-20 plus 16-day forecast, HH $3.10 (17 Nov), EUR/USD 1.099 (20 Nov).
- A live ALSI empty response (likely rate limit after a full refetch) was caught: last good file kept. Added one retry after 65 s.
- pytest 44 passed.

### Phase 6: Storage model
- `pipeline/model.py`: OLS fit of daily net withdrawal on HDD (base 15.5 C) and LNG send-out deviation, last 5 complete winters (2021/22 to 2025/26), n = 911 days.
- Fit: a = -2.81 TWh/d, b = 0.704 TWh/d per HDD (SE 0.012), c = -0.17 (SE 0.10), R2 = 0.80, RMSE 1.40 TWh/d. Saved with normals (10 winters), presets and a parity case in `data/model.json`.
- Back-test on 2025/26 (fit on 2020/21 to 2024/25), error at 31 March (actual 313.8 TWh, 27.7%): from 1 Oct +58.8 TWh (+5.2 pp) with actual weather, +62.2 TWh with normal weather; from 1 Nov +37.0 / +31.3 TWh; from 1 Jan +16.8 / +10.3 TWh. The model under-predicted withdrawals that winter.
- Pipeline now also records EU annual consumption (AGSI `consumption`, 3,519 TWh) for the demand-response control.
- pytest 56 passed.

### Phase 7: Storage page
- `site/src/lib/storage.ts`: projection mirroring the Python model (parity test passes to 1e-9), winter helpers, 5-winter range, headline.
- `site/src/lib/storagePayload.ts`: builds a compact payload at build time from storage/weather/status/model JSON; stale-data note when a refresh failed; off-season fallback (April to September shows last winter, no projection).
- Storage page: presets, sliders (temperature, LNG, demand response, disruption with start date and duration), chart (this winter, dashed projection, 5-winter average and range, tooltips, legend), preset table, model and back-test section, limitations, GIE and Open-Meteo attribution under the chart.
- Today's result (gas day 19 Nov 2026, 69.6% full): Normal 19.6%, Cold 5.2%, Cold + LNG shortfall 3.6%, Mild 34.1% on 31 March.
- Browser checks at 1280px and 390px: no horizontal scroll, no page errors; presets, sliders and netback URL update verified with Chrome automation.
- Vitest 54 passed, pytest 56 passed.

### Phase 8: Automation
- `.github/workflows/daily.yml`: 07:00 UTC cron plus manual trigger (optional full refetch). Fetch, refit model, pytest, Vitest, build, commit changed data as github-actions[bot], deploy with wrangler. A final step fails the run (so GitHub emails the owner) if any source failed, after the last good data has been deployed.
- `.github/workflows/ci.yml`: tests, type check and build on every push and PR; deploys to Cloudflare Pages on push to main once both suites pass.
- Verified: CI run green incl. deploy; manual daily run green (all sources ok, data commit 3fc0d47, deployed).
- Failure handling: per-source validation and keep-last-good in `pipeline/build.py` (unit tested; also seen live when ALSI returned an empty page).

### Phase 9: Polish and SEO
- Renamed to "LNG Flow Tools" (site, titles, header, README, SPEC.md, CLAUDE.md). Repo and pages.dev URL unchanged.
- Routes: /lng-netback-calculator/ and /eu-gas-storage-forecast/; 301s from /netback and /storage via `public/_redirects`.
- SEO: `src/lib/pages.ts` holds titles and unique descriptions (tested: max 155 characters, unique, SPEC titles); canonical URLs, Open Graph and Twitter tags, sitemap.xml, robots.txt.
- New pages: home (tool cards, live storage level, last-updated date), about, methodology (data sources with last successful refresh, both method sections), primer /learn/lng-trading-basics/ (1,694 words, 11 sections, sourced facts, illustrative numbers labelled). "New to LNG?" links on both tools.
- Method sections moved to shared components used by tool pages and /methodology.
- Lighthouse (mobile, local build): 100/100/100/100 on all six pages after removing invalid ARIA on Plot's internal groups (tool pages were 96 accessibility before).
- All pages checked at 390px: no horizontal scroll, no console errors. External links checked (ACER link fixed; Consilium returns 403 to scripts only).
- Vitest 60 passed, pytest 56 passed.

### Phase 10: Final review
- Tests: Vitest 60 passed, pytest 56 passed; CI green including deploy.
- Live site: all 6 pages, sitemap, robots and data return 200. Old /netback and /storage return 301 and keep query strings, so shared scenario links still work.
- Footer present on every page; canonical URL and description (120 to 151 characters) on every page.
- Attribution: GIE AGSI+, GIE ALSI and Open-Meteo (CC BY 4.0, linked) under the storage chart; EIA and ECB under the netback charts; data sources table on /methodology.
- No licensed price data fetched or stored (code search clean).
- Mobile: every live page checked at 360px and 390px, no horizontal scroll, no console errors. Reference tables set to scroll inside their frame on phones.

### Post-launch changes (owner request, 21 Nov 2026)
- Storage: likely range on the headline and in the preset table, from the back-test errors in model.json, scaled by days left to 31 March. One-line note that the model under-predicted withdrawals in 2025/26. No bias correction. Method explained on the tool page and /methodology.
- Netback: new "Lift/cancel margin" column (netback minus feedgas cost, fee sunk) next to the renamed "Full-cost margin"; one-sentence explainer under the table and in the method section on both pages; warning says whether lifting still beats cancelling.
- Netback: "Prices last updated" notice in the Prices inputs; amber with a "Check prices:" label when the manual TTF/JKM defaults are more than 7 days old.
- Tests: Vitest 74 passed (14 new). Checked in a local build at 1280px and 390px, including the amber state with a faked date.

### v1.1 section 11.1 and 11.2: redesign and landing page (21 Nov 2026)
- Status: built, deployed, awaiting checkpoint review (11.4). Section 11.3 (custom domain) waits for the owner's confirmation.
- 11.1: maritime chart room palette as CSS tokens; navy header and footer with a faint chart grid and brass rules; paper content; self-hosted Fraunces, Inter and IBM Plex Mono; compass mark logo and favicon; tool, prose and table styles restyled; Plot charts restyled (teal series, brass highlights, navy axes, paper background).
- 11.2: new landing page: hero with an original Natural Earth route map (four routes from Sabine Pass, drawn in, no motion when reduced motion is set), live strip (EU storage, best destination and arb, projected 31 March under Normal, each dated), three cards with small graphics, how it works, who it is for, about snippet, footer.
- Tests: Vitest 80 passed (6 new for the live figures), pytest 56 passed, astro check clean.
- Lighthouse mobile, local build: home 100/100/100/100; netback 98/100/100/100; storage 99/100/100/100; primer, methodology and about 100 in all four.
- All pages checked at 390 px and 1280 px: no horizontal scroll, no console errors.
