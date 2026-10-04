import { nextSession, passed, sets, sortRows, type Row } from './engine.ts';
import { RANGES, REST_SECONDS, RULES, TABLES, planned } from './program.ts';

type Env = { DB: any; TEAM_DOMAIN?: string; POLICY_AUD?: string; DEV?: string };

const COLUMNS = ['date', 'kind', 'week', 'col', 'day', 'done', 'rpe', 'pain', 'danger', 'video', 'notes'] as const;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (path.startsWith('/log')) {
      if (!(await authorized(req, env))) return new Response('Forbidden: Cloudflare Access is not set up or you are not signed in.', { status: 403 });
      if (req.method === 'POST') {
        if (req.headers.get('origin') !== url.origin) return new Response('Bad origin', { status: 403 });
        await write(env, await req.formData());
        return Response.redirect(`${url.origin}/log`, 303);
      }
    }
    const { results: rows } = await env.DB.prepare('SELECT * FROM log').all();
    if (path === '/') return html('Plan', planPage(rows));
    if (path === '/progress') return html('Progress', progressPage(rows));
    if (path === '/program') return html('Program', programPage());
    if (path === '/log') return html('Log', logPage(rows, url.searchParams));
    if (path === '/log/export.csv') return csv(rows);
    return new Response('Not found', { status: 404 });
  },
};

// Verifies the Cloudflare Access JWT; without TEAM_DOMAIN and POLICY_AUD set, every write is refused.
async function authorized(req: Request, env: Env) {
  if (env.DEV === '1') return true;
  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) return false;
  try {
    const [h, p, sig] = token.split('.');
    const bytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const header = JSON.parse(new TextDecoder().decode(bytes(h)));
    const claims = JSON.parse(new TextDecoder().decode(bytes(p)));
    if (claims.iss !== `https://${env.TEAM_DOMAIN}` || ![].concat(claims.aud).includes(env.POLICY_AUD as never) || claims.exp * 1000 < Date.now()) return false;
    const { keys } = (await (await fetch(`https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`)).json()) as { keys: any[] };
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(sig), new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return false;
  }
}

