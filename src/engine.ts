import { LADDER, REST_SECONDS, ladderIndex, place, planned } from './program.ts';

export type Row = {
  id?: number;
  date: string; // YYYY-MM-DD
  kind: 'session' | 'max' | 'override';
  week?: number | null;
  col?: number | null;
  day?: string | null; // '1' | '2' | '3' | 'max'
  done?: string | null; // reps per set, space-separated
  rpe?: number | null;
  pain?: number | null;
  danger?: number | null; // severe swelling or dark urine
  video?: number | null;
  notes?: string | null;
};

export type Banner = { level: 'red' | 'warn' | 'ai'; text: string };

const DAY_MS = 86_400_000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * DAY_MS).toISOString().slice(0, 10);
export const sets = (s?: string | null) => (s ?? '').trim().split(/\s+/).filter(Boolean).map(Number);
export const passed = (plan: number[], done: number[]) => plan.length > 0 && plan.every((n, i) => (done[i] ?? 0) >= n);

export const sortRows = (rows: Row[]) =>
  [...rows].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0));

// Replays the whole log through the rules in program.ts. Nothing about the plan is stored.
export function replay(rows: Row[]) {
  const s = {
    idx: 3, // LADDER index in use (W6 C1)
    base: 3, // LADDER index set by the latest Max Test
    next: '1',
    failed: 0,
    cyclesSinceMax: 0,
    cyclesSinceDeload: 0,
    flat: 0, // Max Tests in a row with no gain
    deload: false,
    restDays: 1,
    last: '', // date of the last Session or Max Test
    maxes: [] as number[],
    painSince: '',
    paused: false,
    doctor: false,
    cycleRepeat: false,
    why: 'No log yet.',
  };
  const startDeload = (reason: string) => {
    Object.assign(s, { deload: true, next: 'max', flat: 0, cyclesSinceDeload: 0, restDays: 7 });
    s.why = `${reason}: Deload, one full rest week, then a Max Test.`;
  };

  for (const r of sortRows(rows)) {
    s.cycleRepeat = false;
    if (r.kind === 'override') {
      s.idx = s.base = ladderIndex(Number(r.week), Number(r.col));
      Object.assign(s, { next: r.day || '1', failed: 0, paused: false, doctor: false, deload: false, painSince: '', restDays: 1 });
      s.why = `Override: ${r.notes || 'set by hand'}.`;
      continue;
    }

    const daysOff = s.last ? daysBetween(s.last, r.date) - 1 : 0;
    const pain = r.pain ?? 0;
    s.restDays = 1;
    if (r.danger) s.doctor = true;
    if (pain > 0) {
      s.painSince ||= r.date;
      if (daysBetween(s.painSince, r.date) > 7) s.paused = true;
    } else s.painSince = '';

    if (r.kind === 'max') {
      const n = sets(r.done)[0] ?? 0;
      const prev = s.maxes.at(-1);
      s.maxes.push(n);
      s.deload = false;
      s.flat = prev !== undefined && n <= prev ? s.flat + 1 : 0;
      s.base = place(n);
      s.idx = daysOff >= 14 ? Math.max(0, s.base - 1) : s.base;
      Object.assign(s, { failed: 0, cyclesSinceMax: 0, next: '1' });
      const [w, c] = LADDER[s.idx];
      s.why = `Max Test ${n} → Week ${w} C${c}${s.idx < s.base ? ' (one Column lower for one Cycle after 14+ days off)' : ''}.`;
      if (s.flat >= 2) startDeload('2 Max Tests in a row with no gain');
    } else {
      const day = Number(r.day);
      const ok = passed(planned(Number(r.week), Number(r.col), day), sets(r.done));
      if (pain > 3) {
        Object.assign(s, { next: String(day), restDays: 2 });
        s.why = `Pain ${pain}/10: rest 2 days, then repeat Day ${day}.`;
      } else if (!ok) {
        s.failed++;
        if (s.failed >= 2) {
          Object.assign(s, { failed: 0, next: '1', cycleRepeat: true });
          s.why = `Day ${day} failed, 2nd fail this Cycle: repeat the whole Cycle.`;
        } else {
          s.next = String(day);
          s.why = `Day ${day} failed: repeat it.`;
        }
      } else if (day < 3) {
        s.next = String(day + 1);
        s.why = `Day ${day} passed.`;
      } else {
        s.cyclesSinceMax++;
        s.cyclesSinceDeload++;
        Object.assign(s, { failed: 0, idx: s.base, next: '1' });
        s.why = 'Day 3 passed: Cycle complete.';
        if (s.cyclesSinceDeload >= 10) startDeload('10 Cycles since the last Deload');
        else if (s.cyclesSinceMax >= 2) {
          s.next = 'max';
          s.why = 'Day 3 passed: 2nd Cycle since the last Max Test, so test next.';
        }
      }
    }
    s.last = r.date;
  }
  return s;
}

export function nextSession(rows: Row[], today: string) {
  const s = replay(rows);
  const banners: Banner[] = [];
  const lastRow = sortRows(rows).filter((r) => r.kind !== 'override').at(-1);
  const daysOff = s.last ? daysBetween(s.last, today) - 1 : 0;
  let next = s.next;
  let earliest = s.last ? addDays(s.last, s.restDays + 1) : today;
  let why = s.why;

  if (!s.deload && next !== 'max' && daysOff >= 4) {
    next = 'max';
    earliest = today;
    why = `${daysOff} days off: Max Test first${daysOff >= 14 ? ', then one Column lower for one Cycle' : ''}.`;
  }

  const best = Math.max(0, ...s.maxes);
  if (best >= 100) banners.push({ level: 'warn', text: `Goal reached: ${best} unbroken push-ups.` });
  if (s.doctor) banners.push({ level: 'red', text: 'Severe swelling or dark urine was logged: see a doctor today. Training stays stopped until you log an Override.' });
  if (s.paused) banners.push({ level: 'red', text: 'Pain logged for more than 7 days in a row: plan paused, see a clinician. Log an Override once cleared.' });
  if ((lastRow?.pain ?? 0) > 0) banners.push({ level: 'ai', text: `Pain ${lastRow?.pain}/10 logged: worth asking the AI.` });
  if (s.cycleRepeat) banners.push({ level: 'ai', text: '2nd fail this Cycle: worth asking the AI.' });
  if (lastRow?.kind === 'max' && s.flat > 0) banners.push({ level: 'ai', text: 'Max Test with no gain: worth asking the AI.' });
  if (daysOff >= 14) banners.push({ level: 'ai', text: `Back after ${daysOff} days off: worth asking the AI.` });
  if (lastRow?.kind === 'max' && (s.maxes.at(-1) ?? 0) < 31) banners.push({ level: 'ai', text: 'Max Test below Week 5 range (31+): the program says redo Week 3 or 4. Ask the AI.' });

  const [week, col] = LADDER[s.idx];
  const day = next === 'max' ? null : Number(next);
  return {
    status: s.doctor ? 'doctor' : s.paused ? 'paused' : 'train',
    next,
    week,
    col,
    sets: day ? planned(week, col, day) : [],
    restSeconds: day ? REST_SECONDS[day - 1] : null,
    earliest: earliest < today ? today : earliest,
    why,
    banners,
    state: s,
  };
}
