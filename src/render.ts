import type { GeaCanvasElement } from '@geastack/core'
import { SIZE, BODY_RADIUS, BODY_HALF_WIDTH, BODY_HEIGHT, ARM_EXTENT, ARM_TOP, ARM_HEIGHT, LEG_LENGTH, SHADOW_HALF_WIDTH, SHADOW_OFFSET, SHADOW_HEIGHT, poseBounds, type PetPose } from './pet/pet'

type Context2D = ReturnType<GeaCanvasElement['getContext']>

const BACKGROUND = '#000000'
const EYES = '#000000'
let previousBounds: ReturnType<typeof poseBounds> | undefined
let previousBrightness: number | undefined

function colour(r: number, g: number, b: number, brightness: number): string {
  const hex = '0123456789abcdef'
  const red = Math.round(r * brightness), green = Math.round(g * brightness), blue = Math.round(b * brightness)
  return '#' + hex[Math.floor(red / 16)] + hex[red % 16] + hex[Math.floor(green / 16)] + hex[green % 16] + hex[Math.floor(blue / 16)] + hex[blue % 16]
}

export function drawFrame(ctx: Context2D, p: PetPose): void {
  const sx = p.scaleX
  const sy = p.scaleY
  const lift = p.groundY - p.y
  const left = p.x - ARM_EXTENT * sx
  const top = p.y + BODY_RADIUS - (BODY_HEIGHT + LEG_LENGTH) * sy

  ctx.fillStyle = BACKGROUND
  const bounds = poseBounds(p)
  if (!previousBounds || previousBrightness !== p.brightness) {
    ctx.fillRect(0, 0, SIZE, SIZE)
  } else {
    const x = Math.min(previousBounds.x, bounds.x)
    const y = Math.min(previousBounds.y, bounds.y)
    const right = Math.max(previousBounds.x + previousBounds.width, bounds.x + bounds.width)
    const bottom = Math.max(previousBounds.y + previousBounds.height, bounds.y + bounds.height)
    ctx.fillRect(x, y, right - x, bottom - y)
  }
  previousBounds = bounds
  previousBrightness = p.brightness

  ctx.fillStyle = colour(40, 32, 29, p.brightness)
  ctx.fillRect(p.x - SHADOW_HALF_WIDTH + lift / 2, p.groundY + SHADOW_OFFSET, 2 * SHADOW_HALF_WIDTH - lift, SHADOW_HEIGHT)

  ctx.fillStyle = colour(217, 119, 87, p.brightness)
  ctx.fillRect(p.x - BODY_HALF_WIDTH * sx, top, 2 * BODY_HALF_WIDTH * sx, BODY_HEIGHT * sy)
  ctx.fillRect(left, top + ARM_TOP * sy, (ARM_EXTENT - BODY_HALF_WIDTH + 1) * sx, ARM_HEIGHT * sy)
  ctx.fillRect(p.x + (BODY_HALF_WIDTH - 1) * sx, top + ARM_TOP * sy, (ARM_EXTENT - BODY_HALF_WIDTH + 1) * sx, ARM_HEIGHT * sy)
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? 24 + i * 16 : 80 + (i - 2) * 16
    ctx.fillRect(left + x * sx, top + BODY_HEIGHT * sy, 8 * sx, LEG_LENGTH * sy)
  }

  ctx.fillStyle = EYES
  const eyeHeight = Math.max(3, 26 * p.eyeOpen) * sy
  const eyeShift = p.lookX + p.facing * 2
  const eyeTop = top + 38 * sy - eyeHeight / 2
  ctx.fillRect(left + (32 + eyeShift) * sx, eyeTop, 8 * sx, eyeHeight)
  ctx.fillRect(left + (88 + eyeShift) * sx, eyeTop, 8 * sx, eyeHeight)
}
