import { Clock, Component, readCacheFile, type GeaCanvasElement } from '@geastack/core'
import { createPet, step, pose, SIZE } from './pet/pet'
import { age, serializeLife } from './pet/life'
import { bytesToText, digest, petLife, restore } from './pet/meals'
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
    let life = restore(localStorage.getItem('life') || '')
    let sincePoll = 0
    let sinceSave = 0
    console.log('puckling: life ' + life.stage + ' ' + life.branch + ' lifetime=' + life.lifetime + ' fullness=' + life.fullness)
    const ctx = this.el.getContext('2d')
    const renderer = new FrameRenderer()
    const frame = (time: number) => {
      // rAF ticks every 16ms on the device, so an exact 33.3ms gate skips the 32ms tick and halves to 20fps
      if (time - this.lastFrame >= FRAME_MS - FRAME_TOLERANCE_MS || this.lastFrame === 0) {
        const dt = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000
        this.lastFrame = time
        life = age(life, dt)
        sincePoll += dt
        sinceSave += dt
        let meal = false
        let evolved = false
        if (sincePoll >= 2) {
          sincePoll = 0
          const line = localStorage.getItem('food') || bytesToText(readCacheFile('/sim/food.txt'))
          const result = digest(life, line)
          life = result.life
          meal = result.meal
          evolved = result.evolved
          if (result.ate > 0 || evolved) {
            console.log('puckling: ate ' + result.ate + ' kcal, ' + life.stage + ' ' + life.branch + ' lifetime=' + life.lifetime)
            localStorage.setItem('life', serializeLife(life))
            sinceSave = 0
          }
        }
        if (sinceSave >= 600) {
          localStorage.setItem('life', serializeLife(life))
          sinceSave = 0
        }
        this.pet = step(this.pet, { tap: this.tap, life: petLife(life, wallTime()), meal, evolved }, dt)
        this.tap = undefined
        const p = pose(this.pet)
        renderer.draw(ctx, p)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
}
