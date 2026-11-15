import type { GeaCanvasElement } from '@geastack/core'
import { SIZE, type PetPose } from './pet/pet'

type Context2D = ReturnType<GeaCanvasElement['getContext']>

const BACKGROUND = '#000000'
const SHADOW = '#28201d'
const BODY = '#d97757'
const EYES = '#000000'

const DESIGN_RADIUS = 64

export function drawFrame(ctx: Context2D, p: PetPose, groundY: number): void {
  const unit = p.bodyRadius / DESIGN_RADIUS
  const sx = p.scaleX
  const sy = p.scaleY
  const lift = groundY - p.y
  const left = p.x - 64 * unit * sx
  const top = p.y + (64 - 128 * sy) * unit

  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.fillStyle = SHADOW
  ctx.fillRect(p.x - 34 * unit + lift / 2, groundY + 65 * unit, 68 * unit - lift, 4 * unit)

  ctx.fillStyle = BODY
  ctx.fillRect(left + 16 * unit * sx, top, 96 * unit * sx, 102 * unit * sy)
  ctx.fillRect(left, top + 51 * unit * sy, 17 * unit * sx, 26 * unit * sy)
  ctx.fillRect(left + 111 * unit * sx, top + 51 * unit * sy, 17 * unit * sx, 26 * unit * sy)
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? 24 + i * 16 : 80 + (i - 2) * 16
    ctx.fillRect(left + x * unit * sx, top + 102 * unit * sy, 8 * unit * sx, 26 * unit * sy)
  }

  ctx.fillStyle = EYES
  const eyeHeight = Math.max(3 * unit, 26 * unit * p.eyeOpen) * sy
  const eyeShift = (p.lookX + p.facing * 2) * unit
  const eyeTop = top + (38 + p.lookY) * unit * sy - eyeHeight / 2
  ctx.fillRect(left + (32 * unit + eyeShift) * sx, eyeTop, 8 * unit * sx, eyeHeight)
  ctx.fillRect(left + (88 * unit + eyeShift) * sx, eyeTop, 8 * unit * sx, eyeHeight)
}
