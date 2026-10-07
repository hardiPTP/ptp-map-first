// Agent B gate screenshots. Usage: npx tsx tests/e2e/sheet-shots.ts
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(5000)
const info = async (label: string) =>
  console.log(label, await page.evaluate(() => ({
    h: document.querySelector('.sheet')?.getAttribute('data-height'),
    px: (document.querySelector('.sheet') as HTMLElement).offsetHeight,
    offset: document.documentElement.style.getPropertyValue('--sheet-offset'),
    cards: document.querySelectorAll('.sheet-card').length,
    header: document.querySelector('.sheet-header__title')?.textContent,
    sub: document.querySelector('.sheet-header__sub')?.textContent,
  })))
const handle = page.locator('.sheet__handle')
await info('half')
await page.screenshot({ path: 'docs/screens/sheet-half.png' })
const card = page.locator('.sheet-card').first()
await card.scrollIntoViewIfNeeded()
await card.screenshot({ path: 'docs/screens/sheet-card.png' })
const strip = page.locator('.sheet-area')
if (await strip.count()) {
  await page.locator('.sheet__scroll').evaluate((e) => (e.scrollTop = 0))
  await strip.screenshot({ path: 'docs/screens/sheet-areastrip.png' })
}
await handle.click(); await page.waitForTimeout(600); await info('full after tap')
await page.screenshot({ path: 'docs/screens/sheet-full.png' })
await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.waitForTimeout(600); await info('peek via pill')
await page.screenshot({ path: 'docs/screens/sheet-peek.png' })
await page.getByRole('button', { name: 'List', exact: true }).click(); await page.waitForTimeout(600); await info('full via pill')
// drag from full down to roughly half
const box = (await handle.boundingBox())!
await page.mouse.move(box.x + 195, box.y + 20); await page.mouse.down()
await page.mouse.move(box.x + 195, box.y + 200, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(600)
await info('after drag down 200')
console.log('errors', errors)
await browser.close()
