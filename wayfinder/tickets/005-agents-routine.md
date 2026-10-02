---
title: AGENTS.md check-in routine
labels: [wayfinder:grilling]
status: open
assignee:
blocked_by: [3, 4]
---

## Question

What does `AGENTS.md` tell any LLM to do when the user checks in? Cover: the trigger message shape, parsing a free-text report into a log row, applying the adjustment rules, updating the plan, replying with the next session, and committing and pushing. Also decide the fallback for tools that can't touch git (e.g. ChatGPT web): does it output a patch or text for the user to paste, or is that tool simply unsupported?
