import type { GeaCanvasElement } from '@geastack/core'
import { progress, STAGES, type Life } from './pet/life'
import { evoName, sinceEvo, sinceEvoTotal, type Evo } from './stats/evo'
import type { Tokens } from './stats/tokens'
import { formatPercent, formatTokens } from './ui/format'
import { PAGES, showBattery } from './ui/pager'

type Context = ReturnType<GeaCanvasElement['getContext']>
export type ScreenData = { life: Life; evo: Evo; tokens: Tokens | undefined; level: number; charging: boolean; feedAge: number }
const TEXT = '#e8e8e8', DIM = '#777777', TRACK = '#262626', ORANGE = '#d97757'

function text(ctx: Context, value: string, x: number, y: number, size: number, color: string): void {
  ctx.font = size + 'px monospace'
  ctx.fillStyle = color
  let width = ctx.measureText(value), center = size / 2
  try { center = ctx.measureTextInkCenter(value) } catch {}
  if (typeof width !== 'number') width = (width as unknown as { width: number }).width
  ctx.fillText(value, x - width / 2, y - center)
}
function arc(ctx: Context, radius: number, width: number, start: number, end: number, color: string): void {
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.arc(233, 233, radius, start, end); ctx.stroke()
}
function battery(ctx: Context, level: number, charging: boolean, label: boolean): void {
  const start = -Math.PI / 2 - Math.PI * 25 / 180, span = Math.PI * 50 / 180
  arc(ctx, 226, 6, start, start + span, TRACK)
  if (level > 0) arc(ctx, 226, 6, start, start + span * Math.min(100, level) / 100, level <= 20 ? '#e5484d' : '#46a758')
  if (label) text(ctx, Math.round(level) + '%' + (charging ? ' chg' : ''), 233, 48, 14, DIM)
}
export function drawHome(ctx: Context, data: ScreenData, brightness: number): void {
  ctx.fillStyle = '#000000'; ctx.fillRect(50, 375, 366, 60)
  const n = Math.round(119 * brightness), hex = '0123456789abcdef', c = hex[Math.floor(n / 16)] + hex[n % 16]
  text(ctx, 'LV ' + STAGES.indexOf(data.life.stage) + ' ' + evoName(data.evo), 233, 407, 18, '#' + c + c + c)
  ctx.fillStyle = '#000000'; ctx.fillRect(132, 0, 202, 35)
  if (showBattery(0, data.level, data.charging)) battery(ctx, data.level, data.charging, false)
}
function dots(ctx: Context, page: number): void {
  for (let i = 0; i < PAGES; i++) { ctx.beginPath(); ctx.fillStyle = i === page ? ORANGE : TRACK; ctx.arc(203 + i * 20, 422, 4, 0, Math.PI * 2); ctx.fill() }
}
export function screenKey(page: number, d: ScreenData): string {
  let key = page + '|' + d.level + '|' + d.charging
  if (d.tokens) key += '|' + d.tokens.generation + '|' + d.tokens.total + '|' + d.tokens.today + '|' + d.tokens.models.length + '|' + sinceEvoTotal(d.evo, d.tokens)
  if (page === 1) key += '|' + d.life.stage + '|' + d.life.branch + '|' + formatPercent(progress(d.life)) + '|' + evoName(d.evo)
  if (page === 3) key += '|' + d.feedAge
  return key
}
export function drawScreen(ctx: Context, page: number, d: ScreenData): void {
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 466, 466)
  if (!d.tokens) {
    battery(ctx, d.level, d.charging, page !== 1); dots(ctx, page)
    text(ctx, 'no feed', 233, 215, 28, TEXT)
    text(ctx, 'npm run feed:ble', 233, 250, 14, DIM)
    return
  }
  const t = d.tokens, total = sinceEvoTotal(d.evo, t)
  if (page === 1) {
    const start = -Math.PI / 2, p = progress(d.life)
    arc(ctx, 206, 10, start, start + Math.PI * 2, TRACK)
    if (p > 0) arc(ctx, 206, 10, start, start + Math.PI * 2 * p, ORANGE)
    text(ctx, 'LV ' + STAGES.indexOf(d.life.stage), 233, 155, 64, TEXT)
    text(ctx, d.life.stage + (d.life.branch === 'none' ? '' : ' / ' + d.life.branch), 233, 218, 22, DIM)
    text(ctx, evoName(d.evo), 233, 254, 22, ORANGE)
    text(ctx, d.life.stage === 'final' ? 'max lv' : 'next evo ' + formatPercent(p), 233, 294, 18, TEXT)
    text(ctx, '+' + formatTokens(total) + ' tok since evo', 233, 326, 16, DIM)
  } else if (page === 2) {
    text(ctx, 'tok / model', 233, 87, 25, TEXT)
    text(ctx, 'Σ ' + formatTokens(t.total) + ' · +' + formatTokens(total), 233, 120, 18, DIM)
    const models = sinceEvo(d.evo, t)
    for (let i = 0; i < t.models.length && i < 5; i++) {
      const y = 158 + i * 40
      text(ctx, t.models[i].model.slice(0, 14), 155, y, 15, TEXT)
      text(ctx, formatTokens(t.models[i].tokens), 308, y, 16, TEXT)
      text(ctx, '+' + formatTokens(models[i].tokens), 308, y + 17, 12, DIM)
    }
    if (t.models.length > 5) {
      let remaining = 0
      let since = 0
      for (let i = 5; i < t.models.length; i++) {
        remaining += t.models[i].tokens
        since += models[i].tokens
      }
      text(ctx, 'other', 155, 358, 15, TEXT)
      text(ctx, formatTokens(remaining), 308, 358, 16, TEXT)
      text(ctx, '+' + formatTokens(since), 308, 375, 12, DIM)
    }
  } else {
    text(ctx, 'Σ ' + formatTokens(t.total) + ' tok', 233, 105, 27, TEXT)
    text(ctx, 'today ' + formatTokens(t.today), 233, 151, 20, TEXT)
    text(ctx, 'in ' + formatTokens(t.input) + '  out ' + formatTokens(t.output), 233, 190, 17, TEXT)
    text(ctx, 'cache r ' + formatTokens(t.cacheRead) + ' w ' + formatTokens(t.cacheWrite), 233, 228, 17, TEXT)
    text(ctx, 'bat ' + Math.round(d.level) + '%' + (d.charging ? ' chg' : ''), 233, 266, 18, TEXT)
    text(ctx, d.feedAge < 0 ? 'link offline' : 'link ' + d.feedAge + 's ago', 233, 342, 18, DIM)
  }
  battery(ctx, d.level, d.charging, page !== 1); dots(ctx, page)
}
