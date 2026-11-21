# Progress

| Phase | Status |
|---|---|
| 1. Scaffold | in progress |
| 2. Assumptions | not started |
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
