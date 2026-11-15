import { expect, test } from 'bun:test'
import { classify, createPager, stepPager, showBattery, RETURN_AFTER } from './pager'
test('classifies gestures', () => {
  expect(classify({ x: 100, y: 5 }, { x: 60, y: 5 })).toEqual({ kind: 'swipe', x: 100, y: 5, direction: 1 })
  expect(classify({ x: 0, y: 0 }, { x: 40, y: 0 }).direction).toBe(-1)
  expect(classify({ x: 0, y: 0 }, { x: 40, y: 40 }).kind).toBe('tap')
})
test('pages, idle and battery', () => {
  const swipe = classify({ x: 100, y: 0 }, { x: 0, y: 0 })
  let pager = stepPager(createPager(), swipe, 1)
  expect(pager).toEqual({ page: 1, idle: 0 })
  for (let i = 0; i < 5; i++) pager = stepPager(pager, swipe, 0)
  expect(pager.page).toBe(3)
  pager = stepPager(pager, { kind: 'none', x: 0, y: 0, direction: 0 }, RETURN_AFTER)
  expect(pager.page).toBe(0)
  expect(showBattery(0, 21, false)).toBe(false)
  expect(showBattery(0, 20, false)).toBe(true)
  expect(showBattery(0, 80, true)).toBe(true)
  expect(showBattery(1, 80, false)).toBe(true)
})
