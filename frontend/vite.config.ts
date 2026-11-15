import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The Rover and the Academy are their own pages (`rover/`, `academy/`). Their assets are
 * linked relatively, so `/rover` without the trailing slash would resolve them against
 * the wrong folder. Static hosts add the slash themselves; do the same in dev and preview.
 */
function experienceSlashes(): Plugin {
  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    const [path, query] = (req.url ?? '').split('?')
    if (!/\/(rover|academy)$/.test(path)) return next()
    res.statusCode = 302
    res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`)
    res.end()
  }
  return {
    name: 'luna01-experience-slashes',
    configureServer(server) { server.middlewares.use(redirect) },
    configurePreviewServer(server) { server.middlewares.use(redirect) },
  }
}

// The UI imports the simulation engine from ../backend/src/domain, so the dev
// server must be allowed to serve files from the repository root.
export default defineConfig({
  base: './',
  plugins: [react(), tailwind(), experienceSlashes()],
  server: { fs: { allow: ['..'] } },
  build: {
    rollupOptions: {
      input: { main: page('index.html'), rover: page('rover/index.html'), academy: page('academy/index.html') },
    },
  },
})
