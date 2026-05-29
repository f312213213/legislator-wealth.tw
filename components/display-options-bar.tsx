import { CurrencyFormatToggle } from '@/components/currency-format-toggle'

export function DisplayOptionsBar() {
  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <p className="text-xs font-medium text-muted-foreground">金額顯示</p>
        <CurrencyFormatToggle />
      </div>
    </div>
  )
}
