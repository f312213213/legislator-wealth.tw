import { getAllStockHoldings, getAggregatedStocks, getLegislatorMeta } from '@/lib/data'
import { StockTable } from '@/components/stock-table'
import { PartyBarChart, type StockBarData } from '@/components/party-bar-chart'

export const metadata = {
  title: '股票及基金',
  description: '所有立法委員申報的股票及基金持有明細，可依標的名稱或立委姓名搜尋及排序。',
}

export default function StocksPage() {
  const holdings = getAllStockHoldings()
  const aggregatedStocks = getAggregatedStocks()

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

  return (
    <div className="space-y-12">
      <header className="pt-4">
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">股票及基金</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {holdings.length} 筆持有紀錄，所有立法委員申報的股票及基金持有明細。
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">最多立委持有的股票</h2>
        <PartyBarChart stocks={topStocksData} />
      </section>

      <StockTable rows={holdings} />
    </div>
  )
}
