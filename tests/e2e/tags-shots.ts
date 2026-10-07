// Agent F gate script (not a spec; run with tsx). One map load. Keyboard-zooms, screenshots z14 / z17, pan test.
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const zs: number[] = []
page.on('request', (r) => { const m = r.url().match(/[?&]z=(\d+)/) ?? r.url().match(/!1i(\d+)!2i/); if (m) zs.push(Number(m[1])) })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(4500)
const tags = () => page.$$eval('.map-tag', (els) => els.map((e) => e.getAttribute('aria-label') + '@' + (e.parentElement as HTMLElement).dataset.lat))
const key = async (k: string) => { await page.keyboard.press(k); await page.waitForTimeout(2500); console.log('key', k, 'tile zooms', [...new Set(zs.splice(0))], await tags()) }
await page.mouse.click(340, 190) // focus map on empty ground
await page.waitForTimeout(500)
await key('Minus')
await page.screenshot({ path: 'docs/screens/tags-z14.png' })
const a = await tags()
await page.mouse.move(195, 450)
await page.mouse.down(); await page.mouse.move(195, 470, { steps: 8 }); await page.mouse.up()
await page.waitForTimeout(2500)
const b = await tags()
console.log('PAN20 before', JSON.stringify(a)); console.log('PAN20 after ', JSON.stringify(b))
console.log('same set', JSON.stringify(a.map(x=>x.split('@')[0]).sort()) === JSON.stringify(b.map(x=>x.split('@')[0]).sort()))
await page.mouse.click(340, 190); await page.waitForTimeout(500); await key('Equal'); await key('Equal'); await key('Equal')
await page.screenshot({ path: 'docs/screens/tags-z17.png' })
await browser.close()
