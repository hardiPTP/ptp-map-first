// OWNED BY AGENT C. Phase 0 placeholder so the app compiles; replaced in Phase 1.
// Contract: export `repo: Repo` chosen by VITE_DATA_SOURCE ("mock" | "emulator" | "firebase").
import type { Repo } from '../types'

export const repo: Repo = {
  init: async () => ({ deviceId: 'placeholder' }),
  subscribePins: (_b, cb) => {
    cb([])
    return () => {}
  },
  subscribeSupports: (cb) => {
    cb([])
    return () => {}
  },
  createPin: async () => {
    throw new Error('not implemented')
  },
  toggleSupport: async () => ({ supported: false }),
}
