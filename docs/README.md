# `docs/` — GitHub Pages site

Publish this **folder** as the GitHub Pages root (`/docs` on `main`). Keep **`.nojekyll`**.

## Layout

| File | Purpose |
|------|---------|
| **`index.html`** | **Canonical documentation** — full interactive user guide with an in-page **link** to the trace viewer demo (`viewer.html`). Default URL for the site. |
| **`viewer.html`** | Single-file **React** trace viewer (same artifact as `agentqa view`); sample data when no trace is embedded. |
| **`.nojekyll`** | Disables Jekyll on GitHub Pages. |

There is no separate lightweight landing or `guide.html` — one page is the guide.

## Rebuild the demo viewer (`viewer.html`)

After UI changes in `frontend/`:

```bash
cd frontend && npm ci && npm run build
cp ../src/agentqa/viewer/index.html ../docs/viewer.html
```
