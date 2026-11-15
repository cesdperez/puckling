export function decodeBlob(bytes: number[], key: string): string | undefined {
  if (!key) return undefined
  let text = ''
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i])
  const newline = text.indexOf('\n')
  if (newline < 0 || text.slice(0, newline) !== key) return undefined
  return text.slice(newline + 1)
}
