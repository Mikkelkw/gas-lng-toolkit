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
