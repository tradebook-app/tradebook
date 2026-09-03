import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // Mirror tsconfig's "@/*": ["./src/*"] so tests can import app modules the
  // same way the app does.
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/lib/**/*.test.ts'],
  },
})
