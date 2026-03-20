import { getAllDeclarations, getAggregatedStocks, lookupStockPrice, getLegislatorMeta } from '@/lib/data'
import { LegislatorCard } from '@/components/legislator-card'
import { StockPopularityChart, LegislatorStockValueChart } from '@/components/stock-chart'
import Link from 'next/link'
import type { LegislatorDeclaration } from '@/lib/types'

function calcMarketTotal(decl: LegislatorDeclaration): number {
  let total = 0
  for (const s of decl.securities.stocks.items) {
    const p = lookupStockPrice(s.name)
    total += p ? Math.round(s.shares * p.price) : s.ntdTotal
  }
  for (const f of decl.securities.funds.items) {
    const p = lookupStockPrice(f.name)
    total += p ? Math.round(f.units * p.price) : f.ntdTotal
  }
  return total
}

export default function HomePage() {
  const declarations = getAllDeclarations()
  const aggregatedStocks = getAggregatedStocks()

  const topStocks = aggregatedStocks.slice(0, 10).map(s => ({
    name: s.name,
    count: s.holderCount,
  }))

  const marketTotals = new Map<string, number>()
  for (const d of declarations) {
    marketTotals.set(d.name, calcMarketTotal(d))
  }

  const legislatorStockValues = declarations
    .map(d => ({
      name: d.name,
      totalNTD: marketTotals.get(d.name) || 0,
    }))
    .filter(d => d.totalNTD > 0)
    .sort((a, b) => b.totalNTD - a.totalNTD)
    .slice(0, 10)

  const ranked = [...declarations].sort((a, b) =>
    (marketTotals.get(b.name) || 0) - (marketTotals.get(a.name) || 0)
  )

  const withStocks = ranked.filter(d => (marketTotals.get(d.name) || 0) > 0)
  const withoutStocks = ranked.filter(d => (marketTotals.get(d.name) || 0) === 0)

  return (
    <div className="space-y-20">
      {/* Hero */}
      <header className="pt-8 sm:pt-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">立委持股公開平台</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {declarations.length} 位立法委員 · 資料來源：監察院公報
        </p>
      </header>

      {/* Charts — no card wrapper, let them breathe */}
      <section className="space-y-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">持股分析</h2>
          <Link href="/stocks" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            全部明細 →
          </Link>
        </div>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-widest">最多立委持有</p>
            {topStocks.length > 0 ? (
              <StockPopularityChart data={topStocks} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">尚未匯入申報資料</p>
            )}
          </div>
          <div>
            <p className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-widest">持股市值排名</p>
            {legislatorStockValues.length > 0 ? (
              <LegislatorStockValueChart data={legislatorStockValues} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">尚未匯入申報資料</p>
            )}
          </div>
        </div>
      </section>

      {/* Legislator List — with stocks */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold">持股立委</h2>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {withStocks.map((decl, i) => (
            <LegislatorCard key={`${decl.name}-${i}`} data={decl} marketTotal={marketTotals.get(decl.name)} meta={getLegislatorMeta(decl.name)} />
          ))}
        </div>
      </section>

      {/* Zero holdings */}
      {withoutStocks.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-muted-foreground">未持股立委</h2>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {withoutStocks.map((decl, i) => (
              <LegislatorCard key={`${decl.name}-z-${i}`} data={decl} marketTotal={0} meta={getLegislatorMeta(decl.name)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
