import { getAllDeclarations, getAggregatedStocks, lookupStockPrice } from '@/lib/data'
import { LegislatorCard } from '@/components/legislator-card'
import { StockPopularityChart, LegislatorStockValueChart } from '@/components/stock-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Pre-compute market totals
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

  // Sort declarations by market total for ranked display
  const ranked = [...declarations].sort((a, b) =>
    (marketTotals.get(b.name) || 0) - (marketTotals.get(a.name) || 0)
  )

  return (
    <div className="space-y-16">
      {/* Header */}
      <div className="flex items-baseline justify-between pt-4">
        <h1 className="text-2xl font-bold">立委持股公開平台</h1>
        <p className="text-xs text-muted-foreground">資料來源：監察院公報</p>
      </div>

      {/* Charts */}
      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs tracking-widest text-muted-foreground uppercase">持股分析</h2>
          <Link href="/stocks" className="text-xs text-primary hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">最多立委持有</CardTitle>
            </CardHeader>
            <CardContent>
              {topStocks.length > 0 ? (
                <StockPopularityChart data={topStocks} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">尚未匯入申報資料</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">持股市值排名</CardTitle>
            </CardHeader>
            <CardContent>
              {legislatorStockValues.length > 0 ? (
                <LegislatorStockValueChart data={legislatorStockValues} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">尚未匯入申報資料</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Legislator List */}
      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs tracking-widest text-muted-foreground uppercase">立法委員</h2>
          <p className="text-xs text-muted-foreground">{declarations.length} 位</p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((decl, i) => (
            <LegislatorCard key={decl.name} data={decl} marketTotal={marketTotals.get(decl.name)} rank={i + 1} />
          ))}
        </div>
      </section>
    </div>
  )
}
