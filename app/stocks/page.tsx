import { getAllDeclarations, getAllStockHoldings, getAggregatedStocks, getLegislatorMeta, lookupStockPrice, getSlugByName, getIndex } from '@/lib/data'
import Link from 'next/link'
import { StockTable } from '@/components/stock-table'
import { PartyBarChart, type StockBarData } from '@/components/party-bar-chart'
import { CurrencyDisplay } from '@/components/currency-display'
import { JsonLd } from '@/components/json-ld'
import type { LegislatorDeclaration } from '@/lib/types'

export const metadata = {
  title: '立委持股總覽 — 股票及基金申報明細',
  description: '所有立法委員申報的股票及基金持有明細，可依標的名稱或立委姓名搜尋及排序。',
}

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

export default function StocksPage() {
  const declarations = getAllDeclarations()
  const holdings = getAllStockHoldings()
  const aggregatedStocks = getAggregatedStocks()

  const withHoldings = declarations.filter(d => d.securities.stocks.items.length + d.securities.funds.items.length > 0)

  // --- Concentrated holdings ---
  const legislatorTotals = new Map<string, number>()
  for (const d of declarations) {
    legislatorTotals.set(d.name, calcMarketTotal(d))
  }

  const allStocksWithDetails = aggregatedStocks.map(s => {
    const p = lookupStockPrice(s.name)
    const uniqueHolders = new Map<string, { shares: number; ntdTotal: number }>()
    for (const h of s.holders) {
      const existing = uniqueHolders.get(h.legislator)
      if (existing) {
        existing.shares += h.shares
        existing.ntdTotal += h.ntdTotal
      } else {
        uniqueHolders.set(h.legislator, { shares: h.shares, ntdTotal: h.ntdTotal })
      }
    }
    let marketValue = 0
    const holderDetails = Array.from(uniqueHolders.entries()).map(([legislator, { shares, ntdTotal }]) => {
      const value = p ? Math.round(shares * p.price) : ntdTotal
      marketValue += value
      const portfolio = legislatorTotals.get(legislator) || 1
      return { legislator, value, pctOfPortfolio: Math.round((value / portfolio) * 100), slug: getSlugByName(legislator) }
    }).sort((a, b) => b.value - a.value)
    return { name: s.name, holderCount: s.holderCount, marketValue, holderDetails }
  })

  const concentratedRows = allStocksWithDetails.flatMap(s =>
    s.holderDetails
      .filter(h => h.pctOfPortfolio >= 20 && h.value >= 5_000_000)
      .map(h => ({ stock: s.name, legislator: h.legislator, slug: h.slug, value: h.value, pct: h.pctOfPortfolio }))
  ).sort((a, b) => b.pct - a.pct)

  // --- Top stocks party breakdown ---
  const topStocksData: StockBarData[] = aggregatedStocks.slice(0, 10).map(s => {
    const partyCounts: Record<string, number> = {}
    const uniqueLegislators = new Set<string>()
    for (const h of s.holders) {
      if (uniqueLegislators.has(h.legislator)) continue
      uniqueLegislators.add(h.legislator)
      const meta = getLegislatorMeta(h.legislator)
      const party = meta?.party || '其他'
      partyCounts[party] = (partyCounts[party] || 0) + 1
    }
    return { name: s.name, holderCount: s.holderCount, partyCounts }
  })

  const stockListItems = aggregatedStocks.slice(0, 50).map((s, i) => ({
    '@type': 'ListItem' as const,
    position: i + 1,
    item: {
      '@type': 'Thing' as const,
      name: s.name,
      description: `${s.holderCount} 位立委持有`,
    },
  }))

  return (
    <div className="space-y-16">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '立法委員持有的股票及基金',
        numberOfItems: aggregatedStocks.length,
        itemListElement: stockListItems,
      }} />
      <header className="pt-4">
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">股票及基金</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {declarations.length} 位立委中有 {withHoldings.length} 位持有股票或基金，共 {new Set(holdings.map(h => h.name)).size} 檔標的、{holdings.length} 筆紀錄。
        </p>
      </header>


      {/* Top stocks by holder count with party breakdown */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">最多立委持有的股票</h2>
        <PartyBarChart stocks={topStocksData} />
      </section>

      {/* Flagship: concentrated bets */}
      {concentratedRows.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">個人重倉股</h2>
          <p className="text-sm text-muted-foreground">單一股票佔該立委持股 20% 以上，且市值超過 500 萬</p>
          <div className="divide-y">
            {concentratedRows.map((r, i) => (
              <div key={`${r.legislator}-${r.stock}-${i}`} className="flex items-center gap-3 py-2">
                <span className="font-heading text-sm font-black tabular-nums text-[#cc4444] w-10 shrink-0">{r.pct}%</span>
                <Link href={`/legislator/${r.slug}`} className="text-sm font-medium hover:underline shrink-0">{r.legislator}</Link>
                <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">{r.stock}</span>
                <span className="text-xs font-bold tabular-nums shrink-0"><CurrencyDisplay amount={r.value} /></span>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* Full table */}
      <StockTable rows={holdings} slugMap={(() => {
        const index = getIndex()
        const map: Record<string, string> = {}
        for (const l of index.legislators) map[l.name] = l.slug
        return map
      })()} />
    </div>
  )
}
