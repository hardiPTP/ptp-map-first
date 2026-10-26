// Merged pins ("+1") and posting with a photo. One map load per run (Demo Key cap). Needs `npm run dev`.
// Usage: npx tsx scripts/merge-photo-shots.ts <path-to-a-test.jpg> [390x844]
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const photo = process.argv[2]
const [w, h] = (process.argv[3] ?? '390x844').split('x').map(Number)
const dir = 'docs/screens/merge-photo'
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('console', (m) => m.type() === 'error' && !m.text().includes('429') && errors.push(m.text()))
const wait = (ms: number) => page.waitForTimeout(ms)
const shot = (n: string) => page.screenshot({ path: `${dir}/${n}-${w}x${h}.png` })

await page.goto('http://localhost:5173/')
await page.waitForSelector('.sheet-card', { timeout: 20_000 })
await wait(3500)
await page.locator('.sheet__handle').click()
await wait(500)
await page.getByRole('button', { name: 'Map', exact: true }).click()
await wait(1500)
console.log('merged markers:', await page.locator('.map-mk[aria-label*="similar"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))
console.log('tags:', await page.locator('.map-tag, .map-text').allTextContents())
await shot('merged')

// Open the merged pin: the detail says how many more posted it.
await page.locator('.map-mk[aria-label*="similar"]').first().click()
await wait(1800)
await shot('merged-detail')
await page.getByRole('button', { name: 'Close' }).first().click()
await wait(1000)

// Post an issue with a photo.
await page.getByTestId('pin-button').click()
await wait(800)
await page.getByRole('button', { name: 'Use this spot' }).click()
await wait(800)
await page.getByRole('radio', { name: 'Issue' }).click()
await page.getByLabel('Title').fill('Broken bench in the garden')
await page.getByTestId('create-photo-input').setInputFiles(photo)
await page.getByAltText('Your photo').waitFor({ timeout: 10_000 })
const size = await page.getByAltText('Your photo').evaluate((img) => [(img as HTMLImageElement).naturalWidth, (img as HTMLImageElement).naturalHeight, (img as HTMLImageElement).src.length])
console.log('shrunk photo (w, h, data URL chars):', size)
await page.getByTestId('create-sheet').evaluate((el) => el.scrollTo(0, el.scrollHeight))
await shot('create-with-photo')
await page.getByTestId('create-sheet').locator('.ptp-btn--primary').click()
await wait(2000)
await page.locator('.sheet-card__open', { hasText: 'Broken bench in the garden' }).first().click()
await wait(2000)
await shot('detail-with-photo')
console.log('console errors (429s from the Places quota left out):', errors.length ? errors : 'none')
await browser.close()
