// Data layer entry. `repo` is chosen by VITE_DATA_SOURCE: "mock" (default) | "emulator" | "firebase".
import type { Repo } from '../types'
import { createFirestoreRepo } from './firestoreRepo'
import { createMockRepo } from './mockRepo'

const source = import.meta.env.VITE_DATA_SOURCE

export const repo: Repo =
  source === 'emulator' || source === 'firebase' ? createFirestoreRepo(source) : createMockRepo()
