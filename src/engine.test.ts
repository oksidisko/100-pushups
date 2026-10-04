import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSession, type Row } from './engine.ts';
import { planned } from './program.ts';

const max = (date: string, n: number, extra: Partial<Row> = {}): Row => ({ date, kind: 'max', done: String(n), ...extra });
const session = (date: string, day: number, ok = true, extra: Partial<Row> = {}, week = 6, col = 1): Row => {
  const p = planned(week, col, day);
  return { date, kind: 'session', week, col, day: String(day), done: (ok ? p : p.map((n) => n - 1)).join(' '), rpe: 8, pain: 0, ...extra };
};
const base = [max('2026-10-01', 50)];

test('baseline 50 → Week 6 C1 Day 1', () => {
  const p = nextSession(base, '2026-10-04');
  assert.deepEqual([p.next, p.week, p.col], ['1', 6, 1]);
  assert.deepEqual(p.sets, [25, 30, 20, 15, 40]);
  assert.equal(p.restSeconds, 60);
});

test('pass advances, every 2nd Cycle ends in a Max Test', () => {
  const rows = [...base, session('2026-10-04', 1), session('2026-10-06', 2)];
  assert.equal(nextSession(rows, '2026-10-07').next, '3');
  rows.push(session('2026-10-08', 3));
  assert.equal(nextSession(rows, '2026-10-09').next, '1');
  rows.push(session('2026-10-10', 1), session('2026-10-12', 2), session('2026-10-14', 3));
  const p = nextSession(rows, '2026-10-15');
  assert.equal(p.next, 'max');
  assert.equal(p.earliest, '2026-10-16');
});

test('one fail repeats the Day, two fails repeat the Cycle', () => {
  const rows = [...base, session('2026-10-04', 1), session('2026-10-06', 2, false)];
  assert.equal(nextSession(rows, '2026-10-07').next, '2');
  rows.push(session('2026-10-08', 2), session('2026-10-10', 3, false));
  const p = nextSession(rows, '2026-10-11');
  assert.equal(p.next, '1');
  assert.ok(p.banners.some((b) => b.level === 'ai'));
});

test('pain above 3 → rest 2 days, repeat the Day', () => {
  const p = nextSession([...base, session('2026-10-04', 1, true, { pain: 5 })], '2026-10-05');
  assert.equal(p.next, '1');
  assert.equal(p.earliest, '2026-10-07');
});

test('pain for more than 7 days pauses; swelling stops; Override clears', () => {
  const rows = [...base, session('2026-10-04', 1, true, { pain: 2 }), session('2026-10-06', 2, true, { pain: 2 }), session('2026-10-12', 3, true, { pain: 1 })];
  assert.equal(nextSession(rows, '2026-10-13').status, 'paused');
  const doc = nextSession([...base, session('2026-10-04', 1, true, { danger: 1 })], '2026-10-05');
  assert.equal(doc.status, 'doctor');
  rows.push({ date: '2026-10-20', kind: 'override', week: 6, col: 1, day: '1', notes: 'cleared' });
  assert.equal(nextSession(rows, '2026-10-20').status, 'train');
});

test('Max Test places the Column, Week 5 below 46', () => {
  const at = (n: number) => nextSession([max('2026-10-01', n)], '2026-10-02');
  assert.deepEqual([at(55).week, at(55).col], [6, 2]);
  assert.deepEqual([at(61).week, at(61).col], [6, 3]);
  assert.deepEqual([at(38).week, at(38).col], [5, 2]);
});

test('2 Max Tests in a row with no gain → Deload week', () => {
  const p = nextSession([max('2026-10-01', 50), max('2026-10-10', 50), max('2026-10-20', 49)], '2026-10-21');
  assert.equal(p.next, 'max');
  assert.equal(p.earliest, '2026-10-28');
});

test('missed days: 4+ → Max Test; 14+ → one Column lower after it', () => {
  assert.equal(nextSession(base, '2026-10-06').next, 'max');
  const p = nextSession([...base, max('2026-10-20', 52)], '2026-10-21');
  assert.deepEqual([p.week, p.col], [6, 1]);
});
