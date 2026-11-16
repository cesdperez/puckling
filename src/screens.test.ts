import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createLife } from './pet/life'
import { CENTER, drawScreen, FONTS, GAP, LEFT, RIGHT, screenKey, type ScreenData } from './screens'
import { PAGES } from './ui/pager'

const data: ScreenData = {
  life: createLife(),
  evo: { stage: 0, adjective: 0, nerd: 0, generation: 1, snapshot: [] },
  tokens: { generation: 1, total: 100, input: 50, output: 50, cacheRead: 0, cacheWrite: 0, today: 100, models: [] },
  level: 100, charging: false, feedAge: 1,
}

type Metric = number | ((value: string) => number)
type Drawn = { value: string; x: number; y: number; font: string; color: string }
type Rect = { x: number; y: number; w: number; h: number; color: string }
type Ink = (value: string, font: string) => number
function recorder(metric: Metric, ink: boolean | Ink = true) {
  const labels: Drawn[] = [], paths: number[][][] = [], rects: Rect[] = []
  const width = (value: string) => typeof metric === 'function' ? metric(value) : metric
  const measured = typeof ink === 'function' ? ink : () => 0
  let path: number[][] = []
  const ctx = {
    font: '', fillStyle: '',
    measureText: (value: string) => width(value),
    ...(ink ? { measureTextInkCenter: (value: string) => measured(value, ctx.font) } : {}),
    fillText(value: string, x: number, y: number) { labels.push({ value, x, y, font: ctx.font, color: ctx.fillStyle }) },
    fillRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, color: ctx.fillStyle }) },
    beginPath() { path = [] },
    moveTo(x: number, y: number) { path.push([x, y]) },
    lineTo(x: number, y: number) { path.push([x, y]) },
    closePath() {},
    fill() { paths.push(path) },
  }
  return { ctx, labels, paths, rects }
}
const width = (value: string) => value.length * 8

test('screen keys reflect displayed values', () => {
  expect(screenKey(1, data)).toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, level: 50 })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, tokens: { ...data.tokens!, total: 101 } })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, evo: { ...data.evo, adjective: 1 } })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, life: { ...data.life, lifetime: 10000 } })).not.toBe(screenKey(1, data))
  expect(screenKey(3, { ...data, feedAge: 2 })).not.toBe(screenKey(3, data))
  expect(screenKey(3, { ...data, tokens: { ...data.tokens!, cacheRead: 1 } })).not.toBe(screenKey(3, data))
})

test('a model share change redraws the token page', () => {
  const models = [{ model: 'opus', tokens: 60 }, { model: 'sonnet', tokens: 40 }]
  const other = [{ model: 'opus', tokens: 50 }, { model: 'sonnet', tokens: 40 }]
  expect(screenKey(2, { ...data, tokens: { ...data.tokens!, models } })).not.toBe(screenKey(2, { ...data, tokens: { ...data.tokens!, models: other } }))
})

test('centres display text and draws the arc band as filled polygons', () => {
  const { ctx, labels, paths } = recorder(0)
  drawScreen(ctx as never, 1, data)
  const label = labels.find(item => item.value === 'LV 0')!
  expect(label.x).toBe(CENTER - ('LV 0'.length * 32) / 2)
  expect(label.font).toBe('64px InterDisplay')
  const quads = paths.filter(points => points.length === 4)
  expect(quads.length).toBeGreaterThan(100)
  const radiusOf = (point: number[]) => Math.hypot(point[0] - CENTER, point[1] - CENTER)
  for (const point of quads[0].slice(0, 2)) expect(radiusOf(point)).toBeCloseTo(211, 3)
  for (const point of quads[0].slice(2)) expect(radiusOf(point)).toBeCloseTo(201, 3)
})

test('draws page dots as filled squares', () => {
  const { ctx, rects } = recorder(width)
  drawScreen(ctx as never, 3, data)
  const dots = rects.filter(rect => rect.h === 6)
  expect(dots.length).toBe(PAGES)
  expect(dots[3]).toMatchObject({ x: 203 + 3 * 20 - 5, y: 421, w: 10 })
  expect(dots[0]).toMatchObject({ x: 203 - 3, w: 6 })
  expect(dots[3].color).not.toBe(dots[0].color)
})

test('centres every string in a font on the cap height, not its own ink', () => {
  const ink = (value: string) => value === 'H' ? 7 : 12
  const { ctx, labels } = recorder(width, ink)
  drawScreen(ctx as never, 3, data)
  const label = labels.find(item => item.value === 'Today')!
  const value = labels.find(item => item.value === '100')!
  expect(label.y).toBe(value.y)
  expect(label.y).toBe(148 - 7)
})

test('hangs the smaller token delta from the value cap line', () => {
  const ink = (value: string, font: string) => value === 'H' ? (font.startsWith('13') ? 5 : 7) : 12
  const tokens = { ...data.tokens!, total: 100, models: [{ model: 'opus', tokens: 60 }] }
  const snapshot = [{ model: 'opus', tokens: 20 }]
  const { ctx, labels } = recorder(width, ink)
  drawScreen(ctx as never, 2, { ...data, evo: { ...data.evo, snapshot }, tokens })
  const value = labels.find(item => item.value === '60')!
  const delta = labels.find(item => item.value === '+40')!
  // The 13px delta and the 16px value share their ink top, so their cap lines meet.
  expect(value.y).toBe(186 - 7)
  expect(delta.y).toBe(value.y)
})

