import { bytesToText } from './pet/meals'

export function decodeBlob(bytes: number[], key: string): string | undefined {
  if (!key) return undefined
  const text = bytesToText(bytes)
  const newline = text.indexOf('\n')
  if (newline < 0 || text.slice(0, newline) !== key) return undefined
  return text.slice(newline + 1)
}
