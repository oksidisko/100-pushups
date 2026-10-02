---
title: How to chart a markdown log on plain GitHub Pages?
labels: [wayfinder:research]
status: open
assignee: kirill
blocked_by: []
---

## Question

What is the minimal way to show a progress chart (max reps over time, weekly volume) on a GitHub Pages site built from markdown with the default Jekyll build, no custom Actions if possible? The data source should be a human-readable log the agent appends to (e.g. a markdown table in `log.md`, or a CSV in `_data/` rendered as a table). Compare 2–3 options (e.g. client-side JS parsing the rendered table, Jekyll `_data` + Liquid feeding a CDN chart library, Mermaid `xychart` if GitHub Pages supports it) on: lines of code, fragility to hand edits, works in default theme. Confirm what GitHub Pages' default Jekyll supports (Mermaid, `_data` CSV, allowed plugins).
