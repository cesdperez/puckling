import type { GeaCanvasElement } from '@geastack/core'
import { progress, STAGES, type Life } from './pet/life'
import { evoName, sinceEvo, sinceEvoTotal, type Evo } from './stats/evo'
import type { Tokens } from './stats/tokens'
import { formatPercent, formatTokens } from './ui/format'
import { PAGES, showBattery } from './ui/pager'

type Context = ReturnType<GeaCanvasElement['getContext']>
export type ScreenData = { life: Life; evo: Evo; tokens: Tokens | undefined; level: number; charging: boolean; feedAge: number }
export type Font = { family: string; size: number; charset?: string }

const BODY = 'Inter', DISPLAY = 'InterDisplay'
const F13: Font = { family: BODY, size: 13 }
const F16: Font = { family: BODY, size: 16 }
const F20: Font = { family: BODY, size: 20 }
const F26: Font = { family: BODY, size: 26 }
const D40: Font = { family: DISPLAY, size: 40, charset: '0123456789.kMBTe+' }
const D64: Font = { family: DISPLAY, size: 64, charset: 'LV0123456789 ' }
export const FONTS: Font[] = [F13, F16, F20, F26, D40, D64]

const TEXT = '#f3eee8', MUTED = '#8c857e', TRACK = '#1e1c1a', ORANGE = '#d97757'
const BLACK = '#000000', RED = '#e5484d', GREEN = '#46a758'
export const CENTER = 233, LEFT = 92, RIGHT = 374, GAP = 8
const WIDTH = RIGHT - LEFT

