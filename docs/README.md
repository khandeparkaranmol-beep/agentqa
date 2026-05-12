# `docs/` — GitHub Pages site

Publish this **folder** as the GitHub Pages root (`/docs` on `main`). Keep **`.nojekyll`**.

## Layout

| File | Purpose |
|------|---------|
| **`index.html`** | **Canonical documentation** — full interactive user guide **plus** an embedded `<iframe src="viewer.html">` so the trace viewer demo lives on the same page. This is the default URL for the site. |
| **`viewer.html`** | Single-file **React** trace viewer (same artifact as `agentqa view`). Loaded inside `index.html` via iframe; also openable in its own tab (“Open full page”). |
| **`.nojekyll`** | Disables Jekyll on GitHub Pages. |

There is no separate lightweight landing or `guide.html` — one page is the guide.

## Rebuild the embedded viewer

After UI changes in `frontend/`:

```bash
cd frontend && npm ci && npm run build
cp ../src/agentqa/viewer/index.html ../docs/viewer.html
```
