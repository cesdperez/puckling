import { expect, test } from 'bun:test'
import { createLife } from './pet/life'
import { screenKey, type ScreenData } from './screens'

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
