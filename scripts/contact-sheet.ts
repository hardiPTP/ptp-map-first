// Usage: npx tsx scripts/contact-sheet.ts <out.png> <img1> <img2> ... (renders images side by side with captions)
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [out, ...imgs] = process.argv.slice(2)
const cells = imgs.map((p) => `<figure><img src="data:image/png;base64,${readFileSync(p).toString('base64')}"><figcaption>${p.split('/').pop()}</figcaption></figure>`).join('')
const html = `<html><body style="margin:0;background:#E9E4DB;font:14px sans-serif;display:flex;gap:16px;padding:16px">${cells}</body>
<style>figure{margin:0;width:390px}img{width:390px;display:block;border-radius:12px}figcaption{padding:6px 0}</style></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: imgs.length * 406 + 16, height: 900 } })
await p.setContent(html); await p.waitForTimeout(300)
await p.screenshot({ path: out, fullPage: true }); await b.close()
