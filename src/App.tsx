import { Component, type GeaCanvasElement } from '@geastack/core'

export class App extends Component<GeaCanvasElement> {
  template() {
    return <canvas width={466} height={466} onPointerDown={(event) => console.log('pointerdown', event.clientX, event.clientY)} onPointerUp={(event) => console.log('pointerup', event.clientX, event.clientY)} />
  }

  onAfterRender() {
    if (!this.el) return
    const ctx = this.el.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 466, 466)
    ctx.fillStyle = '#ff8000'
    ctx.beginPath()
    ctx.arc(233, 233, 80, 0, Math.PI * 2)
    ctx.fill()
  }
}