test('right-aligns values and left-aligns labels at the layout edges', () => {
  const { ctx, labels } = recorder(width)
  drawScreen(ctx as never, 3, data)
  expect(labels.find(item => item.value === 'Today')!.x).toBe(LEFT)
  expect(labels.find(item => item.value === '100')!.x).toBe(RIGHT - '100'.length * 8)
})

test('centres a measured string on CENTER', () => {
  const { ctx, labels } = recorder(width)
  drawScreen(ctx as never, 3, data)
  const system = labels.find(item => item.value === 'System')!
  expect(system.x).toBe(CENTER - ('System'.length * 8) / 2)
})

test('draws at the browser baseline when there is no ink centre', () => {
  const { ctx, labels } = recorder(0, false)
  drawScreen(ctx as never, 1, data)
  expect(labels.find(item => item.value === 'LV 0')!.y).toBe(164 + Math.round(64 * 0.36))
  drawScreen(ctx as never, 3, data)
  expect(labels.find(item => item.value === 'System')!.y).toBe(88 + Math.round(26 * 0.36))
})

test('truncates a model name that does not fit its column', () => {
  const tokens = { ...data.tokens!, models: [{ model: 'a-very-long-model-name-that-overflows', tokens: 100 }] }
  const { ctx, labels } = recorder(width)
  drawScreen(ctx as never, 2, { ...data, tokens })
  const name = labels.find(item => item.value.endsWith('...'))!
  expect(name.x).toBe(LEFT)
  expect(name.value.length * 8).toBeLessThanOrEqual(RIGHT - LEFT)
})

test('fits a long model name left of the since-evo delta', () => {
  const model = 'a-very-long-model-name-that-overflows'
  const tokens = { ...data.tokens!, total: 100, models: [{ model, tokens: 100 }] }
  const snapshot = [{ model, tokens: 40 }]
  const { ctx, labels } = recorder(width)
  drawScreen(ctx as never, 2, { ...data, evo: { ...data.evo, snapshot }, tokens })
  const name = labels.find(item => item.value.endsWith('...'))!
  const delta = labels.find(item => item.value === '+60')!
  expect(name.x).toBe(LEFT)
  expect(name.x + name.value.length * 8).toBeLessThanOrEqual(delta.x - GAP)
})

test('places the since-evo delta beside the value and skips a zero delta', () => {
  const models = [{ model: 'opus', tokens: 60 }, { model: 'sonnet', tokens: 40 }]
  const snapshot = [{ model: 'opus', tokens: 20 }, { model: 'sonnet', tokens: 40 }]
  const tokens = { ...data.tokens!, total: 100, models }
  const { ctx, labels } = recorder(width)
  drawScreen(ctx as never, 2, { ...data, evo: { ...data.evo, snapshot }, tokens })
  const delta = labels.find(item => item.value === '+40')!
  expect(delta.font).toBe('13px Inter')
  expect(delta.x).toBe(RIGHT - '60'.length * 8 - GAP - '+40'.length * 8)
  const same = recorder(width)
  drawScreen(same.ctx as never, 2, { ...data, evo: { ...data.evo, snapshot: models }, tokens })
  expect(same.labels.some(item => item.value === '+0')).toBe(false)
})

test('every drawn string stays inside its font charset', () => {
  const byFont = new Map(FONTS.map(font => [font.size + 'px ' + font.family, font]))
  const large = 1e33
  const tokens = { generation: 1, total: large, input: large, output: large, cacheRead: large, cacheWrite: large, today: large, models: [{ model: 'opus', tokens: large }] }
  const life = { ...createLife(), stage: 'final' as const, branch: 'ember' as const }
  const evo = { ...data.evo, stage: 5 }
  for (const page of [0, 1, 2, 3]) {
    const { ctx, labels } = recorder(0)
    drawScreen(ctx as never, page, { ...data, life, evo, tokens })
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      const font = byFont.get(label.font)
      expect(font).toBeDefined()
      if (font?.charset) for (const char of label.value) expect(font.charset).toContain(char)
    }
  }
})

test('every font the screens draw has a css rule with its charset', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
  const rules = (css.match(/\{[^}]*\}/g) ?? []).map(block => block.slice(1, -1))
  const property = (rule: string, name: string) => rule.match(new RegExp(name + ':\\s*([^;]+)'))?.[1].trim()
  const unquote = (value: string) => value.replace(/^['"]|['"]$/g, '')
  for (const font of FONTS) {
    const rule = rules.find(candidate =>
      unquote(property(candidate, 'font-family') ?? '') === font.family &&
      property(candidate, 'font-size') === font.size + 'px')
    expect(rule).toBeDefined()
    const charset = property(rule!, '--gea-font-charset')
    expect(charset === undefined ? undefined : unquote(charset)).toBe(font.charset)
  }
})
