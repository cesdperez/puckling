export type ModelTokens = { model: string; tokens: number }
export type Tokens = { generation: number; total: number; input: number; output: number; cacheRead: number; cacheWrite: number; today: number; models: ModelTokens[] }

function integer(text: string): boolean {
  if (text === '') return false
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 && Math.floor(n) === n
}

export function splitFeed(body: string): { food: string; tokens: Tokens | undefined } {
  const lines = body.split('\n')
  const food = lines[0]
  if (lines.length < 2) return { food, tokens: undefined }
  const parts = lines[1].split(' ')
  if (parts.length !== 8 || parts[0] !== '1') return { food, tokens: undefined }
  for (let i = 1; i < parts.length; i++) if (!integer(parts[i])) return { food, tokens: undefined }
  const models: ModelTokens[] = []
  for (let i = 2; i < lines.length; i++) {
    const model = lines[i].split(' ')
    if (model.length === 2 && model[0] !== '' && integer(model[1])) models.push({ model: model[0], tokens: Number(model[1]) })
  }
  return { food, tokens: { generation: Number(parts[1]), total: Number(parts[2]), input: Number(parts[3]), output: Number(parts[4]), cacheRead: Number(parts[5]), cacheWrite: Number(parts[6]), today: Number(parts[7]), models } }
}
