// Lead gate screenshots of the full app. Usage: npx tsx scripts/gate-shots.ts <prefix> [w] [h]
import { chromium } from '@playwright/test'

const [prefix = 'g', w = '390', h = '844'] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().replace(/key=[^&\s]+/g, 'key=<redacted>')) })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(5000)
const out = (n: string) => `docs/screens/${prefix}-${n}-${w}.png`
await page.screenshot({ path: out('half') })
await page.locator('.sheet__handle').click(); await page.waitForTimeout(700)
await page.screenshot({ path: out('full') })
await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.waitForTimeout(700)
await page.screenshot({ path: out('peek') })
console.log('errors', errors)
await browser.close()
