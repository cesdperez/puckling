import { STAGES } from '../pet/life'
import type { ModelTokens, Tokens } from './tokens'

export const ADJECTIVES = ['admiring', 'adoring', 'affectionate', 'agitated', 'amazing', 'bold', 'brave', 'bright', 'busy', 'calm', 'clever', 'cool', 'dazzling', 'dreamy', 'eager', 'elastic', 'epic', 'fervent', 'focused', 'friendly', 'gallant', 'happy', 'hopeful', 'inspiring', 'jolly', 'keen', 'kind', 'laughing', 'lively', 'loving', 'magical', 'modest', 'nifty', 'peaceful', 'quirky', 'serene', 'sharp', 'sleepy', 'stoic', 'vibrant']
export const NERDS = ['lovelace', 'turing', 'hopper', 'knuth', 'dijkstra', 'ritchie', 'allen', 'babbage', 'bardeen', 'bell', 'bernerslee', 'bohr', 'borg', 'boyd', 'cerf', 'curie', 'darwin', 'einstein', 'engelbart', 'fermi', 'feynman', 'franklin', 'galileo', 'gates', 'goldberg', 'hamilton', 'hawking', 'heisenberg', 'herschel', 'johnson', 'kay', 'lamarr', 'liskov', 'mccarthy', 'mclean', 'morse', 'newton', 'shannon', 'tesla', 'williams']
export type Evo = { stage: number; adjective: number; nerd: number; generation: number; snapshot: ModelTokens[] }

export function evoName(evo: Evo): string { return ADJECTIVES[evo.adjective] + '_' + NERDS[evo.nerd] }
function snapshot(tokens: Tokens | undefined): ModelTokens[] {
  const result: ModelTokens[] = []
  if (tokens) for (let i = 0; i < tokens.models.length; i++) result.push({ model: tokens.models[i].model, tokens: tokens.models[i].tokens })
  return result
}
export function updateEvo(evo: Evo | undefined, stage: number, tokens: Tokens | undefined, random: () => number): Evo {
  if (!evo || evo.stage !== stage) return { stage, adjective: Math.floor(random() * ADJECTIVES.length), nerd: Math.floor(random() * NERDS.length), generation: tokens ? tokens.generation : -1, snapshot: snapshot(tokens) }
  if (tokens && tokens.generation !== evo.generation) return { stage, adjective: evo.adjective, nerd: evo.nerd, generation: tokens.generation, snapshot: snapshot(tokens) }
  return evo
}
export function sinceEvo(evo: Evo, tokens: Tokens): ModelTokens[] {
  const result: ModelTokens[] = []
  for (let i = 0; i < tokens.models.length; i++) {
    const current = tokens.models[i]
    let previous = 0
    for (let j = 0; j < evo.snapshot.length; j++) if (evo.snapshot[j].model === current.model) { previous = evo.snapshot[j].tokens; break }
    result.push({ model: current.model, tokens: Math.max(0, current.tokens - previous) })
  }
  return result
}
export function sinceEvoTotal(evo: Evo, tokens: Tokens): number {
  const models = sinceEvo(evo, tokens)
  let total = 0
  for (let i = 0; i < models.length; i++) total += models[i].tokens
  return total
}
export function serializeEvo(evo: Evo): string {
  let text = '1 ' + evo.stage + ' ' + evo.adjective + ' ' + evo.nerd + ' ' + evo.generation + ' ' + evo.snapshot.length
  for (let i = 0; i < evo.snapshot.length; i++) text += ' ' + evo.snapshot[i].model + ' ' + evo.snapshot[i].tokens
  return text
}
function integer(text: string, min: number): boolean {
  if (text === '') return false
  const n = Number(text)
  return Number.isFinite(n) && n >= min && Math.floor(n) === n
}
export function parseEvo(text: string): Evo | undefined {
  const parts = text.split(' ')
  if (parts.length < 6 || parts[0] !== '1') return undefined
  for (let i = 1; i < 6; i++) if (!integer(parts[i], i === 4 ? -1 : 0)) return undefined
  const stage = Number(parts[1]), adjective = Number(parts[2]), nerd = Number(parts[3]), generation = Number(parts[4]), count = Number(parts[5])
  if (stage >= STAGES.length || adjective >= ADJECTIVES.length || nerd >= NERDS.length || parts.length !== 6 + count * 2) return undefined
  const models: ModelTokens[] = []
  for (let i = 0; i < count; i++) {
    const model = parts[6 + i * 2], value = parts[7 + i * 2]
    if (model === '' || model.indexOf('\n') !== -1 || model.indexOf('\t') !== -1 || !integer(value, 0)) return undefined
    models.push({ model, tokens: Number(value) })
  }
  return { stage, adjective, nerd, generation, snapshot: models }
}
