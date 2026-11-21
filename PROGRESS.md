# Progress

| Phase | Status |
|---|---|
| 1. Scaffold | done |
| 2. Assumptions | done |
| 3. Netback engine | not started |
| 4. Netback page | not started |
| 5. Storage pipeline | not started |
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
