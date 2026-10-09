import { nextSession, passed, sets, sortRows, type Row } from './engine.ts';
import { RANGES, REST_SECONDS, RULES, TABLES, planned } from './program.ts';

type Env = { DB: any; TEAM_DOMAIN?: string; POLICY_AUD?: string; DEV?: string };

const COLUMNS = ['date', 'kind', 'week', 'col', 'day', 'done', 'rpe', 'pain', 'danger', 'video', 'notes'] as const;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
const nice = (d: string) =>
  d === today() ? 'Today' : new Date(`${d}T00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

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
const banners = (p: ReturnType<typeof nextSession>) => p.banners.map((b) => `<p class="banner ${b.level}">${esc(b.text)}</p>`).join('');

function planPage(rows: Row[]) {
  const p = nextSession(rows, today());
  const best = Math.max(0, ...p.state.maxes);
  const body = p.next === 'max'
    ? '<p class="big">1 set, all out</p><p class="muted">Chest to the floor, arms locked out at the top, no rest. Film it if you can.</p>'
    : `<ol class="chips">${p.sets.map((n, i, a) => (i === a.length - 1 ? `<li class="last">${n}+</li>` : `<li>${n}</li>`)).join('')}</ol>
<p class="muted">Rest ${p.restSeconds} s between sets. Not ready? Add 15 s at a time, up to ${2 * p.restSeconds} s. Last set: as many as you can, at least ${p.sets.at(-1)}.</p>`;
  return `${banners(p)}
<section class="card hero">
<p class="eyebrow">Next session · ${nice(p.earliest)}</p>
<h1>${label(p.next)}</h1>
${p.next === 'max' ? '' : `<p class="sub">Week ${p.week} · Column ${p.col} · ${sum(p.sets)} reps</p>`}
${body}
<a class="button" href="/log">Log it</a>
<p class="why">${esc(p.why)}</p>
</section>
<section class="card">
<div class="spread"><span>Best Max Test</span><strong>${best} / 100</strong></div>
<progress value="${Math.min(best, 100)}" max="100"></progress>
</section>`;
}

function rowPlan(r: Row) {
  return r.kind === 'session' ? planned(Number(r.week), Number(r.col), Number(r.day)) : [];
}

function entries(rows: Row[], editable = false) {
  const li = sortRows(rows).reverse().map((r) => {
    const plan = rowPlan(r);
    const what = r.kind === 'session' ? `Day ${r.day} · W${r.week} C${r.col}` : r.kind === 'max' ? 'Max Test' : `Override → W${r.week} C${r.col} ${label(r.day ?? '1')}`;
    const badge = r.kind === 'session'
      ? (passed(plan, sets(r.done)) ? '<span class="badge ok">pass</span>' : '<span class="badge bad">fail</span>')
      : r.kind === 'max' ? '<span class="badge max">test</span>' : '<span class="badge">override</span>';
    const reps = r.kind === 'session'
      ? `<div class="reps">${esc(r.done)} <span class="muted">/ ${plan.join(' ')}</span></div>`
      : r.kind === 'max' ? `<div class="reps">${esc(r.done)} reps${r.video ? ' · filmed' : ''}</div>` : '';
    const meta = [nice(r.date), r.rpe && `RPE ${r.rpe}`, r.pain && `pain ${r.pain}/10`, r.danger && 'swelling or dark urine'].filter(Boolean).join(' · ');
    const edit = editable && r.id ? ` · <a href="/log?edit=${r.id}">Edit</a>` : '';
    return `<li class="entry"><div class="spread"><strong>${esc(what)}</strong>${badge}</div>
<div class="muted small">${esc(meta)}${edit}</div>${reps}${r.notes ? `<p class="note">${esc(r.notes)}</p>` : ''}</li>`;
  });
  return `<ul class="entries">${li.join('')}</ul>`;
}

function progressPage(rows: Row[]) {
  const sorted = sortRows(rows);
  const maxes = sorted.filter((r) => r.kind === 'max').map((r) => ({ x: r.date, y: sets(r.done)[0] ?? 0 }));
  // One bar per date trained.
  const days: Record<string, number> = {};
  for (const r of sorted.filter((r) => r.kind !== 'override')) days[r.date] = (days[r.date] ?? 0) + sum(sets(r.done));
  const stat = (n: unknown, what: string) => `<div class="stat"><strong>${n}</strong><span>${what}</span></div>`;
  return `<h1>Progress</h1>
<div class="stats">${stat(Math.max(0, ...maxes.map((m) => m.y)), 'best')}${stat(sorted.filter((r) => r.kind === 'session').length, 'sessions')}${stat(sum(Object.values(days)), 'total reps')}</div>
<section class="card"><h2>Max Test</h2><div class="chart"><canvas id="max"></canvas></div></section>
<section class="card"><h2>Volume per day</h2><div class="chart"><canvas id="vol"></canvas></div></section>
<h2>Log</h2>${entries(rows)}
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
const maxes = ${json(maxes)}, days = ${json(days)};
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const short = (d) => new Date(d + 'T00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const accent = css('--accent');
Object.assign(Chart.defaults, { color: css('--muted'), borderColor: css('--line'), maintainAspectRatio: false });
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
new Chart(max, { type: 'line', data: { labels: maxes.map(m => short(m.x)), datasets: [
  { label: 'Max Test', data: maxes.map(m => m.y), borderColor: accent, backgroundColor: accent, borderWidth: 3, pointRadius: 5, tension: 0.3 },
  { label: 'Goal', data: maxes.map(() => 100), borderColor: css('--muted'), borderDash: [6, 4], pointRadius: 0 },
] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, suggestedMax: 100, ticks: { stepSize: 25 } } } } });
new Chart(vol, { type: 'bar', data: { labels: Object.keys(days).map(short), datasets: [
  { label: 'Reps', data: Object.values(days), backgroundColor: accent, borderRadius: 8 },
] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } } });
</script>`;
}

function programPage() {
  const week = (w: number) => [1, 2, 3].map((day) =>
    `<section class="card"><h3>Week ${w} · Day ${day} <span class="muted">· rest ${REST_SECONDS[day - 1]} s</span></h3><div class="scroll"><table>${[1, 2, 3].map((c) =>
      `<tr><th>C${c}<small>${RANGES[w][c - 1]}</small></th>${TABLES[w][c][day - 1].map((n, i, a) => `<td>${n}${i === a.length - 1 ? '+' : ''}</td>`).join('')}</tr>`).join('')}</table></div></section>`).join('');
  return `<h1>Program</h1>
