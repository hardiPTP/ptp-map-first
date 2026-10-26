import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Google is mocked: a map that only knows its zoom.
let liveZoom = 15
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => ({ getZoom: () => liveZoom }) }))

import { MAX_ZOOM, MIN_ZOOM, ZoomButtons } from '../../src/map/ZoomButtons'
import { useStore } from '../../src/store'

const centre = { lat: 19.06, lng: 72.83 }

beforeEach(() => {
  cleanup()
  liveZoom = 15
  useStore.setState({ flyTo: null, viewport: { bounds: null, zoom: 15, center: centre } })
})

describe('zoom buttons', () => {
  it('zoom in / out by one step about the visible centre', () => {
    render(<ZoomButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(useStore.getState().flyTo).toMatchObject({ ...centre, zoom: 16 })
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(useStore.getState().flyTo).toMatchObject({ ...centre, zoom: 14 })
  })

  it('steps from the live zoom, so quick taps add up before the map settles', () => {
    liveZoom = 17 // the map is already at 17, the store still says 15 (no idle yet)
    render(<ZoomButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(useStore.getState().flyTo?.zoom).toBe(18)
  })

  it('stops at the limits', () => {
    useStore.setState({ viewport: { bounds: null, zoom: MAX_ZOOM, center: centre } })
    liveZoom = MAX_ZOOM
    const { rerender } = render(<ZoomButtons />)
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
    useStore.setState({ viewport: { bounds: null, zoom: MIN_ZOOM, center: centre } })
    liveZoom = MIN_ZOOM
    rerender(<ZoomButtons />)
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
  })
})
