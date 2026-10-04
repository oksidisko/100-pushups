---
title: 100 push-ups coach repo
labels: [wayfinder:map]
status: closed
---

## Destination

A spec for a push-up coach app: chosen program, adjustment rules applied by a deterministic engine, a Cloudflare Worker with D1 for logging from a phone, public progress charts, and an LLM on demand. Ready to build in one session.

## Notes

- Domain: personal fitness. Goal: 100 unbroken chest-to-floor push-ups (see `CONTEXT.md`). Baseline 50 on 2026-10-01. Soft target: New Year 2027, no hard deadline.
- Tracker: local markdown. Tickets live in `wayfinder/tickets/NNN-slug.md`. Frontmatter holds `labels`, `status` (open/closed), `assignee` (the claim) and `blocked_by` (ticket numbers). A ticket is on the frontier when it is open, unassigned, and every `blocked_by` ticket is closed. The resolution goes in a `## Resolution` section at the bottom of the ticket.
- Standing preferences: public GitHub repo; any LLM tool can advise (no lock-in to one vendor); used from laptop and phone; only the agent writes the log; structured sessions 3–4 times a week by default, hybrid with grease-the-groove if research supports it; each report has reps per set, RPE, notes and an optional Pain Flag.
- Skills: grilling + domain-modeling for grilling tickets, prototype for prototype tickets, research for research tickets. Keep `CONTEXT.md` up to date.
- Keep it minimal: plain markdown, GitHub Pages defaults, the fewest moving parts.

## Decisions so far

- [Which proven program gets 50 to 100 unbroken push-ups?](tickets/001-program-choice.md): Hundred Pushups, Week 6 Column 1, 3 sessions per Cycle, repeat Week 6 until 100 (Max Test cadence set in 003).
- [How to chart a markdown log on plain GitHub Pages?](tickets/002-chart-on-pages.md): `_data/sessions.csv` plus a `progress.md` page with Liquid-generated Mermaid charts, about 15 lines.
- [Adjustment rules for session reports](tickets/003-adjustment-rules.md): 8 ordered rules (safety first, pass or fail repeats the Day, Max Test every 2nd Cycle sets the Column, Deload after 2 flat tests or 10 Cycles); RPE is logged only.
- [Log and plan file formats](tickets/004-file-formats.md): append-only `_data/sessions.csv` (reps as space-separated sets, no totals), `plan.md` rewritten each check-in with state in its front matter, static `program.md` for tables and rules.
- [AGENTS.md check-in routine](tickets/005-agents-routine.md): free-text report → write without confirming → one commit to `main` → reply of at most 10 lines with the next session; paste fallback for tools without git; no `CLAUDE.md`, since Claude Code reads `AGENTS.md`.
- [Site pages and theme](tickets/006-site-pages.md): 4 pages (home, progress with charts and log table, plan, program), default Primer theme, no `_config.yml`, deploy from `main`.
- [Deterministic app instead of an LLM check-in after every Session?](tickets/007-cloudflare-app.md): yes. A TypeScript Worker with D1 and Cloudflare Access; a pure `nextSession(history)` engine replays the log; safety rule coded; "Copy for AI" button for any LLM; public Chart.js progress page; Workers Builds deploys. Supersedes 002, 004, 005 and 006.

Destination reached on 2026-10-02 and revised on 2026-10-04 (007): no open tickets, no fog. Next step: the build session.

## Not yet specified


## Out of scope

- Nutrition, sleep coaching, other exercises or strength work: the goal is push-ups only.
- Reminders and notifications: the user starts every log entry.
- Building the repo: that comes after this map; the destination is the spec.
