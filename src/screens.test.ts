import { expect, test } from 'bun:test'
import { createLife } from './pet/life'
import { drawScreen, screenKey, type ScreenData } from './screens'

const data: ScreenData = {
  life: createLife(),
  evo: { stage: 0, adjective: 0, nerd: 0, generation: 1, snapshot: [] },
  tokens: { generation: 1, total: 100, input: 50, output: 50, cacheRead: 0, cacheWrite: 0, today: 100, models: [] },
  level: 100, charging: false, feedAge: 1,
}

test('screen keys reflect displayed scalar changes', () => {
  expect(screenKey(1, data)).toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, level: 50 })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, tokens: { ...data.tokens!, total: 101 } })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, evo: { ...data.evo, adjective: 1 } })).not.toBe(screenKey(1, data))
  expect(screenKey(1, { ...data, life: { ...data.life, lifetime: 10000 } })).not.toBe(screenKey(1, data))
  expect(screenKey(3, { ...data, feedAge: 2 })).not.toBe(screenKey(3, data))
})

test('centres bitmap fallback text and draws arcs with filled circles', () => {
  const labels: { value: string; x: number }[] = []
  let circles = 0
  const ctx = {
    font: '', fillStyle: '',
    measureText: () => 0,
    measureTextInkCenter: () => 0,
    fillText: (value: string, x: number) => labels.push({ value, x }),
    fillRect: () => {},
    beginPath: () => {},
    arc: () => { circles++ },
    fill: () => {},
  }
  drawScreen(ctx as never, 3, data)
  const label = labels.find(item => item.value === 'sum 100 tok')!
  expect(label.x).toBe(233 - label.value.length * Math.round(27 / 2) / 2)
  expect(labels.every(item => /^[\x00-\x7f]*$/.test(item.value))).toBe(true)
  expect(circles).toBeGreaterThan(50)
})

test('centres text with browser metrics', () => {
  const labels: number[] = []
  const ctx = {
    font: '', fillStyle: '',
    measureText: () => ({ width: 80 }),
    fillText: (_value: string, x: number) => labels.push(x),
    fillRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
  }
  drawScreen(ctx as never, 3, data)
  expect(labels[0]).toBe(193)
})
