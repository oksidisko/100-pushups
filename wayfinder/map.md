---
title: 100 push-ups coach repo
labels: [wayfinder:map]
status: open
---

## Destination

A spec for a tool-agnostic push-up coach repo: chosen program, log and plan formats, adjustment rules, an `AGENTS.md` check-in routine, and a GitHub Pages site with one progress chart. Ready to build in one session.

## Notes

- Domain: personal fitness. Goal: 100 unbroken chest-to-floor push-ups (see `CONTEXT.md`). Baseline 50 on 2026-10-01. Soft target: New Year 2027, no hard deadline.
- Tracker: local markdown. Tickets live in `wayfinder/tickets/NNN-slug.md`. Frontmatter holds `labels`, `status` (open/closed), `assignee` (the claim) and `blocked_by` (ticket numbers). A ticket is on the frontier when it is open, unassigned, and every `blocked_by` ticket is closed. The resolution goes in a `## Resolution` section at the bottom of the ticket.
- Standing preferences: public GitHub repo; `AGENTS.md` instead of `CLAUDE.md` so any LLM tool can coach; used from laptop and phone; only the agent writes the log; structured sessions 3–4 times a week by default, hybrid with grease-the-groove if research supports it; each report has reps per set, RPE, notes and an optional Pain Flag.
- Skills: grilling + domain-modeling for grilling tickets, prototype for prototype tickets, research for research tickets. Keep `CONTEXT.md` up to date.
- Keep it minimal: plain markdown, GitHub Pages defaults, the fewest moving parts.

## Decisions so far

## Not yet specified

- How the site looks beyond the chart: which pages exist, whether the plan and log render as pages, theme.
- Full repo file layout: which files exist besides the program, log and `AGENTS.md`. This depends on the formats ticket and the routine ticket.

## Out of scope

- Nutrition, sleep coaching, other exercises or strength work: the goal is push-ups only.
- Reminders and notifications: the user starts every check-in.
- Building the repo: that comes after this map; the destination is the spec.
