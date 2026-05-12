# `docs/` — site map (GitHub Pages)

Publish this **entire folder** as the GitHub Pages root (`/docs` on `main`). Keep **`.nojekyll`** committed.

## Files and roles

| File | Role |
|------|------|
| **`index.html`** | **Landing only** — short pitch, links to the guide and viewer. Canonical URL for “share AgentQA on the web.” |
| **`guide.html`** | **Full interactive user guide** — install, `agentqa init`, workflow, properties, faults, CLI, frameworks. |
| **`viewer.html`** | **Production trace viewer** — same single-file React app as `agentqa view` / `export_html`, with built-in sample data when no trace is embedded. |
| **`demo-viewer.html`** | **Optional static preview** — lightweight in-page recreation for marketing; links to `viewer.html` for the real shipped UI. |
| **`.nojekyll`** | Tells GitHub Pages not to run Jekyll. |

There is no `guide/index.html` in this layout: everything is **flat** under `docs/` so links stay simple.

## What to send users

1. **Default:** site root → `index.html`
2. **Deep link “how to”:** `guide.html`
3. **“Show me the UI”:** `viewer.html` (matches `pip install` + README)

## After changing the React viewer

```bash
cd frontend && npm ci && npm run build
cp ../src/agentqa/viewer/index.html ../docs/viewer.html
```
