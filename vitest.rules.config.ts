import { defineConfig } from 'vitest/config'

// Runs against the Firestore emulator only (via `npm run test:rules`).
export default defineConfig({
  test: { environment: 'node', fileParallelism: false, include: ['tests/rules/**/*.test.ts'], testTimeout: 20000 },
})
