# CLAUDE.md

Project: LNG Flow Tools (repo `gas-lng-toolkit`), a free public site with two tools (US LNG netback calculator, EU storage winter stress test). Full requirements in `SPEC.md`. Read it fully before starting any task.

## How to work

- The owner wants minimal interruptions. Work through the phases in `SPEC.md` section 8 in order, without asking for approval between phases. Stop only at steps marked [CHECKPOINT], or when blocked.
- "Blocked" means: a required credential is missing or invalid, a data source's endpoint or terms cannot be confirmed, or a decision would contradict `SPEC.md`. When blocked, explain what is needed in one short message and continue with any other phase that is not blocked.
- For anything not covered by `SPEC.md`, make a sensible choice, note it in `DECISIONS.md` (one line each: date, decision, reason), and keep going.
- Commit after each working step with a clear message. Push to GitHub at the end of each phase.
- Run tests before marking any phase done. Never mark a phase done with failing tests.
- Keep a short running log in `PROGRESS.md`: phase, status, what was done, what is next.

## Hard rules

1. Never fetch, store or display Platts, Argus, ICE or other licensed price assessments.
2. Every number on the site comes from a documented source or a documented assumption.
3. Mandatory attribution (GIE, Open-Meteo) must appear under every chart that uses that data.
4. Never commit secrets. Keys live in `.env` locally and in GitHub Actions secrets in CI.
5. Do not guess API endpoints. Read the provider's documentation first; record the endpoint used in `pipeline/README.md`.
6. If a daily data refresh fails, keep the last good data and its date. Never publish empty or partial data.
7. Calculation logic lives in pure, tested modules, separate from UI code.

## Writing style for all site text

- Plain, direct British English for professional traders. No hype, no filler.
- Never use em-dashes.
- Short sentences. Units always shown.

## Tools available on this machine

- `gh` (GitHub CLI, logged in): use it to create the repo, push, and set Actions secrets from `.env`.
- `wrangler` (Cloudflare CLI, logged in): use it to create and deploy the Cloudflare Pages project (direct upload). For automated deploys, GitHub Actions runs `wrangler pages deploy` using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets, which you set from `.env` with `gh secret set`.
- Node.js LTS, Python 3.12, git.

## Structure

```
/site/                     Astro site
/site/src/lib/netback.ts   netback engine (pure, tested)
/site/src/lib/storage.ts   storage projection (pure, tested)
/site/public/data/         JSON written by the pipeline
/pipeline/                 Python fetchers and model fitting
/data/                     assumptions.json, assumptions_sources.md, city_weights.json, model.json
/.github/workflows/        CI and daily refresh
SPEC.md  CLAUDE.md  DECISIONS.md  PROGRESS.md
```
