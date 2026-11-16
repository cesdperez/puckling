import { expect, test } from 'bun:test'
import { createLife } from './pet/life'
import { drawScreen, screenKey, type ScreenData } from './screens'

const data: ScreenData = {
  life: createLife(),
  evo: { stage: 0, adjective: 0, nerd: 0, generation: 1, snapshot: [] },
  tokens: { generation: 1, total: 100, input: 50, output: 50, cacheRead: 0, cacheWrite: 0, today: 100, models: [] },
  level: 100, charging: false, feedAge: 1,
}

type Drawn = { value: string; x: number; y: number; font: string; color: string }
function recorder(metric: number) {
  const labels: Drawn[] = [], arcs: number[][] = []
  const ctx = {
    font: '', fillStyle: '',
    measureText: () => metric,
    measureTextInkCenter: () => 0,
    fillText(value: string, x: number, y: number) { labels.push({ value, x, y, font: ctx.font, color: ctx.fillStyle }) },
    fillRect: () => {},
    beginPath: () => {},
    arc: (x: number, y: number, radius: number) => { arcs.push([x, y, radius]) },
    fill: () => {},
  }
  return { ctx, labels, arcs }
}

test('screen keys reflect displayed values', () => {
  expect(screenKey(1, data)).toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, level: 50 })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, tokens: { ...data.tokens!, total: 101 } })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, evo: { ...data.evo, adjective: 1 } })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, life: { ...data.life, lifetime: 10000 } })).not.toBe(screenKey(1, data))
  expect(screenKey(3, { ...data, feedAge: 2 })).not.toBe(screenKey(3, data))
})

test('a model share change redraws the token page', () => {
  const models = [{ model: 'opus', tokens: 60 }, { model: 'sonnet', tokens: 40 }]
  const other = [{ model: 'opus', tokens: 50 }, { model: 'sonnet', tokens: 40 }]
  expect(screenKey(2, { ...data, tokens: { ...data.tokens!, models } })).not.toBe(screenKey(2, { ...data, tokens: { ...data.tokens!, models: other } }))
})

test('centres display text and draws arcs with filled circles', () => {
  const { ctx, labels, arcs } = recorder(0)
  drawScreen(ctx as never, 1, data)
  const label = labels.find(item => item.value === 'LV 0')!
  expect(label.x).toBe(169)
  expect(label.font).toBe('64px InterDisplay')
  expect(labels.every(item => /^[\x00-\x7f]*$/.test(item.value))).toBe(true)
  expect(arcs.length).toBeGreaterThan(30)
  expect(arcs[0][0]).toBeCloseTo(233, 2)
  expect(arcs[0][1]).toBeCloseTo(27, 2)
  expect(arcs[0][2]).toBe(5)
})

test('right-aligns values with the bitmap fallback width', () => {
  const { ctx, labels } = recorder(0)
  drawScreen(ctx as never, 3, data)
  expect(labels.find(item => item.value === 'Today')!.x).toBe(92)
  expect(labels.find(item => item.value === '100')!.x).toBe(374 - 3 * 8)
})

test('truncates a model name that does not fit its column', () => {
  const tokens = { ...data.tokens!, models: [{ model: 'a-very-long-model-name-that-overflows', tokens: 100 }] }
  const { ctx, labels } = recorder(0)
  drawScreen(ctx as never, 2, { ...data, tokens })
  const name = labels.find(item => item.value.endsWith('...'))!
  expect(name.value.length).toBe(23)
  expect(name.x).toBe(92)
})

test('places the since-evo delta beside the value and skips a zero delta', () => {
  const models = [{ model: 'opus', tokens: 60 }, { model: 'sonnet', tokens: 40 }]
  const snapshot = [{ model: 'opus', tokens: 20 }, { model: 'sonnet', tokens: 40 }]
  const tokens = { ...data.tokens!, total: 100, models }
  const { ctx, labels } = recorder(0)
  drawScreen(ctx as never, 2, { ...data, evo: { ...data.evo, snapshot }, tokens })
  const delta = labels.find(item => item.value === '+40')!
  expect(delta.x).toBe(374 - 2 * 8 - 8 - 3 * 7)
  expect(delta.font).toBe('13px Inter')
  const same = recorder(0)
  drawScreen(same.ctx as never, 2, { ...data, evo: { ...data.evo, snapshot: models }, tokens })
  expect(same.labels.some(item => item.value === '+0')).toBe(false)
})

test('centres text with browser metrics', () => {
  const { ctx, labels } = recorder(80)
  drawScreen(ctx as never, 3, data)
  expect(labels[0].value).toBe('System')
  expect(labels[0].x).toBe(193)
})
