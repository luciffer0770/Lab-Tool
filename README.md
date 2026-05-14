# A2L Engineering Workbench

**Subtitle:** Automotive Electronics Laboratory — NITK Surathkal

> **If you see this README as a “website”, you are on the wrong URL or Pages is pointed at the wrong source.**  
> - The **GitHub code page** (`github.com/.../Lab-Tool`) always shows this README — that is normal; it is **not** the app.  
> - The **running tool** is the static build at **`https://luciffer0770.github.io/Lab-Tool/`** (replace owner/repo if you forked).  
> - In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** (not *Deploy from a branch* / `/ (root)`). Branch-only hosting serves files from the repo root, where there is no `index.html`, so GitHub may only show this README.

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

The workflow [.github/workflows/deploy-github-pages.yml](.github/workflows/deploy-github-pages.yml) builds the SPA and publishes **`frontend/dist`** (that folder contains `index.html` and assets — that is what must be served).

### Wrong vs right

| What you see | Cause | Fix |
|--------------|--------|-----|
| README text on **`github.com/.../Lab-Tool`** | You are on the **repository home** (docs only). | Open the **Pages** URL below, or run the app locally (`npm run dev`). |
| README or plain text on **`*.github.io/Lab-Tool/`** | Pages is set to **Deploy from a branch** using repo **root** (no built `index.html`). | **Settings → Pages → Source: GitHub Actions**. Re-run the workflow. |
| Blank or 404 on **`*.github.io/Lab-Tool/`** | Workflow failed or Pages not enabled. | **Actions** tab → open **Deploy to GitHub Pages** → fix errors; confirm Pages uses **GitHub Actions**. |

### Steps

1. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (not “Deploy from a branch”).
2. Push to a **`cursor/*`** branch (for example `cursor/a2l-engineering-workbench-a150`); the workflow runs automatically. You can also use **Actions → Deploy to GitHub Pages → Run workflow** (the list often reflects workflows on the default branch—if you do not see it, use a push to your `cursor/**` branch to deploy).

3. Open the **live app**: **`https://luciffer0770.github.io/Lab-Tool/`** (project site — this should load the React UI with **Upload A2L** in the header).

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