function measure(ctx: Context, value: string, font: Font): { width: number; center: number } {
  const metric = ctx.measureText(value)
  let width = typeof metric === 'number' ? metric : (metric as TextMetrics).width
  if (width === 0) width = value.length * Math.round(font.size / 2)
  const inkCenter = ctx.measureTextInkCenter ? ctx.measureTextInkCenter(value) : 0
  return { width, center: inkCenter || font.size / 2 }
}
function setFont(ctx: Context, font: Font): void {
  ctx.font = font.size + 'px ' + font.family
}
// The device anchors fillText at the top of the line box and reports the ink offset;
// a browser canvas anchors the baseline and has no ink measurement, so a preview
// needs the cap-height centre to land where the device puts it.
function baselineY(ctx: Context, y: number, font: Font, center: number): number {
  return typeof ctx.measureTextInkCenter === 'function' ? y - center : y + Math.round(font.size * 0.36)
}
type Anchor = 'center' | 'left' | 'right'
// Returns the drawn width so a caller that places a neighbour does not measure again.
function draw(ctx: Context, value: string, x: number, y: number, font: Font, color: string, anchor: Anchor): number {
  setFont(ctx, font)
  ctx.fillStyle = color
  const { width, center } = measure(ctx, value, font)
  const left = anchor === 'right' ? x - width : anchor === 'center' ? x - width / 2 : x
  ctx.fillText(value, left, baselineY(ctx, y, font, center))
  return width
}
function fit(ctx: Context, value: string, font: Font, maxWidth: number): string {
  setFont(ctx, font)
  if (measure(ctx, value, font).width <= maxWidth) return value
  let cut = value
  while (cut.length > 0 && measure(ctx, cut + '...', font).width > maxWidth) cut = cut.slice(0, -1)
  return cut + '...'
}
function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
function arc(ctx: Context, radius: number, width: number, start: number, end: number, color: string, spacing = width): void {
  // A spacing narrower than the circle makes the band read as one stroke rather than a dotted line.
  const count = Math.max(1, Math.ceil((end - start) * radius / spacing))
  ctx.fillStyle = color
  for (let i = 0; i <= count; i++) {
    const angle = start + (end - start) * i / count
    ctx.beginPath(); ctx.arc(CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle), width / 2, 0, Math.PI * 2); ctx.fill()
  }
}
function battery(ctx: Context, level: number): void {
  const start = -Math.PI / 2 - Math.PI * 25 / 180, span = Math.PI * 50 / 180
  arc(ctx, 226, 6, start, start + span, TRACK)
  if (level > 0) arc(ctx, 226, 6, start, start + span * Math.min(100, level) / 100, level <= 20 ? RED : GREEN)
}
function bar(ctx: Context, y: number, share: number): void {
  ctx.fillStyle = TRACK
  ctx.fillRect(LEFT, y, WIDTH, 3)
  if (share > 0) { ctx.fillStyle = ORANGE; ctx.fillRect(LEFT, y, Math.max(1, Math.round(WIDTH * Math.min(1, share))), 3) }
}
function tokenRow(ctx: Context, name: string, value: number, delta: number, y: number, total: number): void {
  const valueWidth = draw(ctx, formatTokens(value), RIGHT, y, F16, TEXT, 'right')
  let deltaWidth = 0
  if (delta > 0) deltaWidth = draw(ctx, '+' + formatTokens(delta), RIGHT - valueWidth - GAP, y, F13, MUTED, 'right')
  const nameWidth = RIGHT - LEFT - valueWidth - (deltaWidth > 0 ? deltaWidth + GAP : 0) - GAP
  draw(ctx, fit(ctx, name, F16, nameWidth), LEFT, y, F16, TEXT, 'left')
  bar(ctx, y + 15, total > 0 ? value / total : 0)
}
export function drawHome(ctx: Context, data: ScreenData, brightness: number): void {
  ctx.fillStyle = BLACK; ctx.fillRect(40, 380, 386, 48)
  const n = Math.round(119 * brightness), hex = '0123456789abcdef', c = hex[Math.floor(n / 16)] + hex[n % 16]
  draw(ctx, 'LV ' + STAGES.indexOf(data.life.stage) + '  ' + evoName(data.evo), CENTER, 406, F16, '#' + c + c + c, 'center')
  ctx.fillStyle = BLACK; ctx.fillRect(132, 0, 202, 35)
  if (showBattery(0, data.level, data.charging)) battery(ctx, data.level)
}
function dots(ctx: Context, page: number): void {
  for (let i = 0; i < PAGES; i++) { ctx.beginPath(); ctx.fillStyle = i === page ? ORANGE : TRACK; ctx.arc(203 + i * 20, 424, 3, 0, Math.PI * 2); ctx.fill() }
}
export function screenKey(page: number, d: ScreenData): string {
  let key = page + '|' + d.level + '|' + d.charging
  if (d.tokens) {
    const t = d.tokens
    key += '|' + t.generation + '|' + t.total + '|' + t.today + '|' + sinceEvoTotal(d.evo, t)
    if (page === 2) key += '|' + t.models.length
    if (page === 3) key += '|' + t.input + '|' + t.output + '|' + t.cacheRead + '|' + t.cacheWrite
  }
  if (page === 1) key += '|' + d.life.stage + '|' + d.life.branch + '|' + formatPercent(progress(d.life)) + '|' + evoName(d.evo)
  if (page === 3) key += '|' + d.feedAge
  return key
}
export function drawScreen(ctx: Context, page: number, d: ScreenData): void {
  ctx.fillStyle = BLACK; ctx.fillRect(0, 0, 466, 466)
  if (!d.tokens) {
    battery(ctx, d.level); dots(ctx, page)
    draw(ctx, 'Waiting for food', CENTER, 208, F26, TEXT, 'center')
    draw(ctx, 'npm run feed:ble', CENTER, 246, F13, MUTED, 'center')
    return
  }
  const t = d.tokens, total = sinceEvoTotal(d.evo, t)
  if (page === 1) {
    const start = -Math.PI / 2, p = progress(d.life), width = 10, spacing = width * 0.6
    arc(ctx, 206, width, start, start + Math.PI * 2, TRACK, spacing)
    if (p > 0) arc(ctx, 206, width, start, start + Math.PI * 2 * p, ORANGE, spacing)
    draw(ctx, 'LV ' + STAGES.indexOf(d.life.stage), CENTER, 164, D64, TEXT, 'center')
    draw(ctx, title(d.life.stage) + (d.life.branch === 'none' ? '' : ' - ' + title(d.life.branch)), CENTER, 220, F20, TEXT, 'center')
    draw(ctx, evoName(d.evo), CENTER, 254, F20, ORANGE, 'center')
    draw(ctx, d.life.stage === 'final' ? 'Max level' : formatPercent(p) + ' to next', CENTER, 292, F16, TEXT, 'center')
    draw(ctx, '+' + formatTokens(total) + ' tokens since evo', CENTER, 322, F13, MUTED, 'center')
  } else if (page === 2) {
    draw(ctx, 'Tokens', CENTER, 72, F26, TEXT, 'center')
    draw(ctx, formatTokens(t.total), CENTER, 118, D40, TEXT, 'center')
    draw(ctx, 'all time', CENTER, 148, F13, MUTED, 'center')
    const models = sinceEvo(d.evo, t), shown = Math.min(5, t.models.length)
    for (let i = 0; i < shown; i++) tokenRow(ctx, t.models[i].model, t.models[i].tokens, models[i].tokens, 186 + i * 38, t.total)
    if (t.models.length > shown) {
      let remaining = 0, since = 0
      for (let i = shown; i < t.models.length; i++) { remaining += t.models[i].tokens; since += models[i].tokens }
      tokenRow(ctx, 'other', remaining, since, 186 + shown * 38, t.total)
    }
  } else {
    draw(ctx, 'System', CENTER, 88, F26, TEXT, 'center')
    const rows: [string, string][] = [
      ['Today', formatTokens(t.today)],
      ['Input', formatTokens(t.input)],
      ['Output', formatTokens(t.output)],
      ['Cache read', formatTokens(t.cacheRead)],
      ['Cache write', formatTokens(t.cacheWrite)],
      ['Battery', Math.round(d.level) + '%' + (d.charging ? ' charging' : '')],
      ['Link', d.feedAge < 0 ? 'offline' : d.feedAge + 's ago'],
    ]
    for (let i = 0; i < rows.length; i++) {
      const y = 148 + i * 36
      draw(ctx, rows[i][0], LEFT, y, F16, MUTED, 'left')
      draw(ctx, rows[i][1], RIGHT, y, F16, TEXT, 'right')
    }
  }
  battery(ctx, d.level); dots(ctx, page)
}
