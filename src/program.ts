// Hundred Pushups (hundredpushups.com) Weeks 5 and 6, checked against the site on 2026-10-04.
// TABLES[week][column][day - 1] = reps per set; the last set is "+" (at least that many).
export const TABLES: Record<number, Record<number, number[][]>> = {
  5: {
    1: [[17, 19, 15, 15, 20], [10, 10, 13, 13, 10, 10, 9, 25], [13, 13, 15, 15, 12, 12, 10, 30]],
    2: [[28, 35, 25, 22, 35], [18, 18, 20, 20, 14, 14, 16, 40], [18, 18, 20, 20, 17, 17, 20, 45]],
    3: [[36, 40, 30, 24, 40], [19, 19, 22, 22, 18, 18, 22, 45], [20, 20, 24, 24, 20, 20, 22, 50]],
  },
  6: {
    1: [[25, 30, 20, 15, 40], [14, 14, 15, 15, 14, 14, 10, 10, 44], [13, 13, 17, 17, 16, 16, 14, 14, 50]],
    2: [[40, 50, 25, 25, 50], [20, 20, 23, 23, 20, 20, 18, 18, 53], [22, 22, 30, 30, 25, 25, 18, 18, 55]],
    3: [[45, 55, 35, 30, 55], [22, 22, 30, 30, 24, 24, 18, 18, 58], [26, 26, 33, 33, 26, 26, 22, 22, 60]],
  },
};

export const REST_SECONDS = [60, 45, 45];

export const RANGES: Record<number, string[]> = { 5: ['31–35', '36–40', '41–45'], 6: ['46–50', '51–60', '61+'] };

// Every week/column from easiest to hardest, so "one Column lower" is index - 1.
export const LADDER: [number, number][] = [[5, 1], [5, 2], [5, 3], [6, 1], [6, 2], [6, 3]];

export const ladderIndex = (week: number, col: number) =>
  Math.max(0, LADDER.findIndex(([w, c]) => w === week && c === col));

// Rule 5: the latest Max Test alone picks the week and column.
export const place = (max: number) =>
  max > 60 ? 5 : max > 50 ? 4 : max > 45 ? 3 : max > 40 ? 2 : max > 35 ? 1 : 0;

export const planned = (week: number, col: number, day: number) => TABLES[week]?.[col]?.[day - 1] ?? [];

export const RULES = [
  'Safety first: severe arm swelling or dark urine means stop and see a doctor today. Pain above 3/10 means rest 2 days, then repeat that Day. Pain logged for more than 7 days in a row pauses the plan: see a clinician. Pain up to 3/10 that is gone by morning is noted only.',
  'Missed days: up to 3 days off, continue. 4–13 days off, Max Test first. 14+ days off, Max Test, then one Column lower for one Cycle.',
  'Pass or fail: a Session fails if any fixed set is short, or the final "+" set is below its number. On a fail, repeat the same Day. After 2 Failed Sessions in one Cycle, repeat the whole Cycle. Never shrink sets mid-session.',
  'Sequence: Day 1 → Day 2 → Day 3, at least one rest day between Sessions. A Cycle completes when Day 3 passes. Max Test after every 2nd completed Cycle.',
  'Placement: the latest Max Test sets the Column. Week 6: 46–50 C1, 51–60 C2, over 60 C3. Below 46, Week 5: up to 35 C1, 36–40 C2, 41–45 C3. Above 60, repeat Week 6 C3.',
  'Deload: after 2 Max Tests in a row with no gain, or 10 Cycles since the start or the last Deload. One full rest week, then a Max Test.',
  'RPE is logged only. It never changes the plan.',
  'Goal: reached at any Max Test of 100 or more.',
];
