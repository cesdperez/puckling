import type { GeaCanvasElement } from '@geastack/core'
import { SIZE, poseBounds, poseRects, type Bounds, type PetPose } from './pet/pet'

type Context2D = ReturnType<GeaCanvasElement['getContext']>

const BACKGROUND = '#000000'
const EYES = '#000000'
type Frame = { bounds: Bounds; brightness: number }

function colour(r: number, g: number, b: number, brightness: number): string {
  const hex = '0123456789abcdef'
  const red = Math.round(r * brightness), green = Math.round(g * brightness), blue = Math.round(b * brightness)
  return '#' + hex[Math.floor(red / 16)] + hex[red % 16] + hex[Math.floor(green / 16)] + hex[green % 16] + hex[Math.floor(blue / 16)] + hex[blue % 16]
}

function clearDirty(ctx: Context2D, bounds: Bounds, brightness: number, previous: Frame | undefined): void {
  ctx.fillStyle = BACKGROUND
  if (!previous || previous.brightness !== brightness) {
    ctx.fillRect(0, 0, SIZE, SIZE)
  } else {
    const x = Math.min(previous.bounds.x, bounds.x)
    const y = Math.min(previous.bounds.y, bounds.y)
    const right = Math.max(previous.bounds.x + previous.bounds.width, bounds.x + bounds.width)
    const bottom = Math.max(previous.bounds.y + previous.bounds.height, bounds.y + bounds.height)
    ctx.fillRect(x, y, right - x, bottom - y)
  }
}

export class FrameRenderer {
  private previous: Frame | undefined

  draw(ctx: Context2D, p: PetPose): void {
    const bounds = poseBounds(p)
    clearDirty(ctx, bounds, p.brightness, this.previous)
    this.previous = { bounds, brightness: p.brightness }
    paint(ctx, p)
  }
}

function paint(ctx: Context2D, p: PetPose): void {
  let part: string | undefined
  for (const rect of poseRects(p)) {
    if (rect.part !== part) {
      part = rect.part
      ctx.fillStyle = part === 'shadow' ? colour(40, 32, 29, p.brightness) :
        part === 'body' ? colour(217, 119, 87, p.brightness) : EYES
    }
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  }
}
