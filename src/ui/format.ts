export function formatTokens(n: number): string {
  const suffixes = ['', 'k', 'M', 'B', 'T']
  let scale = 1, index = 0
  while (n >= scale * 1000 && index < suffixes.length - 1) { scale *= 1000; index++ }
  const value = n / scale
  const factor = value < 10 ? 100 : value < 100 ? 10 : 1
  return String(Math.floor(n * factor / scale) / factor) + suffixes[index]
}
export function formatPercent(p: number): string {
  return String(Math.min(100, Math.max(0, Math.floor(p * 100)))) + '%'
}
