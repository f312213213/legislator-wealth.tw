export function formatNTD(amount: number): string {
  return new Intl.NumberFormat('zh-TW').format(amount)
}

export function formatTaiwaneseNTD(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return '0'

  const sign = rounded < 0 ? '-' : ''
  const value = Math.abs(rounded)
  const yi = Math.floor(value / 100_000_000)
  const wan = Math.floor((value % 100_000_000) / 10_000)
  const yuan = value % 10_000
  const parts: string[] = []

  if (yi > 0) parts.push(`${yi}億`)
  if (wan > 0) parts.push(`${wan}萬`)
  if (yuan > 0 || parts.length === 0) parts.push(`${yuan}`)

  return `${sign}${parts.join('')}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}/${m}/${d}`
}
