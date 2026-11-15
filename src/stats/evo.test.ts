import { expect, test } from 'bun:test'
import { ADJECTIVES, NERDS, evoName, updateEvo, sinceEvo, sinceEvoTotal, serializeEvo, parseEvo } from './evo'
import type { Tokens } from './tokens'

const tokens: Tokens = { generation: 2, total: 30, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, today: 0, models: [{ model: 'a', tokens: 20 }, { model: 'b', tokens: 10 }] }
test('names, snapshots, resets and identity', () => {
  const evo = updateEvo(undefined, 1, tokens, () => 0)
  expect(evoName(evo)).toBe(ADJECTIVES[0] + '_' + NERDS[0])
  expect(evo.snapshot).not.toBe(tokens.models)
  expect(updateEvo(evo, 1, tokens, () => 0)).toBe(evo)
  const changed = { ...tokens, models: [{ model: 'a', tokens: 25 }, { model: 'b', tokens: 5 }, { model: 'c', tokens: 3 }] }
  expect(sinceEvo(evo, changed)).toEqual([{ model: 'a', tokens: 5 }, { model: 'b', tokens: 0 }, { model: 'c', tokens: 3 }])
  expect(sinceEvoTotal(evo, changed)).toBe(8)
  expect(updateEvo(evo, 1, { ...tokens, generation: 3 }, () => 0).generation).toBe(3)
  expect(updateEvo(evo, 2, undefined, () => 0).generation).toBe(-1)
  expect(updateEvo(updateEvo(undefined, 1, undefined, () => 0), 1, tokens, () => 0).snapshot).toEqual(tokens.models)
})
test('saved evolution round trips and rejects malformed data', () => {
  const evo = updateEvo(undefined, 5, tokens, () => 0.99)
  expect(parseEvo(serializeEvo(evo))).toEqual(evo)
  expect(parseEvo(serializeEvo(updateEvo(undefined, 0, undefined, () => 0)))).toEqual(updateEvo(undefined, 0, undefined, () => 0))
  for (const text of ['', '1 6 0 0 0 0', '1 0 -1 0 0 0', '1 0 0 0 -2 0', '1 0 0 0 0 1 a', '1 0 0 0 0 1 a -1', '1 0 0 0 0 0 extra']) expect(parseEvo(text)).toBeUndefined()
})
