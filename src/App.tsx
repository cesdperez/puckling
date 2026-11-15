import { Clock, Component, readCacheFile, type GeaCanvasElement } from '@geastack/core'
import { createPet, step, pose, SIZE } from './pet/pet'
import { serializeLife } from './pet/life'
import { bytesToText, petLife, restore, tick } from './pet/meals'
import { FrameRenderer } from './render'

const FRAME_MS = 1000 / 30
const FRAME_TOLERANCE_MS = 4

function wallTime(): number {
  try {
    return Clock.epochMs()
  } catch {
    return Date.now() // The browser sim has no Clock binding.
  }
}

export class App extends Component<GeaCanvasElement> {
  private pet = createPet(12345)
  private tap: { x: number; y: number } | undefined
  private lastFrame = 0

  template() {
    return <canvas width={SIZE} height={SIZE} onPointerDown={(event) => { this.tap = { x: event.clientX, y: event.clientY } }} />
  }

  onAfterRender() {
    if (!this.el) return
    let feeding = { life: restore(localStorage.getItem('life') || ''), sincePoll: 0, sinceSave: 0 }
    const life = feeding.life
    console.log('puckling: life ' + life.stage + ' ' + life.branch + ' lifetime=' + life.lifetime + ' fullness=' + life.fullness)
    const ctx = this.el.getContext('2d')
    const renderer = new FrameRenderer()
    const frame = (time: number) => {
      // rAF ticks every 16ms on the device, so an exact 33.3ms gate skips the 32ms tick and halves to 20fps
      if (time - this.lastFrame >= FRAME_MS - FRAME_TOLERANCE_MS || this.lastFrame === 0) {
        const dt = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000
        this.lastFrame = time
        const result = tick(feeding, dt, () => localStorage.getItem('food') || bytesToText(readCacheFile('/sim/food.txt')))
        feeding = result.feeding
        if (result.ate > 0 || result.evolved) console.log('puckling: ate ' + result.ate + ' kcal, ' + feeding.life.stage + ' ' + feeding.life.branch + ' lifetime=' + feeding.life.lifetime)
        if (result.save) localStorage.setItem('life', serializeLife(feeding.life))
        this.pet = step(this.pet, { tap: this.tap, life: petLife(feeding.life, wallTime()), meal: result.meal, evolved: result.evolved }, dt)
        this.tap = undefined
        const p = pose(this.pet)
        renderer.draw(ctx, p)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
}
