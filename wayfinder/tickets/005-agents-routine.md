---
title: AGENTS.md check-in routine
labels: [wayfinder:grilling]
status: closed
assignee: kirill
blocked_by: [3, 4]
---

> Superseded on 2026-10-04 by [007](007-cloudflare-app.md): a deterministic engine applies the rules every Session; the LLM advises only on demand via a "Copy for AI" prompt.

## Question

What does `AGENTS.md` tell any LLM to do when the user checks in? The agent appends a row to `_data/sessions.csv`, rewrites `plan.md` including its front-matter state, and never edits `program.md` (see the formats ticket). Cover: the trigger message shape, parsing a free-text report into a log row, applying the adjustment rules, updating the plan, replying with the next session, and committing and pushing. Also decide the fallback for tools that can't touch git (e.g. ChatGPT web): does it output a patch or text for the user to paste, or is that tool simply unsupported?

## Resolution

What `AGENTS.md` instructs, for any LLM with repo write access:

1. **Read first:** `CONTEXT.md`, `program.md`, `plan.md`, and the last 10 rows of `_data/sessions.csv`. `plan.md`'s front matter is the authority for the coach's state; the log is history. If they disagree (e.g. after a hand edit), say so and ask before writing.
2. **Trigger:** a free-text report, e.g. `day 1: 25 30 20 15 41, rpe 8, left elbow 2/10`.
   - The date defaults to today, and planned reps come from `plan.md`.
   - Ask only when a required field is missing (reps per set, RPE).
   - A message that isn't a report ("what's next?", "why C2?") gets an answer from `plan.md` and the log, with no writes and no commit.
3. **Write without confirming:**
   - Append the row and apply the adjustment rules from `program.md`.
   - Rewrite `plan.md`, front matter included. Never edit `program.md`.
   - A correction from the user edits the last row in place.
4. **Log reality:** if a report breaks the rules (back-to-back days, a different Day than planned), log what actually happened. Don't refuse or rewrite it. Add a one-line warning and plan the next session from what was done.
5. **Commit:** one commit per check-in, pushed straight to `main`, with a message like `log: 2026-10-03 W6 C1 D1 pass`.
6. **Reply (at most 10 lines):**
   - The logged row in one line
   - A safety or rule warning, only if there is one
   - Pass or fail, and why, in one line
   - The next session as a table, with rest time and earliest date
7. **Fallback for tools without git** (ChatGPT web, plain chat), a 3-line section: output the new CSV row and the full new `plan.md` for the user to paste on GitHub mobile.
8. **No `CLAUDE.md`:** Claude Code (v2.1.277+) reads `AGENTS.md` natively when no `CLAUDE.md` exists in the working directory or above it (https://code.claude.com/docs/en/memory.md). No parent directory has one. Never add a `CLAUDE.md` with its own content, because it would replace `AGENTS.md`. If an older or Bedrock/Vertex session ignores `AGENTS.md`, add a `CLAUDE.md` whose only line is `@AGENTS.md`.
