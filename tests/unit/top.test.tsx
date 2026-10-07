import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../src/store'
import type { Pin } from '../../src/types'
import { SearchSession } from '../../src/top/autocomplete'
import { AccountSheet } from '../../src/top/Sheets'
import { filterOurPins } from '../../src/top'

const pin = (o: Partial<Pin>): Pin => ({
  id: 'p1', type: 'civic', title: 'Pothole near the gate', lat: 1, lng: 1, createdAt: 1, createdBy: 'dev-1',
  postedAs: 'neighbour', status: 'active', ...o,
})

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  useStore.setState({ pins: [pin({}), pin({ id: 'p2', createdBy: 'other', title: 'Quiz night', type: 'event', placeName: 'The Cafe' })], deviceId: 'dev-1' })
})

describe('AccountSheet name privacy', () => {
  it('keeps the name inside the sheet, out of the store and the rest of the page', () => {
    const NAME = 'Zorblax Quillfeather'
    render(
      <main>
        <article data-testid="card">Neighbour · Pothole near the gate</article>
        <AccountSheet onClose={() => {}} />
      </main>,
    )
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: NAME } })
    expect(screen.getByLabelText<HTMLInputElement>('Your name').value).toBe(NAME)
    expect(localStorage.getItem('ptp.displayName')).toBe(NAME)
    // outside the sheet
    expect(screen.getByTestId('card').textContent).not.toContain(NAME)
    const dialog = screen.getByRole('dialog')
    const outside = Array.from(document.body.children).filter((el) => !el.contains(dialog))
    outside.forEach((el) => expect(el.textContent).not.toContain(NAME))
    expect(document.body.textContent).not.toContain(NAME)
    // not in the store
    expect(JSON.stringify(useStore.getState())).not.toContain(NAME)
  })

  it('lists only my pins and opens one', () => {
    const onClose = vi.fn()
    render(<AccountSheet onClose={onClose} />)
    expect(screen.queryByText(/Quiz night/)).toBeNull()
    act(() => { fireEvent.click(screen.getByText('Pothole near the gate')) })
    expect(useStore.getState().detailPinId).toBe('p1')
    expect(useStore.getState().selectedPinId).toBe('p1')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('search', () => {
  it('filters our pins by title and placeName, 3+ chars, case-insensitive', () => {
    const pins = useStore.getState().pins
    expect(filterOurPins(pins, 'po')).toEqual([])
    expect(filterOurPins(pins, 'POTH').map((p) => p.id)).toEqual(['p1'])
    expect(filterOurPins(pins, 'cafe').map((p) => p.id)).toEqual(['p2'])
    expect(filterOurPins([pin({ type: 'area' })], 'poth')).toEqual([])
  })

  it('uses one session token for all requests, none under 3 chars, drops it on selection', async () => {
    const tokens: object[] = []
    class Token {}
    const fetchFields = vi.fn().mockResolvedValue(undefined)
    const toPlace = vi.fn(() => ({ fetchFields, location: { lat: () => 1, lng: () => 2 }, displayName: 'X' }))
    const fetchAuto = vi.fn(async (req: { sessionToken: object }) => {
      tokens.push(req.sessionToken)
      return { suggestions: [{ placePrediction: { placeId: 'abc', text: { text: 'T' }, mainText: { text: 'M' }, secondaryText: { text: 'S' }, toPlace } }] }
    })
    const lib = { AutocompleteSessionToken: Token, AutocompleteSuggestion: { fetchAutocompleteSuggestions: fetchAuto } }
    const s = new SearchSession(lib as never)
    expect(await s.suggest('ba')).toEqual([])
    expect(fetchAuto).not.toHaveBeenCalled()
    await s.suggest('bag')
    const r = await s.suggest('bagel')
    expect(tokens[0]).toBe(tokens[1])
    const picked = await s.select(r[0])
    expect(picked).toEqual({ placeId: 'abc', placeName: 'X', location: { lat: 1, lng: 2 } })
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['displayName', 'location'] })
    expect(s.hasToken).toBe(false)
    await s.suggest('bagel')
    expect(tokens[2]).not.toBe(tokens[0])
    s.reset()
    expect(s.hasToken).toBe(false)
  })
})
