'use client'

import { useCurrencyFormat, type CurrencyFormat } from '@/components/currency-format-provider'
import { cn } from '@/lib/utils'

const OPTIONS: { value: CurrencyFormat; label: string; ariaLabel: string }[] = [
  { value: 'plain', label: '完整數字', ariaLabel: '以完整數字顯示金額' },
  { value: 'taiwanese', label: '億萬', ariaLabel: '以億萬格式顯示金額' },
]

export function CurrencyFormatToggle() {
  const { format, setFormat } = useCurrencyFormat()

  return (
    <div
      role="group"
      aria-label="金額顯示格式"
      className="inline-flex h-8 shrink-0 border text-xs font-medium"
    >
      {OPTIONS.map(option => {
        const active = format === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.ariaLabel}
            aria-pressed={active}
            onClick={() => setFormat(option.value)}
            className={cn(
              'min-w-16 px-2 transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
