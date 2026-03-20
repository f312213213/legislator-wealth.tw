export function formatNTD(amount: number): string {
  return new Intl.NumberFormat('zh-TW').format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}/${m}/${d}`
}