<section class="card"><p>Hundred Pushups (<a href="https://hundredpushups.com">hundredpushups.com</a>), Weeks 5 and 6. A Push-up is chest to the floor, arms locked out at the top, body straight.</p>
<h2>Rules</h2><ol class="rules">${RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></section>
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
    const field = (k: string, v: unknown) => `<label>${k}<input name="${k}" value="${esc(v)}"></label>`;
    return `<h1>Edit entry</h1>
<form method="post" class="card stack"><input type="hidden" name="id" value="${editing.id}">
${field('date', editing.date)}${field('kind', editing.kind)}
<div class="trio">${field('week', editing.week)}${field('col', editing.col)}${field('day', editing.day)}</div>
${field('done', editing.done)}
<div class="pair">${field('rpe', editing.rpe)}${field('pain', editing.pain)}</div>
${field('notes', editing.notes)}
<label class="check"><input type="checkbox" name="danger" ${editing.danger ? 'checked' : ''}> Severe swelling or dark urine</label>
<label class="check"><input type="checkbox" name="video" ${editing.video ? 'checked' : ''}> Filmed</label>
<div class="pair"><button>Save</button><button name="action" value="delete" class="danger">Delete</button></div></form>
<p class="center"><a href="/log">Cancel</a></p>`;
  }

  const p = nextSession(rows, today());
  const day = ['1', '2', '3', 'max'].includes(q.get('day') ?? '') ? q.get('day')! : p.next;
  const isMax = day === 'max';
  const reps = isMax ? [] : planned(p.week, p.col, Number(day));
  const boxes = isMax
    ? '<label class="set">Reps<input name="s0" type="number" inputmode="numeric" min="0" required></label>'
    : reps.map((n, i) => `<label class="set">Set ${i + 1}${i === reps.length - 1 ? '+' : ''}<input name="s${i}" type="number" inputmode="numeric" min="0" value="${n}" required></label>`).join('');
  return `${banners(p)}
<h1>Log</h1>
<p class="muted">${isMax ? 'One all-out set.' : `Week ${p.week} · Column ${p.col}. Boxes hold the plan; change any set you missed.`}</p>
<form method="post" class="card stack">
<input type="hidden" name="kind" value="${isMax ? 'max' : 'session'}"><input type="hidden" name="week" value="${p.week}"><input type="hidden" name="col" value="${p.col}">
<div class="pair"><label>Date<input name="date" type="date" value="${today()}"></label>
<label>Session<select name="day" onchange="location.search='?day='+this.value">${['1', '2', '3', 'max'].map((d) =>
    `<option value="${d}" ${d === day ? 'selected' : ''}>${label(d)}</option>`).join('')}</select></label></div>
<fieldset><legend>Reps</legend><div class="sets">${boxes}</div></fieldset>
${isMax ? '<label class="check"><input type="checkbox" name="video"> Filmed</label>' : ''}
<div class="pair"><label>RPE<select name="rpe" required><option value="">–</option>${[...Array(10)].map((_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
<label>Pain 0–10<input name="pain" type="number" inputmode="numeric" min="0" max="10" value="0"></label></div>
<label class="check"><input type="checkbox" name="danger"> Severe arm swelling or dark urine</label>
<label>Notes<textarea name="notes" maxlength="500" rows="2"></textarea></label>
<button>Save</button>
</form>
<section class="card stack">
<h2>Ask the AI</h2>
<p class="muted">Copies the rules, the plan and the last 10 entries as a prompt for any LLM.</p>
<button type="button" class="ghost" onclick="navigator.clipboard.writeText(ai.value).then(() => this.textContent = 'Copied')">Copy for AI</button>
<details><summary>Show prompt</summary><textarea id="ai" readonly rows="10">${esc(aiPrompt(rows, p))}</textarea></details>
</section>
<details class="card"><summary>Override the plan</summary>
<form method="post" class="stack"><input type="hidden" name="kind" value="override">
<label>Date<input name="date" type="date" value="${today()}"></label>
<div class="trio"><label>Week<select name="week"><option>6</option><option>5</option></select></label>
<label>Column<select name="col"><option>1</option><option>2</option><option>3</option></select></label>
<label>Next<select name="day">${['1', '2', '3', 'max'].map((d) => `<option value="${d}">${d === 'max' ? 'Max' : `Day ${d}`}</option>`).join('')}</select></label></div>
<label>Reason<input name="notes" required maxlength="500"></label>
<button>Save override</button></form></details>
<h2>History</h2>${entries(rows, true)}
<p class="center"><a href="/log/export.csv">Export CSV</a></p>`;
}

