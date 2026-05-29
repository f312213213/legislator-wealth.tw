'use client'

import { useCurrencyFormat } from '@/components/currency-format-provider'
import { formatNTD, formatTaiwaneseNTD } from '@/lib/format'
import { cn } from '@/lib/utils'

export function CurrencyDisplay({ amount, className }: { amount: number | null; className?: string }) {
  const { format } = useCurrencyFormat()

  if (amount === null) return <span className={className}>--</span>

  const formatted = format === 'taiwanese'
    ? formatTaiwaneseNTD(amount)
    : formatNTD(amount)

  return <span className={cn('font-heading', className)}>NT$ {formatted}</span>
}
