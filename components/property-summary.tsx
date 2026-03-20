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

  return (
    <div className="border-b pb-6">
      <p className="text-xs text-muted-foreground">股票及基金市值</p>
      <p className="text-3xl font-bold tracking-tight font-mono-num">
        <CurrencyDisplay amount={amount} />
      </p>
    </div>
  )
}
