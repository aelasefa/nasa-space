import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// The UI imports the simulation engine from ../backend/src/domain, so the dev
// server must be allowed to serve files from the repository root.
export default defineConfig({ base: './', plugins: [react(), tailwind()], server: { fs: { allow: ['..'] } } })
