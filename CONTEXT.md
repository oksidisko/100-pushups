# 100 Push-ups

Training effort to reach 100 push-ups, tracked by a small web app whose engine applies the program's rules; an LLM advises on demand.

## Language

**Push-up**:
One rep: chest touches the floor, arms lock out at the top, body straight throughout.
_Avoid_: partial rep, half push-up

**Goal**:
100 **Push-ups** in one unbroken set: no rest at the top, no knees down.

**Max Test**:
One all-out unbroken set of **Push-ups** to measure the current best. Baseline: 50 on 2026-10-01.
_Avoid_: PR attempt, max set

**Session**:
One structured training block on a given day, made of several sets. What the user reports after training: reps per set, **RPE**, notes, optional **Pain Flag**.
_Avoid_: workout, training (as a noun for one block)

**Cycle**:
One pass of Day 1 → Day 2 → Day 3 of the program, in order, with at least one rest day between Sessions. Counted by sequence, not calendar.
_Avoid_: week (the program says "week", but a Cycle can take longer than 7 days)

**Column**:
The program's difficulty level within a week (C1, C2, C3), set only by the latest **Max Test**.

**Failed Session**:
A **Session** where any fixed set came up short, or the final "+" set fell below its number. It never blocks the next Day; a **Cycle** with any Failed Session is repeated.

**Deload**:
A full rest week with no push-ups, followed by a **Max Test**.

**RPE**:
Rate of perceived exertion for a **Session**, 1 (trivial) to 10 (nothing left).

**Pain Flag**:
A reported joint or tendon pain (not muscle burn). Overrides normal progression.
_Avoid_: niggle, soreness (soreness is normal and not a flag)

**Override**:
A log row (`kind = override`) that manually sets the plan, e.g. after AI advice or clinician clearance. The engine replays it like any other row.
_Avoid_: manual edit, hack
