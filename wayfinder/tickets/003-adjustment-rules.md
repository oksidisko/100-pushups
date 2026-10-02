---
title: Adjustment rules for session reports
labels: [wayfinder:grilling]
status: closed
assignee: kirill
blocked_by: [1]
---

## Question

Given the chosen program, what exact rules does the agent apply when a Session report comes in, so any LLM produces the same next step? Cover: all sets completed (advance), a failed set (repeat or step back), high RPE without failure, missed days or a week off, a Pain Flag, when to schedule a Max Test, and what happens after a Max Test (re-placement in the program).

## Resolution

The agent applies these rules in order to every Session report. Terms are defined in `CONTEXT.md`.

1. **Safety first:**
   - Severe arm swelling or dark urine: stop and see a doctor the same day (rhabdomyolysis).
   - Pain Flag above 3/10, or still present next morning: rest 2 days, then repeat the previous Day.
   - A flag lasting more than 7 days: pause training and see a clinician.
   - Pain up to 3/10 that is gone by next morning: note it and continue.
   - The agent checks every report for these, whether or not the user raises them.
2. **Missed days:**
   - Up to 3 days late: continue where you stopped.
   - 4–13 days off: Max Test first, and the result places you.
   - 14+ days off: Max Test, then one Column below the result for one Cycle.
3. **Pass or fail:** a Failed Session is any fixed set short, or the final "+" set below its number.
   - On a fail, repeat the same Day.
   - After 2 Failed Sessions in one Cycle, repeat the whole Cycle.
   - Never shrink the remaining sets mid-session: log the reps and carry on.
4. **Sequence:** Day 1 → Day 2 → Day 3, at least one rest day between Sessions. Counted by sequence, not calendar. A Cycle is complete only when Day 3 passes. After every 2nd completed Cycle, take a Max Test, with at least one rest day before it. Every-Cycle testing was rejected: the program gives no rule for repeated Week 6, and the final "+" sets track progress between tests.
5. **Placement:** the latest Max Test alone sets the Column (46–50 C1, 51–60 C2, over 60 C3). Below 46, repeat Week 5 per the program, so its tables are needed too. Above 60, repeat Week 6 C3 with no extrapolated columns; revisit only if Max Tests stall for 3 tests in C3. The researcher's "drop a Column after 2 falling tests" rule is dropped as redundant.
6. **Deload:** triggered by no Max Test gain across 2 tests in a row, or 10 Cycles since the start or the last Deload, whichever comes first. One full rest week, then a Max Test.
7. **RPE:** logged for context and the chart only. It never changes the plan.
8. **Goal:** reached at any Max Test of 100 or more. Filming is optional, and the log records whether a video exists.
