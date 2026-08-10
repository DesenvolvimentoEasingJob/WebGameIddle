import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { contentFsPlugin } from './server/contentFsPlugin.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const contentRoot = path.resolve(rootDir, '..', 'content')

export default defineConfig({
  plugins: [react(), contentFsPlugin(contentRoot)],
  server: {
    port: 5174,
    strictPort: true,
  },
})
