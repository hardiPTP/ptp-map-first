// Claiming a place, and "@ Place" opening everything posted there (DECISIONS.md 2026-10-22).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/data', () => ({ repo: { claimPlace: vi.fn(), toggleSupport: vi.fn() } }))

import { repo } from '../../src/data'
import { ClaimRow } from '../../src/sheet/Claim'
import { PinCard } from '../../src/sheet/PinCard'
import { useStore } from '../../src/store'
import type { Claim, NearbyPlace, Pin } from '../../src/types'

const claimPlace = vi.mocked(repo.claimPlace)
const place: NearbyPlace = { id: 'gp-1', name: 'Bright Minds Tuition', lat: 19.06, lng: 72.83, kind: 'Tutoring service', openNow: true }
const claim = (status: Claim['status'], deviceId = 'me'): Claim => ({
  id: place.id, placeId: place.id, placeName: place.name, deviceId, status, plan: 'monthly', priceUsd: 100, paid: true, createdAt: 0,
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useStore.setState({ claims: [], deviceId: 'me', searchPlace: null, detailPinId: null, selectedPinId: null, sheetHeight: 'peek', flyTo: null })
  useStore.getState().cancelCreate()
})

describe('claim row under a picked place', () => {
  it('not claimed: "Own this place? Claim it" opens the claim sheet with the price and the ranking rule', () => {
    render(<ClaimRow place={place} />)
    fireEvent.click(screen.getByRole('button', { name: 'Own this place? Claim it' }))
    const sheet = screen.getByRole('dialog', { name: `Claim ${place.name}` })
    expect(sheet).toHaveTextContent('$100 a month')
    expect(sheet).toHaveTextContent(/sit a little below neighbours/)
    expect(sheet).toHaveTextContent(/team checks every claim/)
    expect(sheet).toHaveTextContent(/nothing is charged/)
  })

  it('paying sends a claim for this place and says the team checks it', async () => {
    // As the real repo does: the new claim reaches the store (the row behind the sheet changes) before it resolves.
    claimPlace.mockImplementation(async () => {
      useStore.setState({ claims: [claim('pending')] })
      return claim('pending')
    })
    render(<ClaimRow place={place} />)
    fireEvent.click(screen.getByRole('button', { name: 'Own this place? Claim it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pay $100/month and claim' }))
    await waitFor(() => expect(claimPlace).toHaveBeenCalledWith({ placeId: place.id, placeName: place.name }))
    expect(await screen.findByRole('status')).toHaveTextContent(`You can post as ${place.name} once the team has checked it`)
    expect(screen.getByText('Your claim is being checked by the team.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('already claimed shows it, and a failed claim says why', async () => {
    claimPlace.mockRejectedValue(new Error('this place is already claimed'))
    render(<ClaimRow place={place} />)
    fireEvent.click(screen.getByRole('button', { name: 'Own this place? Claim it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pay $100/month and claim' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already claimed')
    cleanup()
    act(() => useStore.setState({ claims: [claim('active', 'someone-else')] }))
    render(<ClaimRow place={place} />)
    expect(screen.getByText(/Claimed by the place/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Claim it/ })).toBeNull()
  })

  it('your pending claim: a note; your active claim: "Post as <place>" opens create as the place', () => {
    useStore.setState({ claims: [claim('pending')] })
    const { rerender } = render(<ClaimRow place={place} />)
    expect(screen.getByText('Your claim is being checked by the team.')).toBeInTheDocument()
    act(() => useStore.setState({ claims: [claim('active')] }))
    rerender(<ClaimRow place={place} />)
    fireEvent.click(screen.getByRole('button', { name: `Post as ${place.name}` }))
    expect(useStore.getState().create).toMatchObject({ step: 'details', placeId: place.id, asPlace: true })
  })
})

describe('"@ Place" on a card', () => {
  it('opens everything posted at that place in the sheet', () => {
    const pin: Pin = {
      id: 'p1', type: 'ask', title: 'Need a ladder', lat: 19.06, lng: 72.83, placeId: 'gp-9', placeName: 'Hill Road',
      createdAt: 0, createdBy: 'x', postedAs: 'neighbour', status: 'active',
    }
    render(<PinCard pin={pin} origin={{ lat: 19.06, lng: 72.83 }} now={1} count={0} supported={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Everything at Hill Road' }))
    const s = useStore.getState()
    expect(s.searchPlace).toEqual({ placeId: 'gp-9', placeName: 'Hill Road' })
    expect(s.sheetHeight).toBe('half')
    expect(s.detailPinId).toBeNull()
  })
})

describe('an offer card', () => {
  it('shows the Offer mark with its last day, the place with its verified mark, and "I\'m interested"', () => {
    const now = new Date(2030, 5, 12, 10, 0).getTime() // a Wednesday
    const offer: Pin = {
      id: 'o1', type: 'offer', title: '20% off evening batches', lat: 19.06, lng: 72.83, placeId: place.id, placeName: place.name,
      endsAt: new Date(2030, 5, 14, 23, 59).getTime(), createdAt: now - 60_000, createdBy: 'x', postedAs: 'place', status: 'active',
    }
    const { container } = render(<PinCard pin={offer} origin={{ lat: 19.06, lng: 72.83 }} now={now} count={0} supported={false} />)
    expect(screen.getByText(/Offer · until/)).toBeInTheDocument()
    expect(container.querySelector('.sheet-card__source')).toHaveTextContent('Posted by the place')
    expect(screen.getByRole('button', { name: "I'm interested" })).toBeInTheDocument()
  })
})
