import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub Pages project URL: https://<user>.github.io/<repo>/ — set VITE_BASE_URL=/RepoName/ in CI */
function pagesBase(): string {
  const raw = process.env.VITE_BASE_URL?.trim()
  if (!raw || raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: pagesBase(),
})
