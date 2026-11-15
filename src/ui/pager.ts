export const PAGES = 4
export const RETURN_AFTER = 20
export type Point = { x: number; y: number }
export type Gesture = { kind: 'none' | 'tap' | 'swipe'; x: number; y: number; direction: number }
export function classify(start: Point, end: Point): Gesture {
  const dx = end.x - start.x, dy = end.y - start.y
  if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) return { kind: 'swipe', x: start.x, y: start.y, direction: dx < 0 ? 1 : -1 }
  return { kind: 'tap', x: start.x, y: start.y, direction: 0 }
}
export type Pager = { page: number; idle: number }
export function createPager(): Pager { return { page: 0, idle: 0 } }
export function stepPager(pager: Pager, gesture: Gesture, dt: number): Pager {
  let page = pager.page, idle = pager.idle
  if (gesture.kind === 'swipe') { page = Math.min(PAGES - 1, Math.max(0, page + gesture.direction)); idle = 0 }
  else if (gesture.kind === 'tap') idle = 0
  else idle += dt
  if (page !== 0 && idle >= RETURN_AFTER) { page = 0; idle = 0 }
  return { page, idle }
}
export function showBattery(page: number, level: number, charging: boolean): boolean { return page !== 0 || level <= 20 || charging }
