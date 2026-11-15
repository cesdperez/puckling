import { age, createLife, feed, isNight, parseFood, parseLife, progress, type Life } from './life'
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

export type Feeding = { life: Life; sincePoll: number; sinceSave: number }

export function tick(feeding: Feeding, dt: number, readLine: () => string): { feeding: Feeding; meal: boolean; evolved: boolean; ate: number; save: boolean } {
  let life = age(feeding.life, dt)
  let sincePoll = feeding.sincePoll + dt
  let sinceSave = feeding.sinceSave + dt
  let meal = false, evolved = false, ate = 0
  if (sincePoll >= 2) {
    sincePoll = 0
    const result = digest(life, readLine())
    life = result.life
    meal = result.meal
    evolved = result.evolved
    ate = result.ate
  }
  const save = meal || evolved || sinceSave >= 600
  if (save) sinceSave = 0
  return { feeding: { life, sincePoll, sinceSave }, meal, evolved, ate, save }
}

export function petLife(life: Life, epochMs: number): PetLife {
  return { stage: life.stage, branch: life.branch, fullness: life.fullness, progress: progress(life), night: isNight(epochMs, life.last.tzMinutes) }
}

export function bytesToText(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i])
  return text
}
