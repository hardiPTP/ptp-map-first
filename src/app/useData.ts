import { useEffect } from 'react'
import { repo } from '../data'
import { useStore } from '../store'

/** Connects the repo to the store once per session. */
export function useData() {
  useEffect(() => {
    let off1 = () => {}
    let off2 = () => {}
    let off3 = () => {}
    let off4 = () => {}
    let cancelled = false
    repo.init().then(({ deviceId }) => {
      if (cancelled) return
      const s = useStore.getState()
      s.setDeviceId(deviceId)
      off1 = repo.subscribePins(null, s.setPins)
      off2 = repo.subscribeSupports(s.setSupports)
      off3 = repo.subscribeComments(s.setComments)
      off4 = repo.subscribeClaims(s.setClaims)
    })
    return () => {
      cancelled = true
      off1()
      off2()
      off3()
      off4()
    }
  }, [])
}
