import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], test: { include: ['tests/frontend/**/*.test.{ts,tsx}'], setupFiles: ['tests/frontend/setup.ts'], maxWorkers: 1, testTimeout: 15000 } })