const NAV = [['/', 'Plan'], ['/progress', 'Progress'], ['/program', 'Program'], ['/log', 'Log']];

function html(title: string, body: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)">
<title>${title} · 100 Push-ups</title>
<style>
:root { color-scheme: light; --bg: #f4f5f7; --card: #fff; --ink: #15171c; --muted: #6b7080; --line: #e3e5ea; --accent: #f2541b; --ok: #1d8f4e; --bad: #d23f3f; --red: #fde4e2; --warn: #fff3d1; --ai: #e8eeff; }
@media (prefers-color-scheme: dark) { :root { color-scheme: dark; --bg: #0f1115; --card: #181b21; --ink: #eceef2; --muted: #8b91a0; --line: #2a2e37; --accent: #ff7440; --ok: #3ccf7e; --bad: #ff6b6b; --red: #3f1c1c; --warn: #3a3016; --ai: #1b2542; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
main { max-width: 560px; margin: 0 auto; padding: 16px 16px calc(96px + env(safe-area-inset-bottom)); }
h1 { font-size: 28px; line-height: 1.2; margin: 8px 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 18px; margin: 28px 0 10px; }
.card h2, .card h3 { margin: 0 0 10px; font-size: 17px; }
p { margin: 0 0 12px; }
a { color: var(--accent); }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.center { text-align: center; margin-top: 16px; }
.spread { display: flex; justify-content: space-between; align-items: center; gap: 8px; }

nav { position: fixed; inset: auto 0 0 0; z-index: 10; display: flex; gap: 4px; padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--card) 88%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
nav a { flex: 1; padding: 10px 0; border-radius: 12px; text-align: center; text-decoration: none; color: var(--muted); font-size: 14px; font-weight: 600; }
nav a[aria-current] { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
@media (min-width: 720px) {
  nav { position: sticky; top: 0; bottom: auto; justify-content: center; border-top: 0; border-bottom: 1px solid var(--line); padding: 10px; }
  nav a { flex: 0 0 120px; }
  main { padding-bottom: 48px; }
}

.card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 20px; margin: 12px 0; }
.hero h1 { font-size: 44px; margin: 0; }
.eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); margin: 0 0 4px; }
.sub { color: var(--muted); font-weight: 500; }
.big { font-size: 22px; font-weight: 700; margin: 16px 0 8px; }
.why { color: var(--muted); font-size: 14px; margin: 12px 0 0; }
.chips { list-style: none; padding: 0; margin: 16px 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(52px, 1fr)); gap: 8px; }
.chips li { aspect-ratio: 1; display: grid; place-items: center; border-radius: 16px; background: var(--bg); font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.chips li.last { background: var(--accent); color: #fff; }
progress { display: block; width: 100%; height: 10px; margin-top: 10px; appearance: none; border: 0; border-radius: 99px; background: var(--line); overflow: hidden; }
progress::-webkit-progress-bar { background: var(--line); }
progress::-webkit-progress-value { background: var(--accent); border-radius: 99px; }
progress::-moz-progress-bar { background: var(--accent); border-radius: 99px; }

.banner { margin: 12px 0; padding: 12px 14px; border-radius: 14px; font-size: 15px; border-left: 4px solid; }
.red { background: var(--red); border-color: var(--bad); }
.warn { background: var(--warn); border-color: #e0a800; }
.ai { background: var(--ai); border-color: #5b7cfa; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px; text-align: center; }
.stat strong { display: block; font-size: 26px; font-variant-numeric: tabular-nums; }
.stat span { font-size: 13px; color: var(--muted); }
.chart { position: relative; height: 220px; }

.entries { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.entry { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px; }
.reps { margin-top: 4px; font-weight: 600; font-variant-numeric: tabular-nums; }
.note { margin: 6px 0 0; font-size: 14px; }
.badge { flex: none; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: var(--line); color: var(--muted); }
.badge.ok { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
.badge.bad { background: color-mix(in srgb, var(--bad) 16%, transparent); color: var(--bad); }
.badge.max { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }

.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 15px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 4px; text-align: center; border-top: 1px solid var(--line); }
tr:first-child > * { border-top: 0; }
th { text-align: left; white-space: nowrap; }
th small { display: block; font-weight: 400; font-size: 12px; color: var(--muted); }
td:last-child { font-weight: 700; color: var(--accent); }
.rules { padding-left: 20px; margin: 0; }
.rules li { margin-bottom: 8px; }

.stack { display: flex; flex-direction: column; gap: 16px; }
.pair, .trio { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.trio { grid-template-columns: repeat(3, 1fr); }
label, legend { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
legend { padding: 0; margin-bottom: 6px; }
input, select, textarea { width: 100%; min-height: 48px; padding: 12px; font: inherit; font-size: 16px; font-weight: 400; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 12px; }
input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.sets { display: grid; grid-template-columns: repeat(auto-fit, minmax(52px, 1fr)); gap: 8px; }
.set { align-items: center; }
input[type=number] { -moz-appearance: textfield; appearance: textfield; }
input::-webkit-inner-spin-button, input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.set input { padding: 10px 0; text-align: center; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.check { flex-direction: row; align-items: center; gap: 12px; font-size: 15px; font-weight: 500; color: var(--ink); }
.check input { width: 24px; min-height: 24px; height: 24px; flex: none; accent-color: var(--accent); }
textarea { resize: vertical; }
details summary { cursor: pointer; font-weight: 600; padding: 4px 0; }
details[open] summary { margin-bottom: 12px; }
details textarea { font-size: 13px; }
button, .button { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; margin: 0; padding: 0 16px; border: 0; border-radius: 14px; background: var(--accent); color: #fff; font: inherit; font-size: 17px; font-weight: 700; text-decoration: none; cursor: pointer; }
.hero .button { margin-top: 16px; }
button:active, .button:active { transform: scale(0.98); }
button.ghost, button.danger { background: transparent; color: var(--accent); border: 1.5px solid currentColor; }
button.danger { color: var(--bad); }
</style></head><body>
<nav>${NAV.map(([href, name]) => `<a href="${href}"${name === title ? ' aria-current="page"' : ''}>${name}</a>`).join('')}</nav>
<main>
${body}
</main>
</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
