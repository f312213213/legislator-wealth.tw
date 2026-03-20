import { CurrencyDisplay } from './currency-display'
import { lookupStockPrice } from '@/lib/data'
import type { LegislatorDeclaration } from '@/lib/types'

function calcMarketTotal(data: LegislatorDeclaration) {
  let total = 0
  for (const s of data.securities.stocks.items) {
    const p = lookupStockPrice(s.name)
    total += p ? Math.round(s.shares * p.price) : s.ntdTotal
  }
  for (const f of data.securities.funds.items) {
    const p = lookupStockPrice(f.name)
    total += p ? Math.round(f.units * p.price) : f.ntdTotal
  }
  return total
}

export function PropertySummary({ data }: { data: LegislatorDeclaration }) {
  const amount = calcMarketTotal(data)
  const stockCount = data.securities.stocks.items.length
  const fundCount = data.securities.funds.items.length

  return (
    <div className="border-b pb-6 space-y-1">
      <p className="text-sm text-muted-foreground">股票及基金市值</p>
      <p className="text-4xl font-bold tracking-tight sm:text-5xl">
        <CurrencyDisplay amount={amount} />
      </p>
      <p className="text-sm text-muted-foreground">
        {stockCount > 0 && `${stockCount} 檔股票`}
        {stockCount > 0 && fundCount > 0 && ' · '}
        {fundCount > 0 && `${fundCount} 檔基金`}
        {stockCount === 0 && fundCount === 0 && '未持有股票或基金'}
      </p>
    </div>
  )
}
