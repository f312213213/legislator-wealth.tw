import { formatNTD } from '@/lib/format'

export function CurrencyDisplay({ amount, className }: { amount: number | null; className?: string }) {
  if (amount === null) return <span className={className}>--</span>
  return <span className={`font-heading ${className || ''}`}>NT$ {formatNTD(amount)}</span>
}
