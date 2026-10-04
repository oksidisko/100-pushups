---
title: Deterministic app instead of an LLM check-in after every Session?
labels: [wayfinder:grilling]
status: closed
assignee: kirill
blocked_by: [3]
---

## Question

Does an LLM add value after every Session, or should a deterministic app apply the rules and call on the LLM only when judgment helps? If an app, where does it run, and how do you log from a phone?

## Resolution

The 8 adjustment rules are deterministic, so code applies them every time. The LLM only advises on demand. This supersedes tickets 002, 004, 005 and 006.

**Stack and data**
1. One TypeScript Worker on Cloudflare, no framework: plain HTML, a little JS, and a JSON API of about 6 routes.
2. A D1 database is the only record. Table columns: `date, kind, week, column, day, planned, done, result, rpe, pain, video, notes`. `kind` is `session`, `max` or `override`. `/export.csv` covers backups.
   - Build note (2026-10-04): `planned` and `result` were dropped because they are derived from week, column, day and done, the same lesson as the dropped `total`. `column` is renamed `col`, and `danger` is added for the swelling or dark urine tick box.
3. Engine: `nextSession(history)` is a pure function that replays every row through the rules in `003`. No plan state is stored. You can edit or delete any row, and the plan recomputes. One `node --test` file covers it.

**Safety (rule 1), coded**
- Pain above 3 → 2 rest days, then repeat the previous Day.
- Pain logged more than 7 days in a row → plan paused with "see a clinician". An Override clears it.
- A "severe swelling or dark urine" tick box → red "doctor today" banner, no next session.

**Using it**
- **Logging (behind Cloudflare Access, email one-time code):**
  - One number box per set, pre-filled with the planned reps.
  - RPE 1–10, pain 0–10 (default 0), and notes.
  - On Max Test days: one box plus a video tick box.
- **AI:**
  - A "Copy for AI" button, always visible, builds a prompt (rules, current plan, last 10 rows, latest note) to paste into any LLM.
  - A banner suggests it on pain above 0, a 2nd fail in a Cycle, a Max Test with no gain, or a return after 14+ days.
  - The AI only advises; you apply its advice as an Override row.
- **Public pages:**
  - Progress: a Chart.js line of Max Tests with a 100 goal line, weekly volume bars, and the log table.
  - Plan and program pages.
  - Notes and pain values are public too.
  - Deploy note (2026-10-04): for now the whole site is behind Access. Access on a `workers.dev` URL protects the whole Worker and has no path option. Making these pages public needs a custom domain.
- **Repo:** public on GitHub, auto-deployed by Workers Builds on every push to `main`.
- **Start:** seed one Max Test row of 50 on 2026-10-01. The first Session is Week 6, C1, Day 1.
