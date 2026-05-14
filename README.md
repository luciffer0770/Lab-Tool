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
cd /workspace/backend
export PYTHONPATH=/workspace/backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In `frontend/.env.local`:

```bash
VITE_API_URL=http://localhost:8000
```

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
