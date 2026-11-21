# Progress

| Phase | Status |
|---|---|
| 1. Scaffold | done |
| 2. Assumptions | done |
| 3. Netback engine | done |
| 4. Netback page | done |
| 5. Storage pipeline | done |
| 6. Storage model | not started |
| 7. Storage page | not started |
| 8. Automation | not started |
| 9. Polish | not started |
| 10. Final review | not started |

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
