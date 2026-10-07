// Locate button. Location is requested only here (and "Near me"). Denied: stay on Bandra West, no dialogs.
import { ShellButton } from '../design/primitives'
import { requestLocation } from '../lib/locate'
import { useStore } from '../store'

export function LocateButton() {
  const onTap = async () => {
    const loc = await requestLocation()
    if (!loc) return
    const s = useStore.getState()
    s.setAreaMode('nearMe')
    s.requestFlyTo({ ...loc, zoom: 16 })
  }
  return <ShellButton icon="ic-target" label="Show my location" size={46} onClick={onTap} />
}
