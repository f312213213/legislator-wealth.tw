import { getAllStockHoldings, getAggregatedStocks } from '@/lib/data'
import { StockTable } from '@/components/stock-table'

export const metadata = {
  title: '股票及基金',
  description: '所有立法委員申報的股票及基金持有明細，可依標的名稱或立委姓名搜尋及排序。',
}

export default function StocksPage() {
  const holdings = getAllStockHoldings()
  const aggregatedStocks = getAggregatedStocks()

  const topStocks = aggregatedStocks.slice(0, 10)

  return (
    <div className="space-y-12">
      <header className="pt-4">
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">股票及基金</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {holdings.length} 筆持有紀錄，所有立法委員申報的股票及基金持有明細。
        </p>
      </header>

      {/* Inline bar list instead of Recharts widget */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">最多立委持有</h2>
        <div className="space-y-2">
          {topStocks.map(s => {
            const maxCount = topStocks[0]?.holderCount || 1
            const pct = (s.holderCount / maxCount) * 100
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-sm font-medium truncate">{s.name}</span>
                <div className="flex-1 h-5 bg-muted overflow-hidden">
                  <div className="h-full bg-foreground/15" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">{s.holderCount} 人</span>
              </div>
            )
          })}
        </div>
      </section>

      <StockTable rows={holdings} />
    </div>
  )
}
