// Gate E: creates ONE pin of each type against the Firestore EMULATOR and checks each doc has postedAs "neighbour".
// Needs: `npm run emulators`, and `VITE_DATA_SOURCE=emulator npm run dev -- --port 5174 --strictPort`
// (seeded with `npx tsx scripts/seed.ts --target=emulator`). Run: npx playwright test tests/e2e/create.spec.ts
// Google calls: one searchNearby per pin (placing idle for the first, one on long-press entry for the others).
import { expect, test, type Page } from '@playwright/test'

test.use({ baseURL: 'http://localhost:5174' })
test.describe.configure({ mode: 'serial' })

const REST = 'http://127.0.0.1:8080/v1/projects/demo-ptp/databases/(default)/documents/pins?pageSize=300'
const stamp = Date.now().toString().slice(-6)
let nearbyCalls = 0

async function emulatorPins(): Promise<Record<string, { fields: Record<string, { stringValue?: string }> }>> {
  const r = await fetch(REST, { headers: { Authorization: 'Bearer owner' } })
  const j = (await r.json()) as { documents?: { name: string; fields: Record<string, { stringValue?: string }> }[] }
  return Object.fromEntries((j.documents ?? []).map((d) => [d.fields.title?.stringValue ?? '', d]))
}

async function longPress(page: Page, x: number, y: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(800)
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  page.on('request', (r) => {
    if (r.url().includes('places.googleapis.com') && r.url().includes('SearchNearby')) nearbyCalls++
  })
  await page.goto('/')
  await page.waitForSelector('[data-testid="pin-button"]', { timeout: 20_000 })
  await page.waitForSelector('.map-anchor', { state: 'attached', timeout: 20_000 }) // marker overlay (and its long-press handler) is ready
  await page.waitForTimeout(3500)
})

test.afterAll(() => console.log(`searchNearby requests made by this e2e: ${nearbyCalls}`))

test('Issue via + Pin placing mode', async ({ page }) => {
  const title = `Hawkers back on the footpath e2e ${stamp}`
  await page.getByTestId('pin-button').click()
  await expect(page.getByText('Move the map to the spot')).toBeVisible()
  await page.waitForTimeout(3000) // idle + 600 ms debounce + one lookup
  await page.getByRole('button', { name: 'Use this spot' }).click()
  const sheet = page.getByTestId('create-sheet')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('radio', { name: 'Issue' }).click()
  await sheet.getByLabel('Title').fill(title)
  await sheet.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText('Pinned. It is at the top of Pulse.')).toBeVisible()
  await expect(sheet).toHaveCount(0)
  await expect.poll(async () => (await emulatorPins())[title]?.fields.postedAs?.stringValue, { timeout: 10_000 }).toBe('neighbour')
  expect((await emulatorPins())[title].fields.type.stringValue).toBe('civic')
})

test('Event via long-press', async ({ page }) => {
  const title = `Watercolour class e2e ${stamp}`
  await longPress(page, 250, 220)
  const sheet = page.getByTestId('create-sheet')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('radio', { name: 'Event' }).click()
  await sheet.getByLabel('Title').fill(title)
  await sheet.getByRole('radio', { name: 'Tomorrow' }).click()
  await sheet.getByLabel('Time').fill('17:00')
  await sheet.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText('Pinned. It is at the top of Pulse.')).toBeVisible()
  await expect.poll(async () => (await emulatorPins())[title]?.fields.postedAs?.stringValue, { timeout: 10_000 }).toBe('neighbour')
  const d = (await emulatorPins())[title] as unknown as { fields: Record<string, { integerValue?: string; stringValue?: string }> }
  expect(d.fields.type.stringValue).toBe('event')
  expect(Number(d.fields.startsAt.integerValue)).toBeGreaterThan(Date.now())
})

test('Ask via long-press', async ({ page }) => {
  const title = `Need someone to water plants e2e ${stamp}`
  await longPress(page, 262, 238)
  const sheet = page.getByTestId('create-sheet')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('radio', { name: 'Ask' }).click()
  await sheet.getByLabel('Title').fill(title)
  await sheet.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText('Pinned. It is at the top of Pulse.')).toBeVisible()
  await expect.poll(async () => (await emulatorPins())[title]?.fields.postedAs?.stringValue, { timeout: 10_000 }).toBe('neighbour')
  expect((await emulatorPins())[title].fields.type.stringValue).toBe('ask')
})
