import { Component, type GeaCanvasElement } from '@geastack/core'
import { createPet, step, pose, SIZE } from './pet/pet'
import { drawFrame } from './render'

const FRAME_MS = 1000 / 30
const FRAME_TOLERANCE_MS = 4

export class App extends Component<GeaCanvasElement> {
  private pet = createPet(12345)
  private tap: { x: number; y: number } | undefined
  private lastFrame = 0

  template() {
    return <canvas width={SIZE} height={SIZE} onPointerDown={(event) => { this.tap = { x: event.clientX, y: event.clientY } }} />
  }

  onAfterRender() {
    if (!this.el) return
    const ctx = this.el.getContext('2d')
    const frame = (time: number) => {
      // rAF ticks every 16ms on the device, so an exact 33.3ms gate skips the 32ms tick and halves to 20fps
      if (time - this.lastFrame >= FRAME_MS - FRAME_TOLERANCE_MS || this.lastFrame === 0) {
        const dt = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000
        this.lastFrame = time
        this.pet = step(this.pet, { tap: this.tap }, dt)
        this.tap = undefined
        const p = pose(this.pet)
        drawFrame(ctx, p)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
}
