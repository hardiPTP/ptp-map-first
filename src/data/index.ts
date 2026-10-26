// Data layer entry. `repo` is chosen by VITE_DATA_SOURCE: "mock" (default) | "emulator" | "firebase".
import type { Repo } from '../types'
import { createFirestoreRepo } from './firestoreRepo'
import { createMockRepo } from './mockRepo'

const source = import.meta.env.VITE_DATA_SOURCE

function make(): Repo {
  if (source === 'emulator' || source === 'firebase') return createFirestoreRepo(source)
  const mock = createMockRepo()
  // Dev builds on mock data only: the team's "approve this claim" step (Firestore: done in the console or Admin SDK).
  // Never in production builds. DECISIONS.md 2026-10-22.
  if (import.meta.env.DEV) (window as unknown as { ptpTeam: unknown }).ptpTeam = { approveClaim: mock.approveClaim }
  return mock
}

export const repo: Repo = make()
