#!/bin/sh
# Full-flow e2e on the Firestore/Auth emulators (no live Firestore). Run via `npm run e2e:emulator`.
# Seeds from cached Places responses (0 Google calls), serves the app on :5174 with VITE_DATA_SOURCE=emulator,
# runs the emulator specs, then stops everything.
set -e
npx tsx scripts/seed.ts --target=emulator
VITE_DATA_SOURCE=emulator npx vite --port 5174 --strictPort >/dev/null 2>&1 &
VITE_PID=$!
trap 'kill $VITE_PID 2>/dev/null' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:5174 && break; sleep 1; done
npx playwright test tests/e2e/create.spec.ts tests/e2e/flow.spec.ts
