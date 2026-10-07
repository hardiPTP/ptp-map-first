// Location request, shared by the locate button (map) and "Near me" (masthead).
// PRD: location is asked only when the user taps the locate button or "Near me".
// Geolocation API: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
import { useStore } from '../store'
import type { LatLng } from '../types'

export function requestLocation(): Promise<LatLng | null> {
  const s = useStore.getState()
  if (!('geolocation' in navigator)) {
    s.setLocationStatus('denied')
    return Promise.resolve(null)
  }
  s.setLocationStatus('prompting')
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const st = useStore.getState()
        st.setUserLocation(loc)
        st.setLocationStatus('granted')
        resolve(loc)
      },
      () => {
        useStore.getState().setLocationStatus('denied')
        resolve(null)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
