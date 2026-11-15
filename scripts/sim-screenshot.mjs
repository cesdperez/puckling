import { chromium } from 'playwright'

const path = process.argv[2] || './sim.png'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 466, height: 466 } })
await page.goto('http://localhost:5181/')
await page.waitForTimeout(1000)
await page.screenshot({ path })
await browser.close()
