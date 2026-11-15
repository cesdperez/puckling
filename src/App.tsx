import { Battery, Clock, Component, readCacheFile, type GeaCanvasElement } from '@geastack/core'
import { createPet, step, pose, SIZE } from './pet/pet'
import { serializeLife, STAGES } from './pet/life'
import { bytesToText, petLife, restore, tick } from './pet/meals'
import { FrameRenderer } from './render'
import { Link } from './link'
import { SIM_FEED_FILE } from './sim'
import { splitFeed, type Tokens } from './stats/tokens'
import { evoName, parseEvo, serializeEvo, updateEvo } from './stats/evo'
import { classify, createPager, stepPager, type Gesture, type Point } from './ui/pager'
import { drawHome, drawScreen, screenKey, type ScreenData } from './screens'

const FRAME_MS = 1000 / 30
const FRAME_TOLERANCE_MS = 4
const BATTERY_EVERY_MS = 10000
function wallTime(): number {
  try { return Clock.epochMs() } catch {
    // The browser sim has no Clock binding.
    return Date.now()
  }
}
export class App extends Component<GeaCanvasElement> {
  private pet = createPet(12345)
  private start: Point | undefined
  private gesture: Gesture = { kind: 'none', x: 0, y: 0, direction: 0 }
  private lastFrame = 0
  private feeding = { life: restore(localStorage.getItem('life') || ''), sincePoll: 0, sinceSave: 0 }
  private evo = parseEvo(localStorage.getItem('evo') || '')
  private pager = createPager()
  private key = ''
  private level = 100
  private charging = false
  private batteryAt: number | undefined
  private tokens: Tokens | undefined
  private lastBody: string | undefined
  private simBody: string | undefined
  private simArrived = 0
  private link = new Link()
  private get body(): string | undefined { return this.link.body ?? this.simBody }
  private feedAge(now: number): number {
    if (this.body === undefined) return -1
    const arrived = this.link.body !== undefined ? this.link.arrived : this.simArrived
    return Math.max(0, Math.floor((now - arrived) / 1000))
  }
  private renderer = new FrameRenderer()

  private pointerDown(x: number, y: number): void { this.start = { x, y } }
  private pointerUp(x: number, y: number): void {
    if (this.start) this.gesture = classify(this.start, { x, y })
    this.start = undefined
  }
  private pointerCancel(): void { this.start = undefined }

  template() {
    return <canvas width={SIZE} height={SIZE} onPointerDown={(event) => this.pointerDown(event.clientX, event.clientY)} onPointerUp={(event) => this.pointerUp(event.clientX, event.clientY)} onPointerCancel={() => this.pointerCancel()} />
  }
  onAfterRender() {
    if (!this.el) return
    const ctx = this.el.getContext('2d')
    const frame = (time: number) => {
      // rAF ticks every 16ms on the device, so an exact 33.3ms gate skips the 32ms tick and halves to 20fps.
      if (time - this.lastFrame >= FRAME_MS - FRAME_TOLERANCE_MS || this.lastFrame === 0) {
        const dt = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000
        this.lastFrame = time
        const now = wallTime()
        this.sample(now)
        const previousPage = this.advance(now, dt)
        this.renderFrame(ctx, now, previousPage)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
  private sample(now: number): void {
    this.link.poll(now)
    this.readSim(now)
    if (this.body !== this.lastBody) {
      this.lastBody = this.body
      if (this.lastBody !== undefined) this.tokens = splitFeed(this.lastBody).tokens
    }
    if (this.batteryAt === undefined || now - this.batteryAt >= BATTERY_EVERY_MS) {
      this.batteryAt = now
      // These bindings are missing or partial in the browser sim.
      try { this.level = Battery.level() } catch {}
      try { this.charging = Battery.charging() } catch { this.charging = false }
    }
  }
  private readSim(now: number): void {
    if (this.link.body !== undefined || localStorage.getItem('food')) return
    const body = bytesToText(readCacheFile('/sim/' + SIM_FEED_FILE)) || undefined
    if (body !== this.simBody) { this.simBody = body; this.simArrived = now }
  }
  private readFood(): string {
    return this.body !== undefined ? splitFeed(this.body).food : localStorage.getItem('food') || ''
  }
  private advance(now: number, dt: number): number {
    const result = tick(this.feeding, dt, () => this.readFood())
    this.feeding = result.feeding
    if (result.save) localStorage.setItem('life', serializeLife(this.feeding.life))
    const nextEvo = updateEvo(this.evo, STAGES.indexOf(this.feeding.life.stage), this.tokens, Math.random)
    if (nextEvo !== this.evo) {
      this.evo = nextEvo
      localStorage.setItem('evo', serializeEvo(nextEvo))
      console.log('puckling: evo ' + evoName(nextEvo))
    }
    const previousPage = this.pager.page
    const tap = previousPage === 0 && this.gesture.kind === 'tap' ? { x: this.gesture.x, y: this.gesture.y } : undefined
    this.pager = stepPager(this.pager, this.gesture, dt)
    this.gesture = { kind: 'none', x: 0, y: 0, direction: 0 }
    this.pet = step(this.pet, { tap, life: petLife(this.feeding.life, now), meal: result.meal, evolved: result.evolved }, dt)
    return previousPage
  }
  private renderFrame(ctx: ReturnType<GeaCanvasElement['getContext']>, now: number, previousPage: number): void {
    if (!this.evo) return
    const data: ScreenData = { life: this.feeding.life, evo: this.evo, tokens: this.tokens, level: this.level, charging: this.charging, feedAge: this.feedAge(now) }
    if (this.pager.page === 0) {
      if (previousPage !== 0) this.renderer.reset()
      const p = pose(this.pet)
      this.renderer.clear(ctx, p)
      drawHome(ctx, data, p.brightness)
      this.renderer.paint(ctx, p)
      this.key = ''
    } else {
      const nextKey = screenKey(this.pager.page, data)
      if (nextKey !== this.key) { drawScreen(ctx, this.pager.page, data); this.key = nextKey }
    }
  }
}
