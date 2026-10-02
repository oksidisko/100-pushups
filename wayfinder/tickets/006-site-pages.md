---
title: Site pages and theme
labels: [wayfinder:grilling]
status: closed
assignee: kirill
blocked_by: [4, 5]
---

## Question

Which pages does the GitHub Pages site have, and in what theme? Candidates: `README.md` as the home page (goal, link to progress), `progress.md` with the two Mermaid charts, `plan.md` rendered as the next-session page, and the log shown as a table. Decide which of these exist, whether anything besides the agent's own files needs maintaining (avoid duplicating state such as the current max), whether the default Primer theme is enough, and whether wayfinder and research files should be excluded from the site.

## Resolution

Four pages, all from files the coach already maintains. Nothing extra is kept up for the site.

1. **Home (`README.md`):** goal, Push-up standard, baseline, and links to the other pages. No current max, because the chart shows it and a copy would go stale.
2. **Progress (`progress.md`):** the two Mermaid charts plus the full log, rendered as a table from `_data/sessions.csv` with a Liquid loop (about +5 lines).
3. **Plan (`plan.md`):** rendered as-is. Its front-matter state is hidden on the site and visible on github.com.
4. **Program (`program.md`):** rendered as-is.

- **No `_config.yml`.** `wayfinder/`, `AGENTS.md` and `CONTEXT.md` get built as pages, but nothing links to them, and the repo is public anyway. Add `exclude:` only if a stray page bothers you.
- **Theme:** default Primer, no customization.
- **Publishing:** from branch `main`, root folder. One manual step: GitHub → Settings → Pages → Deploy from a branch.
