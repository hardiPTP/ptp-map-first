import { useStore } from '../store'

/**
 * "@ Place" tapped (bubble, card, detail): the sheet lists everything posted at that place, the same as tapping a
 * place dot on the map. Closes the detail view first. DECISIONS.md 2026-10-22.
 */
export function openPlace(p: { placeId: string; placeName: string; lat: number; lng: number }) {
  const s = useStore.getState()
  if (s.detailPinId) s.openDetail(null)
  s.selectPin(null)
  s.setSearchPlace({ placeId: p.placeId, placeName: p.placeName })
  s.requestFlyTo({ lat: p.lat, lng: p.lng })
  if (s.sheetHeight === 'peek') s.setSheetHeight('half')
}
