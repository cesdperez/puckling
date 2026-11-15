import { Battery, Clock, Component, WiFi, readCacheFile, type GeaCanvasElement } from '@geastack/core'
import { createPet, step, pose, SIZE } from './pet/pet'
import { serializeLife, STAGES } from './pet/life'
import { bytesToText, petLife, restore, tick } from './pet/meals'
import { FrameRenderer } from './render'
import { FeedClient } from './feed'
import { splitFeed, type Tokens } from './stats/tokens'
import { evoName, parseEvo, serializeEvo, updateEvo } from './stats/evo'
import { classify, createPager, stepPager, type Gesture, type Point } from './ui/pager'
import { drawHome, drawScreen, screenKey, type ScreenData } from './screens'

const FRAME_MS = 1000 / 30
const FRAME_TOLERANCE_MS = 4
function wallTime(): number {
  try { return Clock.epochMs() } catch { return Date.now() }
}
function wifiStatus(): string {
  try { return WiFi.connected() ? 'wifi ' + WiFi.rssi() + 'dBm' : 'wifi down' } catch { return 'wifi n/a' }
}
export class App extends Component<GeaCanvasElement> {
  private pet = createPet(12345)
  private start: Point | undefined
  private gesture: Gesture = { kind: 'none', x: 0, y: 0, direction: 0 }
  private lastFrame = 0

  template() {
    return <canvas width={SIZE} height={SIZE} onPointerDown={(event) => { this.start = { x: event.clientX, y: event.clientY } }} onPointerUp={(event) => { if (this.start) this.gesture = classify(this.start, { x: event.clientX, y: event.clientY }); this.start = undefined }} onPointerCancel={() => { this.start = undefined }} />
  }
  onAfterRender() {
    if (!this.el) return
    let feeding = { life: restore(localStorage.getItem('life') || ''), sincePoll: 0, sinceSave: 0 }
    let evo = parseEvo(localStorage.getItem('evo') || '')
    let pager = createPager(), key = '', level = 100, charging = false, batteryAt = -10000
    let tokens: Tokens | undefined
    let lastBody: string | undefined
    const feed = new FeedClient(), ctx = this.el.getContext('2d'), renderer = new FrameRenderer()
    const frame = (time: number) => {
      if (time - this.lastFrame >= FRAME_MS - FRAME_TOLERANCE_MS || this.lastFrame === 0) {
        const dt = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000
        this.lastFrame = time
        const now = wallTime()
        feed.poll(now)
        if (feed.body !== lastBody) { lastBody = feed.body; if (lastBody !== undefined) tokens = splitFeed(lastBody).tokens }
        if (now - batteryAt >= 10000) {
          batteryAt = now
          try { level = Battery.level() } catch {}
          try { charging = Battery.charging() } catch { charging = false }
        }
        const result = tick(feeding, dt, () => feed.body !== undefined ? splitFeed(feed.body).food : localStorage.getItem('food') || bytesToText(readCacheFile('/sim/food.txt')))
        feeding = result.feeding
        if (result.save) localStorage.setItem('life', serializeLife(feeding.life))
        const nextEvo = updateEvo(evo, STAGES.indexOf(feeding.life.stage), tokens, Math.random)
        if (nextEvo !== evo) { evo = nextEvo; localStorage.setItem('evo', serializeEvo(evo)); console.log('puckling: evo ' + evoName(evo)) }
        const previousPage = pager.page
        const tap = previousPage === 0 && this.gesture.kind === 'tap' ? { x: this.gesture.x, y: this.gesture.y } : undefined
        pager = stepPager(pager, this.gesture, dt)
        this.gesture = { kind: 'none', x: 0, y: 0, direction: 0 }
        this.pet = step(this.pet, { tap, life: petLife(feeding.life, now), meal: result.meal, evolved: result.evolved }, dt)
        const data: ScreenData = { life: feeding.life, evo: nextEvo, tokens, level, charging, wifi: pager.page === 3 ? wifiStatus() : '', feedAge: feed.body === undefined ? -1 : Math.max(0, Math.floor((now - feed.arrived) / 1000)), url: feed.url }
        if (pager.page === 0) {
          if (previousPage !== 0) renderer.reset()
          const p = pose(this.pet)
          renderer.draw(ctx, p)
          drawHome(ctx, data, p.brightness)
          key = ''
        } else {
          const nextKey = screenKey(pager.page, data)
          if (nextKey !== key) { drawScreen(ctx, pager.page, data); key = nextKey }
        }
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
}