async function write(env: Env, f: FormData) {
  const get = (k: string) => String(f.get(k) ?? '').trim();
  const int = (k: string, lo: number, hi: number) => {
    const n = parseInt(get(k), 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
  };
  const id = int('id', 1, Number.MAX_SAFE_INTEGER);
  if (get('action') === 'delete' && id) return env.DB.prepare('DELETE FROM log WHERE id = ?').bind(id).run();

  const kind = ['session', 'max', 'override'].includes(get('kind')) ? get('kind') : 'session';
  const setBoxes = [...f.keys()].filter((k) => /^s\d+$/.test(k)).sort((a, b) => +a.slice(1) - +b.slice(1));
  const done = setBoxes.length ? setBoxes.map(get).filter(Boolean).map(Number).join(' ') : sets(get('done')).join(' ');
  const row = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(get('date')) ? get('date') : today(),
    kind,
    week: int('week', 5, 6),
    col: int('col', 1, 3),
    day: ['1', '2', '3', 'max'].includes(get('day')) ? get('day') : null,
    done,
    rpe: int('rpe', 1, 10),
    pain: int('pain', 0, 10) ?? 0,
    danger: f.get('danger') ? 1 : 0,
    video: f.get('video') ? 1 : 0,
    notes: get('notes').slice(0, 500),
  };
  const values = COLUMNS.map((c) => row[c]);
  if (id) return env.DB.prepare(`UPDATE log SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).bind(...values, id).run();
  return env.DB.prepare(`INSERT INTO log (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`).bind(...values).run();
}

function csv(rows: Row[]) {
  const cell = (v: unknown) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const body = [['id', ...COLUMNS].join(','), ...sortRows(rows).map((r: any) => ['id', ...COLUMNS].map((c) => cell(r[c])).join(','))].join('\n');
  return new Response(body + '\n', { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="pushups.csv"' } });
}

const label = (next: string) => (next === 'max' ? 'Max Test' : `Day ${next}`);
const setsTable = (reps: number[]) =>
  `<table><tr><th>Set</th>${reps.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr><tr><th>Reps</th>${reps.map((n, i) => `<td>${n}${i === reps.length - 1 ? '+' : ''}</td>`).join('')}</tr></table>`;
const banners = (p: ReturnType<typeof nextSession>) => p.banners.map((b) => `<p class="banner ${b.level}">${esc(b.text)}</p>`).join('');

function planPage(rows: Row[]) {
  const p = nextSession(rows, today());
  const best = Math.max(0, ...p.state.maxes);
  const body = p.next === 'max'
    ? '<p>One all-out unbroken set: chest to the floor, arms locked out at the top, no rest.</p>'
    : `${setsTable(p.sets)}<p>Rest ${p.restSeconds} s between sets (longer if needed). The last set is as many as you can, at least the number shown.</p>`;
  return `${banners(p)}
<h1>Next: ${label(p.next)}${p.next === 'max' ? '' : ` · Week ${p.week} C${p.col}`}</h1>
<p class="muted">Earliest ${p.earliest} · ${esc(p.why)}</p>
${body}
<p><a class="button" href="/log">Log it</a></p>
<p class="muted">Best Max Test: ${best} of 100.</p>`;
}

function rowPlan(r: Row) {
  return r.kind === 'session' ? planned(Number(r.week), Number(r.col), Number(r.day)) : [];
}

function logTable(rows: Row[], editable = false) {
  const tr = sortRows(rows).reverse().map((r) => {
    const plan = rowPlan(r);
    const what = r.kind === 'session' ? `W${r.week} C${r.col} D${r.day}` : r.kind === 'max' ? 'Max Test' : `Override → W${r.week} C${r.col} ${label(r.day ?? '1')}`;
    const result = r.kind === 'session' ? (passed(plan, sets(r.done)) ? 'pass' : 'fail') : r.kind === 'max' ? (r.video ? 'video' : '') : '';
    const edit = editable && r.id ? `<td><a href="/log?edit=${r.id}">edit</a></td>` : '';
    return `<tr><td>${esc(r.date)}</td><td>${esc(what)}</td><td>${esc(plan.join(' '))}</td><td>${esc(r.done)}</td><td>${result}</td><td>${esc(r.rpe)}</td><td>${r.pain ? esc(r.pain) : ''}</td><td>${esc(r.notes)}</td>${edit}</tr>`;
  });
  return `<div class="scroll"><table><tr><th>Date</th><th>What</th><th>Planned</th><th>Done</th><th>Result</th><th>RPE</th><th>Pain</th><th>Notes</th>${editable ? '<th></th>' : ''}</tr>${tr.join('')}</table></div>`;
}

function progressPage(rows: Row[]) {
  const sorted = sortRows(rows);
  const maxes = sorted.filter((r) => r.kind === 'max').map((r) => ({ x: r.date, y: sets(r.done)[0] ?? 0 }));
  const weeks: Record<string, number> = {};
  for (const r of sorted.filter((r) => r.kind !== 'override')) {
    const d = new Date(r.date);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    weeks[monday] = (weeks[monday] ?? 0) + sets(r.done).reduce((a, b) => a + b, 0);
  }
  return `<h1>Progress</h1>
<h2>Max Test</h2><canvas id="max" height="220"></canvas>
<h2>Weekly volume</h2><canvas id="vol" height="220"></canvas>
<h2>Log</h2>${logTable(rows)}
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
const maxes = ${json(maxes)}, weeks = ${json(weeks)};
const ink = getComputedStyle(document.body).color;
Chart.defaults.color = ink;
new Chart(max, { type: 'line', data: { labels: maxes.map(m => m.x), datasets: [
  { label: 'Max Test', data: maxes.map(m => m.y), borderColor: '#2f6fde', tension: 0.2 },
  { label: 'Goal', data: maxes.map(() => 100), borderColor: '#999', borderDash: [6, 4], pointRadius: 0 },
] }, options: { scales: { y: { beginAtZero: true, suggestedMax: 100 } } } });
new Chart(vol, { type: 'bar', data: { labels: Object.keys(weeks).map(w => 'wk of ' + w), datasets: [
  { label: 'Reps', data: Object.values(weeks), backgroundColor: '#2f6fde' },
] }, options: { plugins: { legend: { display: false } } } });
</script>`;
}

function programPage() {
  const week = (w: number) => [1, 2, 3].map((day) =>
    `<h3>Week ${w} · Day ${day} (rest ${REST_SECONDS[day - 1]} s)</h3><div class="scroll"><table>${[1, 2, 3].map((c) =>
      `<tr><th>C${c} (${RANGES[w][c - 1]})</th>${TABLES[w][c][day - 1].map((n, i, a) => `<td>${n}${i === a.length - 1 ? '+' : ''}</td>`).join('')}</tr>`).join('')}</table></div>`).join('');
  return `<h1>Program</h1>
<p>Hundred Pushups (<a href="https://hundredpushups.com">hundredpushups.com</a>), Weeks 5 and 6. A Push-up is chest to the floor, arms locked out at the top, body straight.</p>
<h2>Rules</h2><ol>${RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
<h2>Week 6</h2>${week(6)}<h2>Week 5</h2>${week(5)}`;
}

function aiPrompt(rows: Row[], p: ReturnType<typeof nextSession>) {
  const recent = sortRows(rows).slice(-10).map((r) => COLUMNS.map((c) => (r as any)[c] ?? '').join(',')).join('\n');
  const lastNote = sortRows(rows).filter((r) => r.notes).at(-1)?.notes ?? '(none)';
  return `I'm training for 100 unbroken chest-to-floor push-ups with the Hundred Pushups program (Weeks 5-6). An app applies these rules:
${RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}

The app's next session: ${label(p.next)}, Week ${p.week} C${p.col}, earliest ${p.earliest}. Reason: ${p.why}
Notes from the app: ${p.banners.map((b) => b.text).join(' ') || 'none'}

Last 10 log rows (${COLUMNS.join(',')}; done = reps per set):
${recent}

Latest note: ${lastNote}

Should I follow the app's plan or change it? If it should change, give the exact override: week (5 or 6), column (1-3), and next day (1, 2, 3 or max), with a one-line reason. Flag anything that needs a doctor.`;
}

function logPage(rows: Row[], q: URLSearchParams) {
  const editId = Number(q.get('edit'));
  const editing = rows.find((r) => r.id === editId);
  if (editing) {
    const field = (k: string, v: unknown) => `<label>${k} <input name="${k}" value="${esc(v)}"></label>`;
    return `<h1>Edit row ${editing.id}</h1>
<form method="post"><input type="hidden" name="id" value="${editing.id}">
${field('date', editing.date)}${field('kind', editing.kind)}${field('week', editing.week)}${field('col', editing.col)}${field('day', editing.day)}
${field('done', editing.done)}${field('rpe', editing.rpe)}${field('pain', editing.pain)}${field('notes', editing.notes)}
<label><input type="checkbox" name="danger" ${editing.danger ? 'checked' : ''}> Severe swelling or dark urine</label>
<label><input type="checkbox" name="video" ${editing.video ? 'checked' : ''}> Video</label>
<button>Save</button> <button name="action" value="delete" class="secondary">Delete</button></form>
<p><a href="/log">Cancel</a></p>`;
  }

  const p = nextSession(rows, today());
  const day = ['1', '2', '3', 'max'].includes(q.get('day') ?? '') ? q.get('day')! : p.next;
  const isMax = day === 'max';
  const reps = isMax ? [] : planned(p.week, p.col, Number(day));
  const boxes = isMax
    ? '<label>Reps <input name="s0" type="number" inputmode="numeric" min="0" required></label><label><input type="checkbox" name="video"> Video</label>'
    : reps.map((n, i) => `<label>Set ${i + 1}${i === reps.length - 1 ? '+' : ''} <input name="s${i}" type="number" inputmode="numeric" min="0" value="${n}" required></label>`).join('');
  return `${banners(p)}
<h1>Log</h1>
<form method="post" class="log">
<input type="hidden" name="kind" value="${isMax ? 'max' : 'session'}"><input type="hidden" name="week" value="${p.week}"><input type="hidden" name="col" value="${p.col}">
<label>Date <input name="date" type="date" value="${today()}"></label>
<label>What <select name="day" onchange="location.search='?day='+this.value">${['1', '2', '3', 'max'].map((d) =>
    `<option value="${d}" ${d === day ? 'selected' : ''}>${label(d)}${d === 'max' ? '' : ` · W${p.week} C${p.col}`}</option>`).join('')}</select></label>
<div class="sets">${boxes}</div>
<label>RPE <select name="rpe" required><option value="">–</option>${[...Array(10)].map((_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
<label>Pain (0–10) <input name="pain" type="number" inputmode="numeric" min="0" max="10" value="0"></label>
<label><input type="checkbox" name="danger"> Severe arm swelling or dark urine</label>
<label>Notes <input name="notes" maxlength="500"></label>
<button>Save</button>
</form>
<h2>Ask the AI</h2>
<textarea id="ai" readonly rows="6">${esc(aiPrompt(rows, p))}</textarea>
<button onclick="navigator.clipboard.writeText(ai.value).then(() => this.textContent = 'Copied')">Copy for AI</button>
<details><summary>Override the plan</summary>
<form method="post"><input type="hidden" name="kind" value="override">
<label>Date <input name="date" type="date" value="${today()}"></label>
<label>Week <select name="week"><option>6</option><option>5</option></select></label>
<label>Column <select name="col"><option>1</option><option>2</option><option>3</option></select></label>
<label>Next <select name="day">${['1', '2', '3', 'max'].map((d) => `<option value="${d}">${label(d)}</option>`).join('')}</select></label>
<label>Reason <input name="notes" required maxlength="500"></label>
<button>Save override</button></form></details>
<h2>History</h2>${logTable(rows, true)}
<p><a href="/log/export.csv">Export CSV</a></p>`;
}

function html(title: string, body: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · 100 Push-ups</title>
<style>
:root { --bg: #fff; --ink: #1b1b1f; --muted: #666; --line: #ddd; --accent: #2f6fde; --red: #fde2e1; --warn: #fff4d6; --ai: #e6efff; }
@media (prefers-color-scheme: dark) { :root { --bg: #16171b; --ink: #e8e8ea; --muted: #9a9aa2; --line: #33343a; --accent: #6b9cff; --red: #4a1f1f; --warn: #43391a; --ai: #1d2a44; } }
* { box-sizing: border-box; }
body { margin: 0 auto; max-width: 720px; padding: 0 16px 48px; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
nav { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--line); }
a { color: var(--accent); }
.muted { color: var(--muted); }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; margin: 8px 0; }
th, td { border: 1px solid var(--line); padding: 4px 8px; text-align: center; white-space: nowrap; }
td:last-child { white-space: normal; }
.banner { padding: 8px 12px; border-radius: 6px; }
.red { background: var(--red); } .warn { background: var(--warn); } .ai { background: var(--ai); }
form label { display: block; margin: 8px 0; }
.sets { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
input, select, textarea, button { font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; }
input[type=number] { width: 100%; }
textarea { width: 100%; }
button, .button { background: var(--accent); color: #fff; border: 0; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block; cursor: pointer; }
button.secondary { background: var(--muted); }
</style></head><body>
<nav><a href="/">Plan</a><a href="/progress">Progress</a><a href="/program">Program</a><a href="/log">Log</a></nav>
${body}
</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
