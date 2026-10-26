import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Google is mocked: no map, no places library, no network.
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => null, useMapsLibrary: () => null }))
vi.mock('../../src/data', () => ({ repo: { createPin: vi.fn() } }))
// The canvas is not in jsdom: shrinking is stubbed (lib/photo is tested on its own).
vi.mock('../../src/lib/photo', () => ({ shrinkPhoto: vi.fn(async () => 'data:image/jpeg;base64,QUJD') }))

import { repo } from '../../src/data'
import { CreateLayer, PinButton } from '../../src/create'
import { buildStartsAt, postBlocker, PLACEHOLDER } from '../../src/create/logic'
import { lookupNearest, movedEnough } from '../../src/create/nearby'
import { useStore } from '../../src/store'

const spot = { lat: 1, lng: 1 }
const createPin = vi.mocked(repo.createPin)

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useStore.setState({ pins: [], sheetHeight: 'half', selectedPinId: null, claims: [], deviceId: 'me' })
  useStore.getState().cancelCreate()
})

const openDetails = (opts?: { skip?: boolean }) => {
  act(() => {
    if (opts?.skip) useStore.getState().startCreate({ at: spot, skipToDetails: true })
    else {
      useStore.getState().startCreate()
      useStore.getState().confirmSpot(spot, { placeId: 'pid', placeName: 'Test Spot' })
    }
  })
}
const tile = (name: string) => screen.getByRole('radio', { name })
const post = () => screen.getByTestId('create-sheet').querySelector('.ptp-btn--primary') as HTMLButtonElement

describe('logic', () => {
  const now = new Date(2030, 5, 15, 14, 0).getTime()
  it('title needs 3 characters', () => {
    expect(postBlocker({ type: 'ask', title: 'ab', day: 'today', dateStr: '', timeStr: '' }, now)).toMatch(/3 letters/)
    expect(postBlocker({ type: 'ask', title: ' abc ', day: 'today', dateStr: '', timeStr: '' }, now)).toBeNull()
  })
  it('type is required', () => expect(postBlocker({ type: null, title: 'abcd', day: 'today', dateStr: '', timeStr: '' }, now)).toMatch(/Choose/))
  it('event requires a time, a date when picking one, and not in the past', () => {
    const d = { type: 'event' as const, title: 'abcd', day: 'today' as const, dateStr: '', timeStr: '' }
    expect(postBlocker(d, now)).toBe('Pick a time')
    expect(postBlocker({ ...d, timeStr: '13:00' }, now)).toMatch(/passed/)
    expect(postBlocker({ ...d, timeStr: '17:00' }, now)).toBeNull()
    expect(postBlocker({ ...d, day: 'date', timeStr: '17:00' }, now)).toBe('Pick a date')
  })
  it('builds local epoch ms for today, tomorrow, picked date', () => {
    expect(buildStartsAt('today', '', '17:00', now)).toBe(new Date(2030, 5, 15, 17, 0).getTime())
    expect(buildStartsAt('tomorrow', '', '09:30', now)).toBe(new Date(2030, 5, 16, 9, 30).getTime())
    expect(buildStartsAt('date', '2030-07-01', '08:00', now)).toBe(new Date(2030, 6, 1, 8, 0).getTime())
    expect(buildStartsAt('today', '', '', now)).toBeNull()
  })
  it('placeholders are the PRD examples', () => {
    expect(PLACEHOLDER.civic).toBe('Hawkers back on the footpath outside no. 42')
    expect(PLACEHOLDER.event).toBe('Watercolour class for beginners, Sat 5pm')
    expect(PLACEHOLDER.ask).toBe('Need someone to water plants for 3 days')
  })
})

describe('nearby lookup', () => {
  it('skips tiny moves (~10 m)', () => {
    expect(movedEnough(null, spot)).toBe(true)
    expect(movedEnough(spot, { lat: 1.00003, lng: 1 })).toBe(false) // ~3 m
    expect(movedEnough(spot, { lat: 1.0002, lng: 1 })).toBe(true) // ~22 m
  })
  it('asks for one nearest result with minimal fields', async () => {
    const searchNearby = vi.fn().mockResolvedValue({ places: [{ id: 'p1', displayName: 'Café X' }] })
    const lib = { Place: { searchNearby }, SearchNearbyRankPreference: { DISTANCE: 'DISTANCE' } } as never
    expect(await lookupNearest(lib, spot)).toEqual({ placeId: 'p1', placeName: 'Café X' })
    const req = searchNearby.mock.calls[0][0]
    expect(req.maxResultCount).toBe(1)
    expect(req.fields).toEqual(['id', 'displayName'])
    expect(req.locationRestriction.radius).toBeLessThanOrEqual(100)
  })
  it('returns null when nothing is found or the call fails', async () => {
    const empty = { Place: { searchNearby: vi.fn().mockResolvedValue({ places: [] }) }, SearchNearbyRankPreference: {} } as never
    expect(await lookupNearest(empty, spot)).toBeNull()
    const bad = { Place: { searchNearby: vi.fn().mockRejectedValue(new Error('x')) }, SearchNearbyRankPreference: {} } as never
    expect(await lookupNearest(bad, spot)).toBeNull()
  })
})

