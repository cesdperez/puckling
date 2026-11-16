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

function measure(ctx: Context, value: string, font: Font): number {
  const metric = ctx.measureText(value)
  const width = typeof metric === 'number' ? metric : (metric as TextMetrics).width
  return width === 0 ? value.length * Math.round(font.size / 2) : width
}
function setFont(ctx: Context, font: Font): void {
  ctx.font = font.size + 'px ' + font.family
}
// Per-string ink centring makes strings of one font share no baseline, because
// 'Today' and '620k' have different ink extents. The cap height of 'H' is the same
// for every string in a font, so every string anchors on that instead. A stub or a
// missing atlas reports no ink, and then the line box centre is the only reference.
const capCentres = new Map<string, number>()
function capCentre(ctx: Context, font: Font): number {
  const key = font.size + 'px ' + font.family
  const cached = capCentres.get(key)
  if (cached !== undefined) return cached
  setFont(ctx, font)
  const ink = typeof ctx.measureTextInkCenter === 'function' ? ctx.measureTextInkCenter('H') : 0
  if (!ink) return font.size / 2
  capCentres.set(key, ink)
  return ink
}
// The device anchors fillText at the top of the line box and reports the ink offset;
// a browser canvas anchors the baseline and has no ink measurement, so a preview
// needs the cap-height centre to land where the device puts it.
function baselineY(ctx: Context, y: number, font: Font): number {
  return typeof ctx.measureTextInkCenter === 'function' ? y - capCentre(ctx, font) : y + Math.round(font.size * 0.36)
}
// A smaller string beside a larger one shares nothing with it unless it is hung from
// the larger font's cap line, since its own cap centre sits lower.
function capLineOffset(ctx: Context, small: Font, large: Font): number {
  return typeof ctx.measureTextInkCenter === 'function' ? capCentre(ctx, large) - capCentre(ctx, small) : 0
}
type Anchor = 'center' | 'left' | 'right'
// Returns the drawn width so a caller that places a neighbour does not measure again.
function draw(ctx: Context, value: string, x: number, y: number, font: Font, color: string, anchor: Anchor): number {
  setFont(ctx, font)
  ctx.fillStyle = color
  const width = measure(ctx, value, font)
  const left = anchor === 'right' ? x - width : anchor === 'center' ? x - width / 2 : x
  ctx.fillText(value, left, baselineY(ctx, y, font))
  return width
}
function fit(ctx: Context, value: string, font: Font, maxWidth: number): string {
  setFont(ctx, font)
  if (measure(ctx, value, font) <= maxWidth) return value
  let cut = value
  while (cut.length > 0 && measure(ctx, cut + '...', font) > maxWidth) cut = cut.slice(0, -1)
  return cut + '...'
}
function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
const SEGMENT = 8
// A filled circle rasterises on the device as a jagged blob, so a thick band is
// drawn as short annular quads instead. Each quad is its own path because the
// device fills a path with an even-odd rule, where overlapping quads would cancel.
function arc(ctx: Context, radius: number, width: number, start: number, end: number, color: string): void {
  const outer = radius + width / 2, inner = radius - width / 2, span = end - start
  const count = Math.max(1, Math.ceil(Math.abs(span) * radius / SEGMENT))
  const step = span / count
  const overlap = Math.min(Math.abs(step) * 0.25, 0.3 / radius)
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const a = start + step * i - overlap, b = start + step * (i + 1) + overlap
    ctx.beginPath()
    ctx.moveTo(CENTER + outer * Math.cos(a), CENTER + outer * Math.sin(a))
    ctx.lineTo(CENTER + outer * Math.cos(b), CENTER + outer * Math.sin(b))
    ctx.lineTo(CENTER + inner * Math.cos(b), CENTER + inner * Math.sin(b))
    ctx.lineTo(CENTER + inner * Math.cos(a), CENTER + inner * Math.sin(a))
    ctx.closePath()
    ctx.fill()
  }
  if (Math.abs(span) < Math.PI * 2 - 0.01) {
    arcCap(ctx, radius, width, start, -Math.sign(step))
    arcCap(ctx, radius, width, end, Math.sign(step))
  }
}
// The device ignores the angles of `arc()` and fills a whole disc, so the rounded
// end is a half disc built from a fan of points on the outward side.
function arcCap(ctx: Context, radius: number, width: number, angle: number, direction: number): void {
  const r = width / 2, cx = CENTER + radius * Math.cos(angle), cy = CENTER + radius * Math.sin(angle)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  for (let i = 0; i <= 6; i++) {
    const phi = angle + direction * Math.PI * i / 6
    ctx.lineTo(cx + r * Math.cos(phi), cy + r * Math.sin(phi))
  }
  ctx.closePath()
  ctx.fill()
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
  if (delta > 0) deltaWidth = draw(ctx, '+' + formatTokens(delta), RIGHT - valueWidth - GAP, y - capLineOffset(ctx, F13, F16), F13, MUTED, 'right')
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
  for (let i = 0; i < PAGES; i++) {
    const active = i === page
    ctx.fillStyle = active ? ORANGE : TRACK
    ctx.fillRect(203 + i * 20 - (active ? 5 : 3), 421, active ? 10 : 6, 6)
  }
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
    const start = -Math.PI / 2, p = progress(d.life), width = 10
    arc(ctx, 206, width, start, start + Math.PI * 2, TRACK)
    if (p > 0) arc(ctx, 206, width, start, start + Math.PI * 2 * p, ORANGE)
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
