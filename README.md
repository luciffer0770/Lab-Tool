# A2L Engineering Workbench

**Subtitle:** Automotive Electronics Laboratory — NITK Surathkal

Offline-first engineering UI for ASAP2 / A2L datasets: structured exploration, INCA-style experiment generation, exports, and a Python API.

## Repository layout

- `a2l_parser/` — Python parser and experiment generator (shared logic).
- `frontend/` — React + TypeScript + Vite + Tailwind + AG Grid + Recharts + React Flow SPA.
- `backend/` — FastAPI service (`/api/parse`, `/api/export/*`) wrapping the same parser.
- `standalone/` — Tkinter desktop tool + Windows `install_deps.bat` / `launch.bat`.

## Run the web UI (browser parsing, fully offline)

```bash
cd frontend
npm install
npm run dev
```

Open the app, then **Upload A2L**. Parsing runs entirely in the browser; no server is required.

### Optional API mode

```bash
cd backend
export PYTHONPATH="$PWD"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In `frontend/.env.local`:

```bash
VITE_API_URL=http://localhost:8000
```

## GitHub Pages

The workflow [.github/workflows/deploy-github-pages.yml](.github/workflows/deploy-github-pages.yml) builds the SPA and publishes `frontend/dist`.

1. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to a **`cursor/*`** branch (for example `cursor/a2l-engineering-workbench-a150`); the workflow runs automatically. You can also use **Actions → Deploy to GitHub Pages → Run workflow** (the list often reflects workflows on the default branch—if you do not see it, use a push to your `cursor/**` branch to deploy).

3. Open **`https://<your-username>.github.io/<repository-name>/`** (for this repo: `https://luciffer0770.github.io/Lab-Tool/`).

To deploy from other branch names, add them under `on.push.branches` in the workflow file (or use a `cursor/**`-style name).

## Deploy (static hosting)

### Netlify

Root `netlify.toml` builds `frontend/` and publishes `frontend/dist`.

### Vercel

Set the project **Root Directory** to `frontend`, then deploy. `frontend/vercel.json` keeps SPA routes on refresh.

## Standalone Python GUI (Windows)

From the repository root:

1. Run `standalone\install_deps.bat` (installs backend requirements + docx/xlsx helpers).
2. Run `standalone\launch.bat`.

On Linux/macOS:

```bash
export PYTHONPATH=/path/to/repo
python3 standalone/gui.py
```

## Notes

- Branding follows the requested light industrial palette; no third-party vendor trademarks are embedded in product naming.
- Large A2L files are supported; experiment generation caps at 3000 items for UI responsiveness.
