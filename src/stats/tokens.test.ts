import { expect, test } from 'bun:test'
import { splitFeed } from './tokens'

test('splits food and validates token lines', () => {
  expect(splitFeed('')).toEqual({ food: '', tokens: undefined })
  expect(splitFeed('food\n1 2 100 40 20 30 10 5\na 60\nbad -2\nb 40\n')).toEqual({ food: 'food', tokens: { generation: 2, total: 100, input: 40, output: 20, cacheRead: 30, cacheWrite: 10, today: 5, models: [{ model: 'a', tokens: 60 }, { model: 'b', tokens: 40 }] } })
  for (const line of ['', '1 2 3', '2 0 0 0 0 0 0 0', '1 0 -1 0 0 0 0 0', '1 0 1.5 0 0 0 0 0', '1 0  0 0 0 0 0']) expect(splitFeed('food\n' + line)).toEqual({ food: 'food', tokens: undefined })
})

test('keeps the header while skipping malformed model rows', () => {
  const header = 'food\n1 2 100 40 20 30 10 5'
  expect(splitFeed(header).tokens?.models).toEqual([])
  expect(splitFeed(header + '\na 1 2\n 1\na nope\ngood 3').tokens?.models).toEqual([{ model: 'good', tokens: 3 }])
})

test('limits model names and valid rows', () => {
  const rows = ['x'.repeat(33) + ' 1', 'x'.repeat(32) + ' 2']
  for (let i = 0; i < 30; i++) rows.push('model' + i + ' ' + i)
  const models = splitFeed('food\n1 2 100 40 20 30 10 5\n' + rows.join('\n')).tokens?.models
  expect(models?.length).toBe(24)
  expect(models?.[0]).toEqual({ model: 'x'.repeat(32), tokens: 2 })
  expect(models?.[23]).toEqual({ model: 'model22', tokens: 22 })
})
