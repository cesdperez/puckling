import { expect, test } from 'bun:test'
import { formatTokens, formatPercent } from './format'
test('formats tokens without rounding', () => {
  for (const [n, text] of [[0, '0'], [999, '999'], [1234, '1.23k'], [12345, '12.3k'], [123456, '123k'], [999999, '999k'], [1234567, '1.23M'], [5120000000, '5.12B'], [1000000000000, '1T']] as [number, string][]) expect(formatTokens(n)).toBe(text)
})
test('truncates without binary float error', () => {
  for (const [n, text] of [[4100, '4.1k'], [1150, '1.15k'], [4100000000, '4.1B'], [999999, '999k']] as [number, string][]) expect(formatTokens(n)).toBe(text)
})
test('clamps percentage', () => {
  expect(formatPercent(-1)).toBe('0%')
  expect(formatPercent(0.459)).toBe('45%')
  expect(formatPercent(2)).toBe('100%')
})
