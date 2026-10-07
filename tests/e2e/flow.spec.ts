// Gate 2 full flow (lead) on the Firestore + Auth EMULATORS via `npm run e2e:emulator`.
// No Google calls beyond the Maps JS map load: no search, no placing.
import { expect, test } from '@playwright/test'

test.use({ baseURL: 'http://localhost:5174', viewport: { width: 390, height: 844 } })
test.describe.configure({ mode: 'serial' })

const DOCS = 'http://127.0.0.1:8080/v1/projects/demo-ptp/databases/(default)/documents'
/** All support doc ids, following REST pagination (nextPageToken). */
async function supportIds(): Promise<string[]> {
  const ids: string[] = []
  let token = ''
  do {
    const r = await fetch(`${DOCS}/supports?pageSize=300${token ? `&pageToken=${token}` : ''}`, {
      headers: { Authorization: 'Bearer owner' },
    })
    const j = (await r.json()) as { documents?: { name: string }[]; nextPageToken?: string }
    ids.push(...(j.documents ?? []).map((d) => d.name.split('/').pop() as string))
    token = j.nextPageToken ?? ''
  } while (token)
  return ids
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.sheet-card', { timeout: 20_000 })
})

test('home: seeded feed from Firestore, sheet opens at half, three heights', async ({ page }) => {
  await expect(page.locator('.sheet')).toHaveAttribute('data-height', 'half')
  await expect(page.locator('.sheet-header__title')).toContainText('within a 10 min walk')
  await page.locator('.sheet__handle').click()
  await expect(page.locator('.sheet')).toHaveAttribute('data-height', 'full')
  await page.getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.locator('.sheet')).toHaveAttribute('data-height', 'peek')
})

test('support toggle: one per device, persisted as pinId_uid, second tap removes', async ({ page }) => {
  const before = await supportIds()
  const card = page.locator('.sheet-card').first()
  const action = card.locator('.ptp-btn--soft')
  await action.click()
  await expect.poll(async () => (await supportIds()).length, { timeout: 10_000 }).toBe(before.length + 1)
  const added = (await supportIds()).filter((id) => !before.includes(id))
  expect(added).toHaveLength(1)
  expect(added[0]).toMatch(/^[^_]+_.+$/)
  await action.click()
  await expect.poll(async () => (await supportIds()).length, { timeout: 10_000 }).toBe(before.length)
})

test('card opens the story detail; next moves; close returns', async ({ page }) => {
  const firstTitle = (await page.locator('.sheet-card').first().locator('.sheet-card__title').textContent())?.trim()
  await page.locator('.sheet-card').first().click({ position: { x: 200, y: 50 } })
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(firstTitle ?? '')
  await page.keyboard.press('ArrowRight')
  await expect(dialog).not.toContainText(firstTitle ?? '___')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('chips filter the feed by type', async ({ page }) => {
  await page.getByRole('radio', { name: 'Events' }).click()
  const meta = page.locator('.sheet-card .sheet-card__type')
  await expect(meta.first()).toContainText('Event')
  for (const t of await meta.allTextContents()) expect(t).toContain('Event')
  await page.getByRole('radio', { name: 'Issues' }).click()
  for (const t of await meta.allTextContents()) expect(t).toContain('Issue')
})

test('area strip: PTP rows, tap reveals Share on WhatsApp', async ({ page }) => {
  const strip = page.locator('.sheet-area')
  await expect(strip).toBeVisible()
  await expect(strip).toContainText('In your area')
  await strip.locator('button').first().click()
  await expect(strip.getByText(/Share on WhatsApp/i)).toBeVisible()
})

test('privacy: a name typed in the account sheet appears nowhere else', async ({ page }) => {
  const NAME = 'Zarina Kotwal-Test'
  await page.getByRole('button', { name: 'Your account' }).click()
  await page.getByLabel(/your name/i).fill(NAME)
  await page.keyboard.press('Escape')
  await page.goto('/')
  await page.waitForSelector('.sheet-card')
  await expect(page.locator('body')).not.toContainText(NAME)
  await page.locator('.sheet-card').first().click({ position: { x: 200, y: 50 } })
  await expect(page.getByRole('dialog')).not.toContainText(NAME)
})