describe('PinButton', () => {
  it('is a labelled primary button that starts placing', () => {
    render(<PinButton />)
    const b = screen.getByRole('button', { name: 'Pin' })
    expect(b).toHaveClass('ptp-btn--primary')
    fireEvent.click(b)
    expect(useStore.getState().create.step).toBe('placing')
  })
})

describe('placing', () => {
  it('shows the instruction, sets the sheet to peek on entry, Back cancels', () => {
    render(<CreateLayer />)
    act(() => useStore.getState().startCreate())
    expect(screen.getByText('Move the map to the spot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use this spot' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(useStore.getState().create.step).toBe('idle')
  })
})

describe('details', () => {
  it('offers no poster choice and never mentions Place or Push The Pin', () => {
    render(<CreateLayer />)
    openDetails()
    const text = screen.getByTestId('create-sheet').textContent ?? ''
    expect(text).not.toMatch(/Push The Pin|Place|Neighbour|post as/i)
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Issue', 'Event', 'Ask'])
    expect(screen.getByTestId('create-spot')).toHaveTextContent('Test Spot')
  })

  it('Post is disabled and says why until the title has 3 characters', () => {
    render(<CreateLayer />)
    openDetails()
    expect(post()).toBeDisabled()
    expect(post()).toHaveTextContent('Choose Issue, Event or Ask')
    fireEvent.click(tile('Issue'))
    expect(screen.getByLabelText('Title')).toHaveAttribute('placeholder', PLACEHOLDER.civic)
    expect(post()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'ab' } })
    expect(post()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'abc' } })
    expect(post()).toBeEnabled()
    expect(post()).toHaveTextContent('Post')
  })

  it('an event needs a time and shows day chips', () => {
    render(<CreateLayer />)
    openDetails()
    fireEvent.click(tile('Event'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Class' } })
    expect(post()).toBeDisabled()
    expect(post()).toHaveTextContent('Pick a time')
    fireEvent.click(screen.getByRole('radio', { name: 'Tomorrow' }))
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '17:00' } })
    expect(post()).toBeEnabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    expect(post()).toHaveTextContent('Pick a date')
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
  })

  it('posts an ask via repo.createPin, then closes, selects the pin, sheet to half', async () => {
    createPin.mockResolvedValue({ id: 'new1', lat: 1, lng: 1 } as never)
    render(<CreateLayer />)
    openDetails()
    fireEvent.click(tile('Ask'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Need water  ' } })
    fireEvent.click(post())
    await waitFor(() => expect(createPin).toHaveBeenCalled())
    expect(createPin).toHaveBeenCalledWith({ type: 'ask', title: 'Need water', lat: 1, lng: 1, placeId: 'pid', placeName: 'Test Spot', startsAt: null })
    await waitFor(() => expect(useStore.getState().create.step).toBe('idle'))
    expect(useStore.getState().selectedPinId).toBe('new1')
    expect(useStore.getState().sheetHeight).toBe('half')
    expect(await screen.findByText('Pinned. It is at the top of Pulse.')).toBeInTheDocument()
  })

  it('a failed post shows a plain message and keeps the text', async () => {
    createPin.mockRejectedValue(new Error('permission denied'))
    render(<CreateLayer />)
    openDetails()
    fireEvent.click(tile('Issue'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Keep me' } })
    fireEvent.click(post())
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/)
    expect(screen.getByLabelText('Title')).toHaveValue('Keep me')
    expect(useStore.getState().create.step).toBe('details')
  })
})

describe('back paths', () => {
  const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  it('details from placing -> placing -> idle', () => {
    render(<CreateLayer />)
    act(() => useStore.getState().startCreate())
    act(() => useStore.getState().confirmSpot(spot, { placeId: null, placeName: null }))
    expect(screen.getByTestId('create-spot')).toHaveTextContent('Unnamed spot')
    back()
    expect(useStore.getState().create.step).toBe('placing')
    back()
    expect(useStore.getState().create.step).toBe('idle')
  })
  it('details from long-press -> idle', () => {
    render(<CreateLayer />)
    openDetails({ skip: true })
    back()
    expect(useStore.getState().create.step).toBe('idle')
  })
  it('the browser back button (popstate) steps back like Back', () => {
    render(<CreateLayer />)
    act(() => useStore.getState().startCreate())
    act(() => useStore.getState().confirmSpot(spot, { placeId: null, placeName: null }))
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')))
    expect(useStore.getState().create.step).toBe('placing')
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')))
    expect(useStore.getState().create.step).toBe('idle')
  })
})

describe('posting as a claimed place (DECISIONS.md 2026-10-22)', () => {
  const claim = (status: 'pending' | 'active', deviceId = 'me') => ({
    id: 'pid', placeId: 'pid', placeName: 'Test Spot', deviceId, status, plan: 'monthly' as const, priceUsd: 100, paid: true, createdAt: 0,
  })
  const asPlace = () =>
    act(() => {
      useStore.getState().startCreate()
      useStore.getState().confirmSpot(spot, { placeId: 'pid', placeName: 'Test Spot' }, { asPlace: true })
    })

  it('no "Post as" choice without an active claim of your own (pending, or someone else\'s)', () => {
    render(<CreateLayer />)
    openDetails()
    expect(screen.queryByRole('radiogroup', { name: 'Post as' })).toBeNull()
    act(() => useStore.setState({ claims: [claim('pending')] }))
    expect(screen.queryByRole('radiogroup', { name: 'Post as' })).toBeNull()
    act(() => useStore.setState({ claims: [claim('active', 'someone-else')] }))
    expect(screen.queryByRole('radiogroup', { name: 'Post as' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Offer' })).toBeNull()
  })

  it('with an active claim: Post as Neighbour or the place; as the place, Offer or Event only', () => {
    useStore.setState({ claims: [claim('active')] })
    render(<CreateLayer />)
    asPlace()
    expect(screen.getByRole('radio', { name: 'Test Spot' })).toHaveAttribute('aria-checked', 'true')
    expect(tile('Offer')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Issue' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Neighbour' }))
    expect(tile('Issue')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Offer' })).toBeNull()
  })

  it('posts an offer as the place, with its last day', async () => {
    useStore.setState({ claims: [claim('active')] })
    createPin.mockResolvedValue({ id: 'new2', lat: 1, lng: 1 } as never)
    render(<CreateLayer />)
    asPlace()
    fireEvent.click(tile('Offer'))
    expect(screen.getByText(/shown a little below their posts/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '20% off evening batches' } })
    fireEvent.click(post())
    await waitFor(() => expect(createPin).toHaveBeenCalled())
    const arg = createPin.mock.calls[0][0]
    expect(arg).toMatchObject({ type: 'offer', asPlace: true, placeId: 'pid', title: '20% off evening batches' })
    expect(arg.endsAt).toBeGreaterThan(Date.now())
  })
})

describe('adding a photo (DECISIONS.md 2026-10-23)', () => {
  it('picked photo is shrunk, previewed, removable, and posted with the pin', async () => {
    createPin.mockResolvedValue({ id: 'new3', lat: 1, lng: 1 } as never)
    render(<CreateLayer />)
    openDetails()
    fireEvent.click(tile('Issue'))
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeInTheDocument()
    const file = new File(['x'], 'pothole.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('create-photo-input'), { target: { files: [file] } })
    expect(await screen.findByAltText('Your photo')).toHaveAttribute('src', 'data:image/jpeg;base64,QUJD')
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByAltText('Your photo')).toBeNull()
    fireEvent.change(screen.getByTestId('create-photo-input'), { target: { files: [file] } })
    await screen.findByAltText('Your photo')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Pothole outside no. 12' } })
    fireEvent.click(post())
    await waitFor(() => expect(createPin).toHaveBeenCalled())
    expect(createPin.mock.calls[0][0]).toMatchObject({ type: 'civic', photo: 'data:image/jpeg;base64,QUJD' })
  })
})

describe('keyboard and screen readers (docs/A11Y.md P2)', () => {
  it('focus moves into the details sheet; Escape steps back', () => {
    render(<CreateLayer />)
    openDetails({ skip: true })
    expect(document.activeElement).toBe(screen.getByTestId('create-sheet'))
    fireEvent.keyDown(screen.getByTestId('create-sheet'), { key: 'Escape' })
    expect(useStore.getState().create.step).toBe('idle')
  })
  it('the reason Post is disabled is tied to the title field', () => {
    render(<CreateLayer />)
    openDetails()
    fireEvent.click(tile('Ask'))
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('Add a title, 3 letters or more')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Need a ladder' } })
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('aria-describedby')
  })
})
