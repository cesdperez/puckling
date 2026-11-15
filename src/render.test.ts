import { expect, test } from 'bun:test'
import type { GeaCanvasElement } from '@geastack/core'
import { createPet, pose, SIZE } from './pet/pet'
import { poseBounds, poseRects } from './pet/shape'
import { FrameRenderer } from './render'

test('clears dirty bounds and paints each rect with its scaled colour', () => {
  const styles: string[] = []
  const fills: { style: string; args: number[] }[] = []
  let style = ''
  const ctx = {
    set fillStyle(value: string) { style = value; styles.push(value) },
    fillRect(x: number, y: number, width: number, height: number) {
      fills.push({ style, args: [x, y, width, height] })
    },
  } as unknown as ReturnType<GeaCanvasElement['getContext']>
  const renderer = new FrameRenderer()
  const first = { ...pose(createPet(1)), brightness: 0.5 }
  const rects = poseRects(first)
  renderer.draw(ctx, first)
  expect(fills[0]).toEqual({ style: '#000000', args: [0, 0, SIZE, SIZE] })
  const color = (r: number, g: number, b: number) => '#' + [r, g, b].map(n => Math.round(n * first.brightness).toString(16).padStart(2, '0')).join('')
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    expect(fills[i + 1]).toEqual({ style: color(r.r, r.g, r.b), args: [r.x, r.y, r.width, r.height] })
  }
  const expectedStyles = ['#000000']
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i], previous = rects[i - 1]
    if (!previous || r.r !== previous.r || r.g !== previous.g || r.b !== previous.b) expectedStyles.push(color(r.r, r.g, r.b))
  }
  expect(styles).toEqual(expectedStyles)
  const second = { ...first, x: first.x + 30 }
  const a = poseBounds(first), b = poseBounds(second)
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  const width = Math.max(a.x + a.width, b.x + b.width) - x
  const height = Math.max(a.y + a.height, b.y + b.height) - y
  const offset = fills.length
  renderer.draw(ctx, second)
  expect(fills[offset]).toEqual({ style: '#000000', args: [x, y, width, height] })
})
