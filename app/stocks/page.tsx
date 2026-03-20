import { getAllStockHoldings, getAggregatedStocks } from '@/lib/data'
import { StockTable } from '@/components/stock-table'
import { StockPopularityChart } from '@/components/stock-chart'

export const metadata = {
  title: '股票及基金 — 立委持股公開平台',
}

export default function StocksPage() {
  const holdings = getAllStockHoldings()
  const aggregatedStocks = getAggregatedStocks()

  const topStocksChart = aggregatedStocks.slice(0, 10).map(s => ({
    name: s.name,
    count: s.holderCount,
  }))

  return (
    <div className="space-y-12">
      <header className="pt-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">股票及基金</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {holdings.length} 筆持有紀錄 · 所有立法委員申報的股票及基金持有明細
        </p>
      </header>

      <div>
        <p className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-widest">最多立委持有</p>
        {topStocksChart.length > 0 ? (
          <StockPopularityChart data={topStocksChart} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">尚未匯入申報資料</p>
        )}
      </div>

      <StockTable rows={holdings} />
    </div>
  )
}
