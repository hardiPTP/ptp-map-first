import { describe, expect, it } from 'vitest'
import { createMockRepo } from '../../src/data/mockRepo'
import type { SeedFile } from '../../src/data/seedTypes'
import seedJson from '../../src/data/seed.generated.json'
import { fitSize, validPhoto } from '../../src/lib/photo'
import { PHOTO_MAX_CHARS, PHOTO_PREFIX } from '../../src/types'

const NOW = Date.parse('2026-10-23T09:00:00Z')
const small = `${PHOTO_PREFIX}${'A'.repeat(1000)}`

describe('photo checks', () => {
  it('only small JPEG data URLs are accepted', () => {
    expect(validPhoto(small)).toBe(true)
    expect(validPhoto('data:image/png;base64,AAAA')).toBe(false)
    expect(validPhoto('https://example.com/x.jpg')).toBe(false)
    expect(validPhoto(`${PHOTO_PREFIX}${'A'.repeat(PHOTO_MAX_CHARS)}`)).toBe(false)
  })
  it('fits the longest side, never upscales', () => {
    expect(fitSize(4000, 3000, 800)).toEqual({ w: 800, h: 600 })
    expect(fitSize(1080, 1920, 800)).toEqual({ w: 450, h: 800 })
    expect(fitSize(300, 200, 800)).toEqual({ w: 300, h: 200 })
  })
})

describe('mock repo photos', () => {
  const input = { type: 'civic' as const, title: 'Broken bench in the garden', lat: 19.06, lng: 72.83 }
  it('a pin posted with a photo is marked hasPhoto and its photo can be read back by anyone', async () => {
    const repo = createMockRepo(seedJson as SeedFile, () => NOW)
    await repo.init()
    const pin = await repo.createPin({ ...input, photo: small })
    expect(pin.hasPhoto).toBe(true)
    expect(await repo.getPhoto(pin.id)).toBe(small)
  })
  it('no photo, no flag; a photo that is not a small JPEG is refused', async () => {
    const repo = createMockRepo(seedJson as SeedFile, () => NOW)
    await repo.init()
    const plain = await repo.createPin(input)
    expect(plain.hasPhoto).toBeUndefined()
    expect(await repo.getPhoto(plain.id)).toBeNull()
    await expect(repo.createPin({ ...input, photo: 'data:image/png;base64,AAAA' })).rejects.toThrow(/JPEG/)
  })
})
