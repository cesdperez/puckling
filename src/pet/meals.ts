import { createLife, feed, isNight, parseFood, parseLife, progress, type Life } from './life'
import type { PetLife } from './pet'

export function restore(saved: string): Life {
  return parseLife(saved) || createLife()
}

export function digest(life: Life, line: string): { life: Life; meal: boolean; evolved: boolean; ate: number } {
  const food = parseFood(line)
  if (!food) return { life, meal: false, evolved: false, ate: 0 }
  const result = feed(life, food)
  return { life: result.life, meal: result.ate > 0, evolved: result.evolved, ate: result.ate }
}

export function petLife(life: Life, epochMs: number): PetLife {
  return { stage: life.stage, branch: life.branch, fullness: life.fullness, progress: progress(life), night: isNight(epochMs, life.last.tzMinutes) }
}

export function bytesToText(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i])
  return text
}
