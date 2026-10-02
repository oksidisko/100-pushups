---
title: Log and plan file formats
labels: [wayfinder:prototype]
status: closed
assignee: kirill
blocked_by: [1, 2]
---

## Question

What do the log and the plan look like on disk? Prototype a few sample rows of the log (date, planned vs done sets, RPE, notes, Pain Flag, Max Test marker) in the format the chart approach needs, and a plan file showing the current week and the next session. The plan must hold the state the adjustment rules need: current Week, Column and Day, failed Sessions in this Cycle, Cycles since the last Max Test and since the last Deload, and the last two Max Test results. The log needs a video yes/no field for Max Tests. The log must fit the chart research's `_data/sessions.csv` approach, or say why not. The user should be able to react to how it reads on GitHub mobile and on the site.

## Resolution

Three files, split by how often they change:

- **`_data/sessions.csv`** (the log, append-only, one row per Session or Max Test). Columns: `date,kind,week,column,day,planned,done,result,rpe,pain,video,notes`.
  - `kind` is `session` or `max`.
  - `planned` and `done` hold space-separated reps per set, with a `+` for to-failure targets.
  - `result` is `pass` or `fail`, `pain` is 0–10 or blank, `video` is `yes`/`no` for Max Tests.
  - `notes` is one short quoted line.
  - No `total` column: the chart page sums `done` with Liquid (+1 line versus the chart research sketch). In the prototype, 2 of 6 hand-typed totals were wrong.
- **`plan.md`** (rewritten by the agent after every check-in). The front matter holds the state the adjustment rules need: `week, column, next, failed_this_cycle, cycles_since_max_test, cycles_since_deload, last_max_tests, updated`. The body has the next Session as a table with rest time and earliest date, the rest of the Cycle up to the next Max Test, and a one-line "why this plan". State is stored, not worked out from the log, so every LLM reads the same numbers.
- **`program.md`** (static): the Week 5 and Week 6 tables from hundredpushups.com plus the adjustment rules. `AGENTS.md` points to it; the agent never edits it.

A separate journal was rejected for now; add `journal.md` only if notes outgrow one line.

Context: prototype on branch `prototype/file-formats` (commit 6f5b7c1), files `_data/sessions.csv` and `plan.md`.
