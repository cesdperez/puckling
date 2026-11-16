import { chromium } from 'playwright'

const path = process.argv[2] || './sim.png'
const page = Number(process.argv[3] || 0)
const browser = await chromium.launch({ headless: true })
const view = await browser.newPage({ viewport: { width: 466, height: 466 } })
await view.goto(process.env.SIM_URL || 'http://127.0.0.1:5181/')
await view.waitForTimeout(1000)
for (let i = 0; i < page; i++) {
  await view.mouse.move(320, 233)
  await view.mouse.down()
  await view.mouse.move(140, 233, { steps: 8 })
  await view.mouse.up()
  await view.waitForTimeout(250)
}
await view.screenshot({ path })
await browser.close()
