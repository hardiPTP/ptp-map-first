// Screenshots of every create step at 390x844 against the mock dev server (5173). One placing lookup only.
// Run: npx tsx tests/e2e/create-shots.ts
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
let nearby = 0
page.on('request', (r) => { if (r.url().includes('places.googleapis.com') && r.url().includes('SearchNearby')) nearby++ })
await page.goto('http://localhost:5173')
await page.waitForTimeout(3500)
await page.screenshot({ path: 'docs/screens/create-1-button.png' })
await page.getByTestId('pin-button').click()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'docs/screens/create-2-placing.png' })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'docs/screens/create-3-placename.png' })
await page.getByRole('button', { name: 'Use this spot' }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'docs/screens/create-4-tiles.png' })
await page.getByTestId('create-sheet').getByRole('radio', { name: 'Event' }).click()
await page.getByLabel('Title').fill('Watercolour class for beginners, Sat 5pm')
await page.getByRole('radio', { name: 'Tomorrow' }).click()
await page.getByLabel('Time').fill('23:30')
await page.waitForTimeout(300)
await page.screenshot({ path: 'docs/screens/create-5-event-details.png' })
await page.getByTestId('create-sheet').getByRole('button', { name: 'Post', exact: true }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: 'docs/screens/create-6-posted.png' })
await browser.close()
console.log('searchNearby requests seen:', nearby, errors.length ? errors : 'no page errors')
