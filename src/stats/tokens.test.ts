import { expect, test } from 'bun:test'
import { splitFeed } from './tokens'

test('splits food and validates token lines', () => {
  expect(splitFeed('')).toEqual({ food: '', tokens: undefined })
  expect(splitFeed('food\n1 2 100 40 20 30 10 5\na 60\nbad -2\nb 40\n')).toEqual({ food: 'food', tokens: { generation: 2, total: 100, input: 40, output: 20, cacheRead: 30, cacheWrite: 10, today: 5, models: [{ model: 'a', tokens: 60 }, { model: 'b', tokens: 40 }] } })
  for (const line of ['', '1 2 3', '2 0 0 0 0 0 0 0', '1 0 -1 0 0 0 0 0', '1 0 1.5 0 0 0 0 0', '1 0  0 0 0 0 0']) expect(splitFeed('food\n' + line).tokens).toBeUndefined()
})
