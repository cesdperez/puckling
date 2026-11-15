import { Component, Display, type GeaCanvasElement } from '@geastack/core'
import { createPet, step, pose, SIZE } from './pet/pet'
import { drawFrame } from './render'

export class App extends Component<GeaCanvasElement> {
  private pet = createPet(12345)
  private tap: { x: number; y: number } | undefined
  private lastFrame = 0
  private brightness = -1

  template() {
    return <canvas width={SIZE} height={SIZE} onPointerDown={(event) => { this.tap = { x: event.clientX, y: event.clientY } }} />
  }

  onAfterRender() {
    if (!this.el) return
    const ctx = this.el.getContext('2d')
    const frame = (time: number) => {
      if (time - this.lastFrame >= 33 || this.lastFrame === 0) {
        const dt = this.lastFrame === 0 ? 0 : (time - this.lastFrame) / 1000
        this.lastFrame = time
        this.pet = step(this.pet, { tap: this.tap }, dt)
        this.tap = undefined
        const p = pose(this.pet)
        const brightness = Math.round(p.brightness * 100)
        if (brightness !== this.brightness) {
          Display.setBrightness(brightness)
          this.brightness = brightness
        }
        drawFrame(ctx, p, this.pet.y)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
}
