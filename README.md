# 100 Push-ups

Training log and coach for 100 unbroken chest-to-floor push-ups, using the [Hundred Pushups](https://hundredpushups.com) program. Baseline: 50 on 2026-10-01.

A Cloudflare Worker with a D1 database. The engine (`src/engine.ts`) replays the whole log through the program's rules on every request, so the plan is never stored. An LLM is optional: the Log page has a "Copy for AI" button that builds a prompt for any LLM, and you apply its advice as an Override.

- `/`, `/progress` and `/program` are meant to be public. For now the whole site is behind Cloudflare Access, because Access on a `workers.dev` URL can't be limited to one path. A custom domain would allow that.
- `/log` (logging, overrides, edits, CSV export) also checks the Access login itself, so it stays closed even if Access is turned off.

Design decisions: `wayfinder/` (start at `wayfinder/map.md`). Glossary: `CONTEXT.md`.

## Develop

```sh
npm install
npm test        # engine rules
npm run dev     # local D1 + http://localhost:8787 (put DEV=1 in .dev.vars to open /log locally)
```

## Deploy (one-time setup)

1. `npx wrangler d1 create pushups`, then put the `database_id` in `wrangler.jsonc`.
2. `npx wrangler d1 migrations apply pushups --remote`, which creates the table and adds the baseline row.
3. `npm run deploy`.
4. Cloudflare dashboard → Workers & Pages → `100-pushups` → Access → Protect this Worker behind Access, with scope "All traffic" and a policy that allows only your email. Put the team domain (`<team>.cloudflareaccess.com`) and the app's AUD tag into `vars` in `wrangler.jsonc`, then deploy again.
5. Workers & Pages → `100-pushups` → Settings → Builds → connect this GitHub repo. From then on, every push to `main` deploys.
