CREATE TABLE log (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('session', 'max', 'override')),
  week INTEGER,
  col INTEGER,
  day TEXT,
  done TEXT,
  rpe INTEGER,
  pain INTEGER NOT NULL DEFAULT 0,
  danger INTEGER NOT NULL DEFAULT 0,
  video INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);

INSERT INTO log (date, kind, done, notes) VALUES ('2026-10-01', 'max', '50', 'Baseline');
